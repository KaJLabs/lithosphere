/**
 * Governance dress rehearsal on Makalu (chainId 700777, free to redeploy).
 *
 * Proves the MultX bridge governance design end-to-end BEFORE the audited Kamet
 * cutover: Timelock owns the bridge; a fast guardian can pause instantly but not
 * unpause or reconfigure; config/unpause only execute after the timelock delay.
 *
 * Standalone ethers (not hardhat) so we control the Ethermint tx envelope
 * (legacy type-0) and target a *synced* Makalu sentry directly.
 *
 * Roles (rehearsal): the deployer doubles as BOTH the pause guardian AND the
 * "Safe" (timelock proposer/executor). After transferOwnership(timelock) the
 * deployer is a NON-owner, so it faithfully exercises the guardian-vs-owner
 * split with a single funded key. In production these are distinct: guardian =
 * fast ops key/2-of-3, proposer/executor = the Gnosis Safe.
 *
 * Env: DEPLOYER_PRIVATE_KEY=0x...   MAKALU_RPC (required)
 * Run: node scripts/governance/rehearse-makalu.js
 */
require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC = process.env.MAKALU_RPC;
if (!RPC) throw new Error("MAKALU_RPC is required");
const CHAIN_ID = 700777;
const DELAY = 150; // timelock minDelay for the rehearsal (production = 48h)
const OV = { type: 0, gasPrice: ethers.utils.parseUnits("10", "gwei") };
const DEPLOY_GAS = 6_000_000, TX_GAS = 500_000;
const HashZero = ethers.constants.HashZero;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const bridgeArt = require(path.join(__dirname, "../../artifacts/contracts/MultXBridge.sol/MultXBridge.json"));
const tlArt = require(path.join(__dirname, "../../artifacts/contracts/governance/GovTimelock.sol/GovTimelock.json"));

const T = []; // transcript
const rec = (step, action, detail) => { T.push({ step, action, ...detail }); console.log(`[${step}] ${action} ${JSON.stringify(detail)}`); };

async function expectRevert(label, promise) {
  try { await promise; rec(label, "UNEXPECTED SUCCESS (should have reverted)", { ok: false }); return false; }
  catch (e) {
    const reason = e.errorName || e.reason || (e.error && e.error.message) || (e.message || "").split("(")[0].trim();
    rec(label, "reverted as expected", { ok: true, reason: String(reason).slice(0, 90) });
    return true;
  }
}

