/**
 * Fix the Makalu MultXBridge validator set to MATCH the live Kamet bridge.
 *
 * WHY: the single bridge-api signs every chain with the same KMS key set. The
 * Makalu bridge was deployed with the stale 3-key / 2-of-3 set from an old
 * deployment record, but the live Kamet bridge (and the bridge-api signer) was
 * rotated to a 7-key / 5-of-7 KMS set. MultXBridge.releaseTokens REVERTS on any
 * signature from a non-validator, so Makalu releases fail until the sets match.
 *
 * This script reads the CURRENT validator set + threshold from the live Kamet
 * bridge and applies the identical set to Makalu via setValidatorSet() — so it
 * stays correct even if Kamet is rotated again. Must be run by the Makalu
 * bridge OWNER (the deployer, 0x10ed…4eadF).
 *
 * Usage:
 *   DEPLOYER_PRIVATE_KEY=0x... \
 *   npx hardhat run scripts/fix-makalu-validator-set.js --network litho_makalu
 */

throw new Error('Archived KMS-era script: execution is forbidden');
const hre = require("hardhat");

const MAKALU_BRIDGE = process.env.BRIDGE_CONTRACT_MAKALU || "0x5832D5E609c6690f74c7683606Eb20F89ff096a6";
const KAMET_BRIDGE  = process.env.BRIDGE_CONTRACT_ADDRESS || "0x3a896BDF3a1088287FA84aB5a43bB30e2535F263";
const KAMET_RPC     = process.env.KAMET_RPC_HTTP || "https://rpc-3.litho.ai";

const VIEW_ABI = [
  "function getValidators() view returns (address[])",
  "function signaturesRequired() view returns (uint256)",
  "function owner() view returns (address)",
];

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const net = await signer.provider.getNetwork();
  console.log("=".repeat(60));
  console.log("  FIX MAKALU VALIDATOR SET → mirror live Kamet");
  console.log("=".repeat(60));
  console.log(`Network:  ${hre.network.name} (${net.chainId})`);
  console.log(`Signer:   ${signer.address}`);
  if (net.chainId !== 700777) {
    console.error("ERROR: expected Makalu 700777. Run with --network litho_makalu.");
    process.exit(1);
  }

  // 1) Read the authoritative set from the live Kamet bridge
  const kProvider = new hre.ethers.providers.JsonRpcProvider(KAMET_RPC);
  const kamet = new hre.ethers.Contract(KAMET_BRIDGE, VIEW_ABI, kProvider);
  const kValidators = await kamet.getValidators();
  const kThreshold = (await kamet.signaturesRequired()).toNumber();
  console.log(`\nLive Kamet set (${kValidators.length}, threshold ${kThreshold}):`);
  kValidators.forEach((v, i) => console.log(`  ${i}: ${v}`));

  // 2) Current Makalu set (before)
  const makalu = await hre.ethers.getContractAt("MultXBridge", MAKALU_BRIDGE, signer);
  const owner = await makalu.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error(`ERROR: signer ${signer.address} is not the Makalu bridge owner (${owner}).`);
    process.exit(1);
  }
  const before = await makalu.getValidators();
  console.log(`\nMakalu set BEFORE (${before.length}, threshold ${(await makalu.signaturesRequired()).toNumber()}):`);
  before.forEach((v, i) => console.log(`  ${i}: ${v}`));

  // 3) Already correct?
  const same =
    before.length === kValidators.length &&
    before.map((a) => a.toLowerCase()).every((a, i) => a === kValidators[i].toLowerCase());
  if (same) {
    console.log("\nAlready matches Kamet — nothing to do.");
    return;
  }

  // 4) Apply
  console.log(`\n--- setValidatorSet(${kValidators.length} validators, ${kThreshold}) ---`);
  const tx = await makalu.setValidatorSet(kValidators, kThreshold, { gasLimit: 1_500_000 });
  console.log(`  tx: ${tx.hash}`);
  await tx.wait();

  // 5) Verify
  const after = await makalu.getValidators();
  const afterThreshold = (await makalu.signaturesRequired()).toNumber();
  const ok =
    after.length === kValidators.length &&
    after.map((a) => a.toLowerCase()).every((a, i) => a === kValidators[i].toLowerCase()) &&
    afterThreshold === kThreshold;
  console.log(`\nMakalu set AFTER (${after.length}, threshold ${afterThreshold}): ${ok ? "✅ matches Kamet" : "❌ MISMATCH"}`);
  if (!ok) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
