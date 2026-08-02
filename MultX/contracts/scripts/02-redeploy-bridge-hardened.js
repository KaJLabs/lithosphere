/**
 * Redeploy MultXBridge (hardened) with real validator keys on Kamet Testnet.
 *
 * Prerequisites:
 *   Generate 3 real EVM private keys and fund them via faucet, then set:
 *     VALIDATOR_0_ADDRESS=0x...
 *     VALIDATOR_1_ADDRESS=0x...
 *     VALIDATOR_2_ADDRESS=0x...
 *
 * The bridge reuses all existing LEP100 token addresses — no token redeployment needed.
 *
 * Usage:
 *   DEPLOYER_PRIVATE_KEY=0x... \
 *   VALIDATOR_0_ADDRESS=0x... \
 *   VALIDATOR_1_ADDRESS=0x... \
 *   VALIDATOR_2_ADDRESS=0x... \
 *   npx hardhat run scripts/02-redeploy-bridge-hardened.js --network litho_kamet
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Canonical LEP100 token addresses on Kamet (from faucet-assets.json + DEX config)
const EXISTING_TOKENS = {
  wLITHO: "0xC0FC628e3aB128fe387e7ed5e729bD809C017888",
  LitBTC: "0x3A8D5FdC6c8dA9f14C535424b6F7206eC1996016",
  LAX:    "0xe8f504f9cE5391Fb5968b317f0b24b8A0306ACeb",
  JOT:    "0x6AE14CEb3962664b13c5dEF29EB172De76bd0ac9",
  COLLE:  "0x0573f66cb4bC34618e7AB8a941F7883DD2515dCA",
  IMAGE:  "0x8Ba6E3A0759144245f2939eB54164e32bb78B8E0",
  AGII:   "0x17D506aF1d0Dc2f4f64f15748a5aC46FAd3f06D7",
  BLDR:   "0xF05f1F79273874E554F02ce06585E16132a3B62B",
  FGPT:   "0x2F366c6350A6b211f6D6F847c3D56738C2E847ca",
  MUSA:   "0x17A357262097B4e70acFfe8B71bC61e8bBcc3B42",
  QTT:    "0x16EE7127C9E03e29ca5727e23dd7CB03D283cDBe",
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await deployer.provider.getNetwork();

  console.log("=".repeat(60));
  console.log("  KAMET — HARDENED MULTXBRIDGE REDEPLOYMENT");
  console.log("=".repeat(60));
  console.log(`Network:  ${hre.network.name} (Chain ID ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);

  const balance = await deployer.getBalance();
  console.log(`Balance:  ${hre.ethers.utils.formatEther(balance)} LITHO\n`);

  if (balance.isZero()) {
    console.error("ERROR: Deployer has 0 balance. Fund the account first.");
    process.exit(1);
  }

  // Load real validator addresses from env
  const validatorAddresses = [];
  for (let i = 0; i < 10; i++) {
    const addr = process.env[`VALIDATOR_${i}_ADDRESS`];
    if (!addr) break;
    validatorAddresses.push(addr);
  }

  if (validatorAddresses.length === 0) {
    console.error(
      "ERROR: No validator addresses found.\n" +
      "Set VALIDATOR_0_ADDRESS, VALIDATOR_1_ADDRESS, VALIDATOR_2_ADDRESS in env."
    );
    process.exit(1);
  }

  const signaturesRequired = Math.ceil((validatorAddresses.length * 2) / 3); // 2/3+1 default
  console.log(`Validators (${validatorAddresses.length}, threshold ${signaturesRequired}):`);
  validatorAddresses.forEach((v, i) => console.log(`  Validator ${i}: ${v}`));

  // Deploy hardened MultXBridge
  console.log("\n--- Deploying Hardened MultXBridge ---");
  const MultXBridge = await hre.ethers.getContractFactory("MultXBridge");
  const bridge = await MultXBridge.deploy(validatorAddresses, signaturesRequired, { gasLimit: 6_000_000 });
  await bridge.deployed();
  console.log(`  MultXBridge (hardened): ${bridge.address}`);

  // Register all existing tokens
  console.log("\n--- Adding supported tokens ---");
  const tokenAddresses = Object.values(EXISTING_TOKENS);
  for (const [symbol, address] of Object.entries(EXISTING_TOKENS)) {
    try {
      const tx = await bridge.addSupportedToken(address, { gasLimit: 100_000 });
      await tx.wait();
      console.log(`  Added ${symbol} (${address})`);
    } catch (err) {
      console.error(`  Failed to add ${symbol}: ${err.message}`);
    }
  }

  // Save deployment record
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const deploymentDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentDir)) fs.mkdirSync(deploymentDir, { recursive: true });

  const deploymentInfo = {
    network: hre.network.name,
    chainId: network.chainId,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      MultXBridge: bridge.address,
      tokens: EXISTING_TOKENS,
    },
    bridge: {
      validators: validatorAddresses,
      signaturesRequired,
      supportedTokens: tokenAddresses,
      dailyCaps: "all unlimited (0) — set via setDailyCap() if needed",
    },
  };

  const deploymentFile = path.join(deploymentDir, `kamet-bridge-hardened-${timestamp}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("  DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log(`  MultXBridge (hardened): ${bridge.address}`);
  console.log(`  Validators:             ${validatorAddresses.length} (${signaturesRequired}-of-${validatorAddresses.length})`);
  console.log(`  Supported tokens:       ${tokenAddresses.length}`);
  console.log(`  Saved to:               ${deploymentFile}`);
  console.log();
  console.log("  ── bridge-api .env ──");
  console.log(`  BRIDGE_CONTRACT_ADDRESS=${bridge.address}`);
  console.log(`  LITHO_RPC_HTTP=https://rpc-3.litho.ai`);
  console.log(`  MOCK_VALIDATOR=false`);
  validatorAddresses.forEach((_, i) =>
    console.log(`  VALIDATOR_PRIVATE_KEY_${i}=<key for ${validatorAddresses[i]}>`)
  );
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
