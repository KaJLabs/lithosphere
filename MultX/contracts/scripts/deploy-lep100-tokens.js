/**
 * Deploy LEP100 tokens on Lithosphere
 *
 * Usage:
 *   DEPLOYER_PRIVATE_KEY=0x... npx hardhat run scripts/deploy-lep100-tokens.js --network litho_kamet
 */

const hre = require("hardhat");

const TOKENS = [
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
  console.log("Deployer:", deployer.address);

  const balance = await deployer.getBalance();
  console.log("Balance:", hre.ethers.utils.formatEther(balance), "LITHO\n");

  if (balance.isZero()) {
    console.error("ERROR: Deployer has 0 balance. Send LITHO to", deployer.address, "first.");
    process.exit(1);
  }

  const LEP100Token = await hre.ethers.getContractFactory("LEP100Token");
  const deployed = [];

  for (const token of TOKENS) {
    console.log(`Deploying ${token.name} (${token.symbol})...`);
    try {
      const contract = await LEP100Token.deploy(
        token.name,
        token.symbol,
        token.decimals,
        token.supply,
        { gasLimit: 3_000_000 }
      );
      await contract.deployed();
      console.log(`  ✓ ${token.symbol}: ${contract.address}`);
      deployed.push({ ...token, address: contract.address });
    } catch (err) {
      console.error(`  ✗ ${token.symbol} FAILED:`, err.message);
    }
  }

  console.log("\n========================================");
  console.log("  LEP100 Token Deployment Summary");
  console.log("========================================");
  console.log(`Network:  Lithosphere (Chain ID ${(await deployer.provider.getNetwork()).chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Deployed: ${deployed.length}/${TOKENS.length}\n`);

  for (const t of deployed) {
    console.log(`  ${t.symbol.padEnd(8)} ${t.address}  (${t.supply.toLocaleString()} supply)`);
  }

  console.log("\n========================================");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
