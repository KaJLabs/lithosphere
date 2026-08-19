const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const OUTPUT_PREFIX = "bnb-ccip";

function gatewaySignerAddress() {
  if (process.env.GATEWAY_SIGNER_ADDRESS) return process.env.GATEWAY_SIGNER_ADDRESS;
  throw new Error("Set the public GATEWAY_SIGNER_ADDRESS before deploying the CCIP resolver.");
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await deployer.provider.getNetwork();
  const balance = await deployer.getBalance();
  const gatewayUrl = process.env.DNNS_GATEWAY_URL || "https://kamet.litho.ai/dnns-gateway/resolve/{sender}/{data}";
  const signer = gatewaySignerAddress();

  if (!hre.ethers.utils.isAddress(signer)) throw new Error(`Invalid gateway signer: ${signer}`);

  console.log("===========================================");
  console.log("  Lithosphere DNNS CCIP Resolver Deployment");
  console.log("===========================================");
  console.log(`  Network:        ${hre.network.name} (${network.chainId})`);
  console.log(`  Deployer:       ${deployer.address}`);
  console.log(`  Balance:        ${hre.ethers.utils.formatEther(balance)}`);
  console.log(`  Gateway URL:    ${gatewayUrl}`);
  console.log(`  Gateway signer: ${signer}`);
  console.log("===========================================\n");

  const Resolver = await hre.ethers.getContractFactory("LithoCCIPResolver");
  const resolver = await Resolver.deploy(gatewayUrl, signer);
  await resolver.deployed();

  const record = {
    network: hre.network.name,
    chainId: network.chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      lithoCCIPResolver: resolver.address,
    },
    config: {
      gatewayUrl,
      gatewaySigner: signer,
    },
  };

  const timestamp = record.timestamp.replace(/[:.]/g, "-").slice(0, 19);
  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${OUTPUT_PREFIX}-${timestamp}.json`), JSON.stringify(record, null, 2));
  fs.writeFileSync(path.join(outDir, `${OUTPUT_PREFIX}-latest.json`), JSON.stringify(record, null, 2));

  console.log(`LithoCCIPResolver deployed: ${resolver.address}`);
  console.log(`Saved deployments/${OUTPUT_PREFIX}-${timestamp}.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
