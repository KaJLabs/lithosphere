/**
 * Live end-to-end proof: MultX outbound Kamet -> any EVM dest testnet.
 *
 * Locks wLITHO on the Kamet source bridge, then waits for the KMS 5-of-7 relayer
 * federation (bridge-api on vps2) to observe the TokensLocked event and mint the
 * wrapped wLITHO on the destination chain. Proves the whole cross-chain path —
 * source lock, relayer signing, dest release — with a real transfer.
 *
 * Defaults to Ethereum Sepolia; override via env for other EVM dests:
 *   TARGET_CID=84532 TARGET_RPC=https://base-sepolia-rpc.publicnode.com \
 *   TARGET_NAME="Base Sepolia" node scripts/bridge/e2e-kamet-evm.js
 *
 * lockTokens(token, amount, targetChain) has no recipient arg, so the relayer
 * credits msg.sender on the dest chain (same address bridges to same address).
 * Kamet is Ethermint -> legacy type-0 txs against a synced RPC.
 * Env: DEPLOYER_PRIVATE_KEY (contracts/.env). LITHO_RPC_HTTP for a direct synced sentry.
 */
require("dotenv").config();
const { ethers } = require("ethers");

const KAMET_RPC = process.env.LITHO_RPC_HTTP || "https://rpc-3.litho.ai";
const TARGET_CID = Number(process.env.TARGET_CID || 11155111);
const TARGET_RPC = process.env.TARGET_RPC || "https://ethereum-sepolia-rpc.publicnode.com";
const TARGET_NAME = process.env.TARGET_NAME || "Ethereum Sepolia";
const BRIDGE = "0x3a896BDF3a1088287FA84aB5a43bB30e2535F263"; // Kamet source bridge
const WLITHO_KAMET = "0xC0FC628e3aB128fe387e7ed5e729bD809C017888";
// Wrapped wLITHO — same address on Sepolia + Base (same deployer+nonce via CREATE)
const WRAPPED = process.env.WRAPPED || "0x1904e61aD439D2A9c18305D53Db296Af6844DC7b";
const AMOUNT = ethers.utils.parseUnits(process.env.AMOUNT || "0.5", 18);
const OV = { type: 0, gasPrice: ethers.utils.parseUnits("10", "gwei") };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ERC20 = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];
const BRIDGE_ABI = [
  "function lockTokens(address token, uint256 amount, uint256 targetChain) returns (bytes32)",
  "event TokensLocked(bytes32 indexed txHash, address indexed token, address indexed sender, uint256 amount, uint256 targetChain, uint256 nonce)",
];

(async () => {
  const kamet = new ethers.providers.StaticJsonRpcProvider(KAMET_RPC, { chainId: 900523, name: "kamet" });
  const dest = new ethers.providers.StaticJsonRpcProvider(TARGET_RPC, { chainId: TARGET_CID, name: "dest" });
  const w = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, kamet);
  const me = w.address;
  console.log(`E2E MultX proof — Kamet -> ${TARGET_NAME} (${TARGET_CID}), address ${me}`);

  const wrapped = new ethers.Contract(WRAPPED, ERC20, dest);
  const before = await wrapped.balanceOf(me);
  console.log(`${TARGET_NAME} wrapped wLITHO before: ${ethers.utils.formatUnits(before, 18)}`);

  // 1. approve the bridge to pull wLITHO (only if needed)
  const wl = new ethers.Contract(WLITHO_KAMET, ERC20, w);
  const allow = await wl.allowance(me, BRIDGE);
  if (allow.lt(AMOUNT)) {
    console.log("approving bridge to spend wLITHO...");
    await (await wl.approve(BRIDGE, ethers.constants.MaxUint256, { ...OV, gasLimit: 80_000 })).wait();
  }

  // 2. lock targeting the dest chain
  const bridge = new ethers.Contract(BRIDGE, BRIDGE_ABI, w);
  console.log(`locking ${ethers.utils.formatUnits(AMOUNT, 18)} wLITHO -> ${TARGET_NAME}...`);
  const tx = await bridge.lockTokens(WLITHO_KAMET, AMOUNT, TARGET_CID, { ...OV, gasLimit: 300_000 });
  const rc = await tx.wait();
  const ev = rc.events?.find((e) => e.event === "TokensLocked");
  console.log(`✅ LOCKED on Kamet — tx ${rc.transactionHash} (block ${rc.blockNumber})`);
  if (ev) console.log(`   TokensLocked txHash=${ev.args.txHash} nonce=${ev.args.nonce.toString()}`);

  // 3. wait for the relayer to release/mint on the dest chain
  console.log(`\nwaiting for KMS relayer to mint wrapped wLITHO on ${TARGET_NAME} (poll 12s, up to 6 min)...`);
  const deadline = 6 * 60 * 1000;
  let waited = 0;
  while (waited < deadline) {
    await sleep(12_000); waited += 12_000;
    const now = await wrapped.balanceOf(me);
    if (now.gt(before)) {
      console.log(`\n✅ RELEASED on ${TARGET_NAME} — wrapped wLITHO +${ethers.utils.formatUnits(now.sub(before), 18)}`);
      console.log(`   ${TARGET_NAME} wrapped wLITHO now: ${ethers.utils.formatUnits(now, 18)}`);
      console.log(`\n🎉 END-TO-END PROVEN: Kamet lock -> relayer -> ${TARGET_NAME} mint, same address.`);
      process.exit(0);
    }
    process.stdout.write(`  ...${waited / 1000}s, balance unchanged\n`);
  }
  console.log(`\n⚠️  Timed out waiting for ${TARGET_NAME} mint. Lock succeeded on Kamet; check relayer (bridge-api on vps2).`);
  process.exit(2);
})().catch((e) => { console.error("E2E ERROR:", e.message); process.exit(1); });
