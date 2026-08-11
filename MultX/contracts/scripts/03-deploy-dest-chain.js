/**
 * Deploy MultXBridgeDest + 12 wrapped LEP100 tokens on a destination chain.
 *
 * Usage:
 *   DEPLOYER_PRIVATE_KEY=0x... \
 *   VALIDATOR_0_ADDRESS=0x... VALIDATOR_1_ADDRESS=0x... VALIDATOR_2_ADDRESS=0x... \
 *   npx hardhat run scripts/03-deploy-dest-chain.js --network sepolia
 *
 * Same validator set as Kamet (so bridge-api can sign for both directions
 * without needing a second key set).
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Canonical LEP100 tokens on Kamet (origin chain 900523).
// Source: bridge-api/faucet-assets.json
const KAMET_LEP100_TOKENS = [
  { name: "DOGE",                 symbol: "DOGE",   decimals: 18, origin: "0x72791d72B6097D487cEC58605A62396c50C08b69" },
  { name: "Wrapped Lithosphere",  symbol: "wLITHO", decimals: 18, origin: "0xC0FC628e3aB128fe387e7ed5e729bD809C017888" },
  { name: "LitBTC",               symbol: "LitBTC", decimals: 18, origin: "0x3A8D5FdC6c8dA9f14C535424b6F7206eC1996016" },
  { name: "LAX",                  symbol: "LAX",    decimals: 18, origin: "0xe8f504f9cE5391Fb5968b317f0b24b8A0306ACeb" },
  { name: "JOT",                  symbol: "JOT",    decimals: 18, origin: "0x6AE14CEb3962664b13c5dEF29EB172De76bd0ac9" },
  { name: "COLLE",                symbol: "COLLE",  decimals: 18, origin: "0x0573f66cb4bC34618e7AB8a941F7883DD2515dCA" },
  { name: "IMAGE",                symbol: "IMAGE",  decimals: 18, origin: "0x8Ba6E3A0759144245f2939eB54164e32bb78B8E0" },
  { name: "AGII",                 symbol: "AGII",   decimals: 18, origin: "0x17D506aF1d0Dc2f4f64f15748a5aC46FAd3f06D7" },
  { name: "BLDR",                 symbol: "BLDR",   decimals: 18, origin: "0xF05f1F79273874E554F02ce06585E16132a3B62B" },
  { name: "FGPT",                 symbol: "FGPT",   decimals: 18, origin: "0x2F366c6350A6b211f6D6F847c3D56738C2E847ca" },
  { name: "MUSA",                 symbol: "MUSA",   decimals: 18, origin: "0x17A357262097B4e70acFfe8B71bC61e8bBcc3B42" },
  { name: "Quantts",              symbol: "QTT",    decimals: 18, origin: "0x16EE7127C9E03e29ca5727e23dd7CB03D283cDBe" },
];

const KAMET_CHAIN_ID = 900523;

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await deployer.provider.getNetwork();

  console.log("=".repeat(60));
  console.log(`  MULTX BRIDGE DEST DEPLOYMENT — ${hre.network.name}`);
  console.log("=".repeat(60));
  console.log(`Network:  ${hre.network.name} (Chain ID ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);

  const balance = await deployer.getBalance();
  console.log(`Balance:  ${hre.ethers.utils.formatEther(balance)}\n`);

  if (balance.isZero()) {
    console.error("ERROR: Deployer has 0 balance. Fund the account first.");
    process.exit(1);
  }

  // Validator addresses (same set as Kamet)
  const validatorAddresses = [];
  for (let i = 0; i < 10; i++) {
    const addr = process.env[`VALIDATOR_${i}_ADDRESS`];
    if (!addr) break;
    validatorAddresses.push(addr);
  }
  if (validatorAddresses.length === 0) {
    console.error("ERROR: Set VALIDATOR_0_ADDRESS / VALIDATOR_1_ADDRESS / VALIDATOR_2_ADDRESS");
    process.exit(1);
  }
  const signaturesRequired = Math.ceil((validatorAddresses.length * 2) / 3);
  console.log(`Validators (${validatorAddresses.length}, threshold ${signaturesRequired}):`);
  validatorAddresses.forEach((v, i) => console.log(`  Validator ${i}: ${v}`));

  // Step 1 — Deploy MultXBridgeDest
  console.log("\n--- Step 1: Deploy MultXBridgeDest ---");
  const Bridge = await hre.ethers.getContractFactory("MultXBridgeDest");
  const bridge = await Bridge.deploy(validatorAddresses, signaturesRequired, { gasLimit: 6_000_000 });
  await bridge.deployed();
  console.log(`  MultXBridgeDest: ${bridge.address}`);

  // Step 2 — Deploy 12 WrappedLEP100 tokens
  console.log("\n--- Step 2: Deploy 12 WrappedLEP100 tokens ---");
  const Wrapped = await hre.ethers.getContractFactory("WrappedLEP100");
  const deployedTokens = [];

  for (const t of KAMET_LEP100_TOKENS) {
    try {
      const wToken = await Wrapped.deploy(
        `Wrapped ${t.name}`,
        `w${t.symbol}`,
        t.decimals,
        bridge.address,
        t.origin,
        KAMET_CHAIN_ID,
        { gasLimit: 3_000_000 }
      );
      await wToken.deployed();
      console.log(`  w${t.symbol.padEnd(8)} ${wToken.address}  (origin ${t.origin})`);
      deployedTokens.push({ ...t, wrappedAddress: wToken.address });
    } catch (err) {
      console.error(`  w${t.symbol} FAILED: ${err.message.slice(0, 100)}`);
    }
  }

  // Step 3 — Register wrapped tokens with the bridge
  console.log("\n--- Step 3: Register wrapped tokens with bridge ---");
  for (const t of deployedTokens) {
    try {
      const tx = await bridge.addSupportedToken(t.wrappedAddress, { gasLimit: 100_000 });
      await tx.wait();
      console.log(`  + w${t.symbol}`);
    } catch (err) {
      console.error(`  FAILED w${t.symbol}: ${err.message.slice(0, 80)}`);
    }
  }

  // Step 4 — Save deployment record
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const deploymentDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentDir)) fs.mkdirSync(deploymentDir, { recursive: true });

  const record = {
    network: hre.network.name,
    chainId: network.chainId,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      MultXBridgeDest: bridge.address,
      wrappedTokens: deployedTokens.reduce((acc, t) => {
        acc[`w${t.symbol}`] = {
          address: t.wrappedAddress,
          origin: t.origin,
          originChainId: KAMET_CHAIN_ID,
          decimals: t.decimals,
        };
        return acc;
      }, {}),
    },
    bridge: {
      validators: validatorAddresses,
      signaturesRequired,
      supportedTokens: deployedTokens.map((t) => t.wrappedAddress),
    },
  };

  const file = path.join(deploymentDir, `${hre.network.name}-bridge-${timestamp}.json`);
  const latestFile = path.join(deploymentDir, `${hre.network.name}-bridge-latest.json`);
  fs.writeFileSync(file, JSON.stringify(record, null, 2));
  fs.writeFileSync(latestFile, JSON.stringify(record, null, 2));

  console.log("\n" + "=".repeat(60));
  console.log("  DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log(`  Network:          ${hre.network.name} (${network.chainId})`);
  console.log(`  MultXBridgeDest:  ${bridge.address}`);
  console.log(`  Wrapped tokens:   ${deployedTokens.length}`);
  console.log(`  Saved to:         ${file}`);
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
