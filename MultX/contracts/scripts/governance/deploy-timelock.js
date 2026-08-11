/**
 * Deploy the GovTimelock (OpenZeppelin TimelockController) that will own the
 * MultX bridge. Proposer/canceller/executor = the Gnosis Safe; no admin.
 *
 * Prerequisites:
 *   - A Gnosis Safe already created on the target chain (see
 *     docs/operations/GOVERNANCE_MIGRATION.md for the Safe bootstrap on Kamet).
 *
 * Env:
 *   DEPLOYER_PRIVATE_KEY=0x...        (funded deployer)
 *   SAFE_ADDRESS=0x...               (the M-of-N Safe; becomes proposer+executor)
 *   TIMELOCK_DELAY=172800            (optional; seconds, default 48h)
 *   OPEN_EXECUTION=true              (optional; if set, anyone may execute after
 *                                     the delay — executor = address(0))
 *
 * Usage:
 *   DEPLOYER_PRIVATE_KEY=0x... SAFE_ADDRESS=0x... \
 *     npx hardhat run scripts/governance/deploy-timelock.js --network litho_kamet
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const ethers = hre.ethers;
  const [deployer] = await ethers.getSigners();

  const safe = process.env.SAFE_ADDRESS;
  if (!safe || !ethers.utils.isAddress(safe)) {
    throw new Error("SAFE_ADDRESS must be a valid address (the M-of-N Safe)");
  }
  const delay = Number(process.env.TIMELOCK_DELAY || 48 * 60 * 60);
  const openExecution = String(process.env.OPEN_EXECUTION || "").toLowerCase() === "true";

  const proposers = [safe];
  const executors = openExecution ? [ethers.constants.AddressZero] : [safe];
  const admin = ethers.constants.AddressZero; // self-administered, no super-admin

  console.log("Network :", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("Safe    :", safe);
  console.log("Delay   :", delay, "s");
  console.log("Executor:", openExecution ? "open (anyone after delay)" : safe);

  const GovTimelock = await ethers.getContractFactory("GovTimelock");
  const timelock = await GovTimelock.deploy(delay, proposers, executors, admin);
  await timelock.deployed();
  console.log("GovTimelock deployed:", timelock.address);

  const out = {
    network: hre.network.name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    timelock: timelock.address,
    safe,
    minDelaySeconds: delay,
    proposers,
    executors,
    admin,
    deployedBy: deployer.address,
    deployedAt: new Date().toISOString(),
  };
  const dir = path.join(__dirname, "..", "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${hre.network.name}-timelock-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log("Record:", file);
}

main().catch((e) => { console.error(e); process.exit(1); });
