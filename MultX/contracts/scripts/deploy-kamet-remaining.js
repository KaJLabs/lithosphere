/**
 * Deploy remaining LEP100 tokens + MultXBridge on Kamet
 * Continues from where deploy-kamet-bridge.js left off (5 tokens deployed, 5 remaining + bridge)
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const MOCK_MNEMONIC = "test test test test test test test test test test test junk";

// Already deployed on Kamet:
const DEPLOYED = {
  wLITHO: "0x4D1fc3b424CF86aeF2B2fa503acf97eB1bFb88a2",
  LitBTC: "0x12C9d1358edb0DBe13E2B8817B3c32899C2C75bE",
  LAX:    "0x508a1cB83949C9E0EB5FE698d11438EF55bFb5E1",
  JOT:    "0xED604cCD5F6097f3459b1D550133Bb50e79E3BAA",
  COLLE:  "0xCD9E54Ff1628AAB482376B853667f47E72c2a71c"
};

// Remaining tokens to deploy:
const REMAINING_TOKENS = [
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
  console.log("  KAMET — DEPLOY REMAINING TOKENS + BRIDGE");
  console.log("=".repeat(60));
  console.log(`Deployer: ${deployer.address}`);
  const balance = await deployer.getBalance();
  console.log(`Balance:  ${hre.ethers.utils.formatEther(balance)} LITHO`);
  console.log(`Already deployed: ${Object.keys(DEPLOYED).join(", ")}`);
  console.log();

  // Deploy remaining tokens
  console.log("--- Deploy Remaining Tokens ---");
  const LEP100Token = await hre.ethers.getContractFactory("LEP100Token");
  const newTokens = [];

  for (const token of REMAINING_TOKENS) {
    console.log(`  Deploying ${token.symbol}...`);
    try {
      const contract = await LEP100Token.deploy(token.name, token.symbol, token.decimals, token.supply, { gasLimit: 3_000_000 });
      await contract.deployed();
      console.log(`    ${token.symbol}: ${contract.address}`);
      newTokens.push({ ...token, address: contract.address });
    } catch (err) {
      console.error(`    ${token.symbol} FAILED: ${err.message}`);
    }
  }

  // All tokens
  const allTokens = { ...DEPLOYED };
  for (const t of newTokens) allTokens[t.symbol] = t.address;

  // Deploy MultXBridge
  console.log("\n--- Deploy MultXBridge ---");
  const validatorAddresses = [];
  for (let i = 0; i < 3; i++) {
    const wallet = hre.ethers.Wallet.fromMnemonic(MOCK_MNEMONIC, `m/44'/60'/0'/0/${i}`);
    validatorAddresses.push(wallet.address);
    console.log(`  Validator ${i}: ${wallet.address}`);
  }

  const MultXBridge = await hre.ethers.getContractFactory("MultXBridge");
  const bridge = await MultXBridge.deploy(validatorAddresses, 2, { gasLimit: 5_000_000 });
  await bridge.deployed();
  console.log(`  MultXBridge: ${bridge.address}`);

  // Add ALL tokens to bridge
  console.log("\n--- Add tokens to bridge ---");
  for (const [symbol, addr] of Object.entries(allTokens)) {
    try {
      const tx = await bridge.addSupportedToken(addr, { gasLimit: 100_000 });
      await tx.wait();
      console.log(`  Added ${symbol} (${addr})`);
    } catch (err) {
      console.error(`  Failed ${symbol}: ${err.message}`);
    }
  }

  // Save deployment
  const deploymentDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentDir)) fs.mkdirSync(deploymentDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const info = {
    network: hre.network.name,
    chainId: network.chainId,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: { MultXBridge: bridge.address, tokens: allTokens },
    bridge: { validators: validatorAddresses, signaturesRequired: 2, supportedTokens: Object.values(allTokens) }
  };
  const file = path.join(deploymentDir, `kamet-${timestamp}.json`);
  fs.writeFileSync(file, JSON.stringify(info, null, 2));

  console.log("\n" + "=".repeat(60));
  console.log("  DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log(`  Bridge: ${bridge.address}`);
  console.log("  Tokens:");
  for (const [s, a] of Object.entries(allTokens)) console.log(`    ${s.padEnd(8)} ${a}`);
  console.log(`\n  MULTX_BRIDGE_ADDRESS=${bridge.address}`);
  console.log(`  LITHO_TOKEN_ADDRESS=${allTokens.wLITHO}`);
  console.log(`  Saved: ${file}`);
  console.log("=".repeat(60));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
