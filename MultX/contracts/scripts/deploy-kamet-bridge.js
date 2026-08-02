/**
 * Deploy LEP100 tokens + MultXBridge on Kamet Testnet (chain ID 900523)
 *
 * This mirrors the Makalu deployment but targets Kamet and sets up the bridge
 * with the same mock validator addresses used by the bridge-api service.
 *
 * Usage:
 *   DEPLOYER_PRIVATE_KEY=0x... node node_modules/hardhat/internal/cli/cli.js run scripts/deploy-kamet-bridge.js --network litho_kamet
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Same mnemonic as bridge-api/src/services/mockValidator.js
const MOCK_MNEMONIC = "test test test test test test test test test test test junk";

const LEP100_TOKENS = [
  { name: "Wrapped Lithosphere", symbol: "wLITHO", decimals: 18, supply: 1_000_000_000 },
  { name: "Lithosphere LitBTC",  symbol: "LitBTC", decimals: 18, supply: 21_000_000 },
  { name: "Lithosphere Algo",    symbol: "LAX",    decimals: 18, supply: 10_000_000_000 },
  { name: "Jot Art",             symbol: "JOT",    decimals: 18, supply: 1_000_000_000 },
  { name: "Colle AI",            symbol: "COLLE",  decimals: 18, supply: 5_000_000_000 },
  { name: "Imagen Network",      symbol: "IMAGE",  decimals: 18, supply: 10_000_000_000 },
  { name: "AGII",                symbol: "AGII",   decimals: 18, supply: 1_000_000_000 },
  { name: "Built AI",            symbol: "BLDR",   decimals: 18, supply: 1_000_000_000 },
  { name: "FurGPT",              symbol: "FGPT",   decimals: 18, supply: 1_000_000_000 },
  { name: "Mansa AI",            symbol: "MUSA",   decimals: 18, supply: 1_000_000_000 },
];

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await deployer.provider.getNetwork();

  console.log("=".repeat(60));
  console.log("  KAMET TESTNET BRIDGE DEPLOYMENT");
  console.log("=".repeat(60));
  console.log(`Network:  ${hre.network.name} (Chain ID ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);

  const balance = await deployer.getBalance();
  console.log(`Balance:  ${hre.ethers.utils.formatEther(balance)} LITHO\n`);

  if (balance.isZero()) {
    console.error("ERROR: Deployer has 0 balance. Fund the account first.");
    process.exit(1);
  }

  // --- Step 1: Derive mock validator addresses ---
  console.log("--- Step 1: Mock Validator Addresses ---");
  const validatorAddresses = [];
  for (let i = 0; i < 3; i++) {
    const hdPath = `m/44'/60'/0'/0/${i}`;
    const wallet = hre.ethers.Wallet.fromMnemonic(MOCK_MNEMONIC, hdPath);
    validatorAddresses.push(wallet.address);
    console.log(`  Validator ${i}: ${wallet.address}`);
  }

  // --- Step 2: Deploy LEP100 Tokens ---
  console.log("\n--- Step 2: Deploy LEP100 Tokens ---");
  const LEP100Token = await hre.ethers.getContractFactory("LEP100Token");
  const deployedTokens = [];

  for (const token of LEP100_TOKENS) {
    console.log(`  Deploying ${token.name} (${token.symbol})...`);
    try {
      const contract = await LEP100Token.deploy(
        token.name,
        token.symbol,
        token.decimals,
        token.supply,
        { gasLimit: 3_000_000 }
      );
      await contract.deployed();
      console.log(`    ${token.symbol}: ${contract.address}`);
      deployedTokens.push({ ...token, address: contract.address });
    } catch (err) {
      console.error(`    ${token.symbol} FAILED: ${err.message}`);
    }
  }

  // --- Step 3: Deploy MultXBridge ---
  console.log("\n--- Step 3: Deploy MultXBridge ---");
  const signaturesRequired = 2;
  const MultXBridge = await hre.ethers.getContractFactory("MultXBridge");
  const bridge = await MultXBridge.deploy(validatorAddresses, signaturesRequired, { gasLimit: 5_000_000 });
  await bridge.deployed();
  console.log(`  MultXBridge: ${bridge.address}`);

  // --- Step 4: Add supported tokens to bridge ---
  console.log("\n--- Step 4: Add supported tokens to bridge ---");
  for (const token of deployedTokens) {
    try {
      const tx = await bridge.addSupportedToken(token.address, { gasLimit: 100_000 });
      await tx.wait();
      console.log(`  Added ${token.symbol} (${token.address})`);
    } catch (err) {
      console.error(`  Failed to add ${token.symbol}: ${err.message}`);
    }
  }

  // --- Step 5: Save deployment info ---
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const deploymentDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentDir)) fs.mkdirSync(deploymentDir, { recursive: true });

  const wlitho = deployedTokens.find(t => t.symbol === "wLITHO");

  const deploymentInfo = {
    network: hre.network.name,
    chainId: network.chainId,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      MultXBridge: bridge.address,
      tokens: deployedTokens.reduce((acc, t) => { acc[t.symbol] = t.address; return acc; }, {})
    },
    bridge: {
      validators: validatorAddresses,
      signaturesRequired,
      supportedTokens: deployedTokens.map(t => t.address)
    },
    envVars: {
      MULTX_BRIDGE_ADDRESS: bridge.address,
      LITHO_TOKEN_ADDRESS: wlitho ? wlitho.address : "",
      KAMET_RPC_HTTP: "https://rpc-3.litho.ai",
      KAMET_EVM_RPC_URL: "https://rpc-3.litho.ai"
    }
  };

  const deploymentFile = path.join(deploymentDir, `kamet-${timestamp}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

  // --- Summary ---
  console.log("\n" + "=".repeat(60));
  console.log("  DEPLOYMENT SUMMARY — KAMET TESTNET");
  console.log("=".repeat(60));
  console.log(`  Chain ID:     ${network.chainId}`);
  console.log(`  Deployer:     ${deployer.address}`);
  console.log(`  Bridge:       ${bridge.address}`);
  console.log(`  Validators:   ${validatorAddresses.length} (2-of-3 multisig)`);
  console.log();
  console.log("  Tokens:");
  for (const t of deployedTokens) {
    console.log(`    ${t.symbol.padEnd(8)} ${t.address}  (${t.supply.toLocaleString()})`);
  }
  console.log();
  console.log("  Environment variables for docker-compose.bridge.yml:");
  console.log(`    MULTX_BRIDGE_ADDRESS=${bridge.address}`);
  if (wlitho) console.log(`    LITHO_TOKEN_ADDRESS=${wlitho.address}`);
  console.log(`    LITHO_RPC_WS=wss://rpc-3.litho.ai:8546`);
  console.log(`    LITHO_RPC_HTTP=https://rpc-3.litho.ai`);
  console.log();
  console.log(`  Saved to: ${deploymentFile}`);
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
