/**
 * Wire an existing MultX bridge into the Safe + Timelock + guardian design:
 *   1. setPauseGuardian(GUARDIAN_ADDRESS)   (must run while the caller is owner)
 *   2. transferOwnership(NEW_OWNER)          (the Timelock, or the Safe directly)
 *
 * Order matters: the guardian is set FIRST (while the deployer/current key still
 * owns the bridge), then ownership is handed off. After transfer, any further
 * guardian/config change must go through the new owner (Timelock -> Safe).
 *
 * Env:
 *   DEPLOYER_PRIVATE_KEY=0x...   (the CURRENT bridge owner)
 *   BRIDGE_ADDRESS=0x...         (MultXBridge or MultXBridgeDest)
 *   GUARDIAN_ADDRESS=0x...       (fast pause key; can be an EOA or a 2-of-3 Safe)
 *   NEW_OWNER=0x...              (the Timelock address, or the Safe address)
 *   DRY_RUN=true                 (optional; print actions, send nothing)
 *
 * Usage:
 *   DEPLOYER_PRIVATE_KEY=0x... BRIDGE_ADDRESS=0x... GUARDIAN_ADDRESS=0x... NEW_OWNER=0x... \
 *     npx hardhat run scripts/governance/wire-bridge-governance.js --network litho_kamet
 */
const hre = require("hardhat");

async function main() {
  const ethers = hre.ethers;
  const [signer] = await ethers.getSigners();

  const bridgeAddr = process.env.BRIDGE_ADDRESS;
  const guardian = process.env.GUARDIAN_ADDRESS;
  const newOwner = process.env.NEW_OWNER;
  const dryRun = String(process.env.DRY_RUN || "").toLowerCase() === "true";

  for (const [k, v] of Object.entries({ BRIDGE_ADDRESS: bridgeAddr, GUARDIAN_ADDRESS: guardian, NEW_OWNER: newOwner })) {
    if (!v || !ethers.utils.isAddress(v)) throw new Error(`${k} must be a valid address`);
  }

  const bridge = await ethers.getContractAt("MultXBridge", bridgeAddr);
  const currentOwner = await bridge.owner();
  console.log("Network      :", hre.network.name);
  console.log("Caller       :", signer.address);
  console.log("Bridge       :", bridgeAddr);
  console.log("Current owner:", currentOwner);
  console.log("Guardian ->  :", guardian);
  console.log("New owner -> :", newOwner);

  if (currentOwner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`Caller is not the current owner (${currentOwner}); cannot wire governance`);
  }
  if (dryRun) { console.log("DRY_RUN — no transactions sent."); return; }

  console.log("1/2 setPauseGuardian...");
  await (await bridge.setPauseGuardian(guardian)).wait();
  console.log("    guardian set:", await bridge.pauseGuardian());

  console.log("2/2 transferOwnership...");
  await (await bridge.transferOwnership(newOwner)).wait();
  console.log("    owner now:", await bridge.owner());

  console.log("Done. Verify: owner == NEW_OWNER and pauseGuardian == GUARDIAN_ADDRESS above.");
}

main().catch((e) => { console.error(e); process.exit(1); });
