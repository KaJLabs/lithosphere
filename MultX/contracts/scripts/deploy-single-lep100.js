/**
 * Deploy a single LEP100 token on Lithosphere Kamet.
 *
 * Usage:
 *   TOKEN_NAME="Quantts" TOKEN_SYMBOL="QTT" TOKEN_DECIMALS=18 TOKEN_SUPPLY=1000000000 \
 *     npx hardhat run scripts/deploy-single-lep100.js --network litho_kamet
 */

const hre = require("hardhat");
const fs   = require("fs");
const path = require("path");

async function main() {
  const name     = process.env.TOKEN_NAME     || "Unknown Token";
  const symbol   = process.env.TOKEN_SYMBOL   || "UNK";
  const decimals = Number(process.env.TOKEN_DECIMALS ?? 18);
  const supply   = Number(process.env.TOKEN_SUPPLY   || 1_000_000_000);

  const [deployer] = await hre.ethers.getSigners();
  const network    = await deployer.provider.getNetwork();
  const balance    = await deployer.getBalance();

  console.log("===========================================");
  console.log("  Single LEP100 Deployment");
  console.log("===========================================");
  console.log(`  Token:    ${name} (${symbol})`);
  console.log(`  Decimals: ${decimals}`);
  console.log(`  Supply:   ${supply.toLocaleString()}`);
  console.log(`  Network:  chainId ${network.chainId}`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Balance:  ${hre.ethers.utils.formatEther(balance)} LITHO`);
  console.log("===========================================\n");

  if (balance.isZero()) {
    console.error("ERROR: Deployer has 0 balance.");
    process.exit(1);
  }

  const LEP100Token = await hre.ethers.getContractFactory("LEP100Token");
  console.log(`Deploying ${symbol}...`);
  const contract = await LEP100Token.deploy(name, symbol, decimals, supply, {
    gasLimit: 3_000_000,
  });
  await contract.deployed();
  console.log(`✓ ${symbol} deployed: ${contract.address}\n`);

  // Trigger a zero-value transfer so the indexer picks up the contract.
  try {
    const tx = await contract.transfer(deployer.address, 0);
    await tx.wait();
    console.log("✓ Indexer registration transfer sent.");
  } catch {
    console.log("(Indexer transfer skipped — not critical)");
  }

  const record = {
    network:   `kamet-${network.chainId}`,
    chainId:   network.chainId,
    deployer:  deployer.address,
    timestamp: new Date().toISOString(),
    tokens: [{ name, symbol, decimals, supply, address: contract.address }],
  };

  const filename = `qtt-kamet-${record.timestamp.replace(/[:.]/g, "-").slice(0, 19)}.json`;
  const outPath  = path.join(__dirname, "..", "deployments", filename);
  fs.writeFileSync(outPath, JSON.stringify(record, null, 2));
  console.log(`✓ Deployment record saved: deployments/${filename}`);
  console.log("\n===========================================");
  console.log(`  ${symbol}: ${contract.address}`);
  console.log("===========================================");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
