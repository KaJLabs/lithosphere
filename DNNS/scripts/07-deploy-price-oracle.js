const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const parseUsd = (value, fallback) => hre.ethers.utils.parseUnits(String(value || fallback), 18);

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await deployer.provider.getNetwork();
  const lithoUsdOracle = process.env.LITHO_USD_ORACLE;
  if (!lithoUsdOracle || !hre.ethers.utils.isAddress(lithoUsdOracle)) {
    throw new Error("Set LITHO_USD_ORACLE to a Chainlink-style LITHO/USD feed address.");
  }

  const price5Letter = parseUsd(process.env.DNNS_PRICE_5LETTER_USD, "5");
  const price4Letter = parseUsd(process.env.DNNS_PRICE_4LETTER_USD, "20");
  const price3Letter = parseUsd(process.env.DNNS_PRICE_3LETTER_USD, "100");

  console.log("===========================================");
  console.log("  Lithosphere DNNS Stable Price Oracle");
  console.log("===========================================");
  console.log(`  Network:       ${hre.network.name} (${network.chainId})`);
  console.log(`  Deployer:      ${deployer.address}`);
  console.log(`  LITHO/USD:     ${lithoUsdOracle}`);
  console.log(`  5+ letters:    ${hre.ethers.utils.formatUnits(price5Letter, 18)} USD/year`);
  console.log(`  4 letters:     ${hre.ethers.utils.formatUnits(price4Letter, 18)} USD/year`);
  console.log(`  <=3 letters:   ${hre.ethers.utils.formatUnits(price3Letter, 18)} USD/year`);
  console.log("===========================================\n");

  const Oracle = await hre.ethers.getContractFactory("LithoStablePriceOracle");
  const oracle = await Oracle.deploy(lithoUsdOracle, price5Letter, price4Letter, price3Letter);
  await oracle.deployed();

  const record = {
    network: hre.network.name,
    chainId: network.chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      lithoStablePriceOracle: oracle.address,
      lithoUsdOracle,
    },
    config: {
      price5Letter: price5Letter.toString(),
      price4Letter: price4Letter.toString(),
      price3Letter: price3Letter.toString(),
    },
  };

  const timestamp = record.timestamp.replace(/[:.]/g, "-").slice(0, 19);
  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `kamet-price-oracle-${timestamp}.json`), JSON.stringify(record, null, 2));
  fs.writeFileSync(path.join(outDir, "kamet-price-oracle-latest.json"), JSON.stringify(record, null, 2));

  console.log(`LithoStablePriceOracle deployed: ${oracle.address}`);
  console.log(`Saved deployments/kamet-price-oracle-${timestamp}.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