(async () => {
  const provider = new ethers.providers.JsonRpcProvider(RPC, CHAIN_ID);
  const w = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  const dead = ethers.utils.getAddress("0x000000000000000000000000000000000000dead");
  console.log(`Makalu governance rehearsal — RPC ${RPC}, deployer/guardian/safe ${w.address}`);
  console.log(`balance ${ethers.utils.formatEther(await provider.getBalance(w.address))} LITHO, timelock delay ${DELAY}s\n`);

  // ── 1. Deploy guarded bridge (1-of-1 validator set; we test governance, not sigs)
  const bridgeF = new ethers.ContractFactory(bridgeArt.abi, bridgeArt.bytecode, w);
  const bridge = await bridgeF.deploy([w.address], 1, { ...OV, gasLimit: DEPLOY_GAS });
  await bridge.deployed();
  rec("1", "deployed MultXBridge (guarded)", { address: bridge.address, tx: bridge.deployTransaction.hash });

  // ── 2. Deploy Timelock (deployer = Safe stand-in: proposer + executor; no admin)
  const tlF = new ethers.ContractFactory(tlArt.abi, tlArt.bytecode, w);
  const timelock = await tlF.deploy(DELAY, [w.address], [w.address], ethers.constants.AddressZero, { ...OV, gasLimit: DEPLOY_GAS });
  await timelock.deployed();
  rec("2", "deployed GovTimelock", { address: timelock.address, tx: timelock.deployTransaction.hash, minDelay: (await timelock.getMinDelay()).toString() });

  // ── 3. Wire: set guardian (while still owner) then hand ownership to the timelock
  await (await bridge.setPauseGuardian(w.address, { ...OV, gasLimit: TX_GAS })).wait();
  rec("3a", "setPauseGuardian(deployer)", { guardian: await bridge.pauseGuardian() });
  await (await bridge.transferOwnership(timelock.address, { ...OV, gasLimit: TX_GAS })).wait();
  rec("3b", "transferOwnership -> timelock", { owner: await bridge.owner(), isTimelock: (await bridge.owner()).toLowerCase() === timelock.address.toLowerCase() });

  // ── 4. Guardian can pause INSTANTLY (deployer is now guardian, NOT owner)
  await (await bridge.pause({ ...OV, gasLimit: TX_GAS })).wait();
  rec("4", "guardian.pause() -> instant", { paused: await bridge.paused() });

  // ── 5. Non-owner (guardian) CANNOT unpause or reconfigure directly
  await expectRevert("5a", bridge.callStatic.unpause({ from: w.address }));
  await expectRevert("5b", bridge.callStatic.setValidatorSet([w.address, dead], 1, { from: w.address }));

  // ── 6. Schedule BOTH timelocked ops (unpause + setValidatorSet) as the Safe/proposer
  const unpauseData = bridge.interface.encodeFunctionData("unpause", []);
  const setValsData = bridge.interface.encodeFunctionData("setValidatorSet", [[w.address, dead], 2]);
  const saltU = ethers.utils.id("rehearsal-unpause"), saltV = ethers.utils.id("rehearsal-setvals");
  await (await timelock.schedule(bridge.address, 0, unpauseData, HashZero, saltU, DELAY, { ...OV, gasLimit: TX_GAS })).wait();
  await (await timelock.schedule(bridge.address, 0, setValsData, HashZero, saltV, DELAY, { ...OV, gasLimit: TX_GAS })).wait();
  const idU = await timelock.hashOperation(bridge.address, 0, unpauseData, HashZero, saltU);
  rec("6", "scheduled unpause + setValidatorSet", { unpauseReady: await timelock.isOperationReady(idU), pending: await timelock.isOperationPending(idU) });

  // ── 7. Execute BEFORE the delay elapses -> must revert (this is the whole point)
  await expectRevert("7", timelock.callStatic.execute(bridge.address, 0, unpauseData, HashZero, saltU, { from: w.address }));

  // ── 8. Wait out the delay, then execute both via the timelock
  const waitMs = (DELAY + 20) * 1000;
  console.log(`\nwaiting ${waitMs / 1000}s for timelock delay to elapse...\n`);
  await sleep(waitMs);
  await (await timelock.execute(bridge.address, 0, unpauseData, HashZero, saltU, { ...OV, gasLimit: TX_GAS })).wait();
  rec("8a", "timelock.execute(unpause) after delay", { paused: await bridge.paused() });
  await (await timelock.execute(bridge.address, 0, setValsData, HashZero, saltV, { ...OV, gasLimit: TX_GAS })).wait();
  const vals = await bridge.getValidators();
  rec("8b", "timelock.execute(setValidatorSet) after delay", { validators: vals, signaturesRequired: (await bridge.signaturesRequired()).toString() });

  // ── verdict + persist
  const pass =
    (await bridge.owner()).toLowerCase() === timelock.address.toLowerCase() &&
    (await bridge.paused()) === false &&
    vals.length === 2 &&
    T.filter((t) => t.step.startsWith("5") || t.step === "7").every((t) => t.ok);
  console.log(`\n${pass ? "✅ REHEARSAL PASSED" : "❌ REHEARSAL FAILED"} — all governance properties held.`);

  const out = {
    network: "makalu", chainId: CHAIN_ID, rpc: RPC, delaySeconds: DELAY,
    bridge: bridge.address, timelock: timelock.address,
    guardian: w.address, safeStandin: w.address, passed: pass, transcript: T,
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fp = path.join(__dirname, `../../deployments/makalu-governance-rehearsal-${stamp}.json`);
  fs.writeFileSync(fp, JSON.stringify(out, null, 2));
  console.log("record:", fp);
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error("REHEARSAL ERROR:", e.message); process.exit(1); });
