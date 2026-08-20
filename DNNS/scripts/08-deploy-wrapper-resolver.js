const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const ResolverArt = require("@ensdomains/ens-contracts/artifacts/contracts/resolvers/PublicResolver.sol/PublicResolver.json");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8"));
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await deployer.provider.getNetwork();
  const core = readJson("deployments/kamet-latest.json");
  const wrapperRecord = readJson("deployments/kamet-namewrapper-latest.json");

  const registry = core.contracts.registry;
  const controller = core.contracts.controller;
  const reverseRegistrar = core.contracts.reverseRegistrar;
  const nameWrapper = wrapperRecord.contracts.nameWrapper;

  console.log("Deploying wrapper-aware PublicResolver...");
  console.log(`  Network:        chainId ${network.chainId}`);
  console.log(`  Deployer:       ${deployer.address}`);
  console.log(`  Registry:       ${registry}`);
  console.log(`  NameWrapper:    ${nameWrapper}`);

  const factory = new hre.ethers.ContractFactory(ResolverArt.abi, ResolverArt.bytecode, deployer);
  const resolver = await factory.deploy(
    registry,
    nameWrapper,
    controller,
    reverseRegistrar,
    { gasLimit: 6_000_000 }
  );
  await resolver.deployed();
  console.log(`  PublicResolver: ${resolver.address}`);

  let reverseDefaultResolverTxHash = null;
  try {
    const reverse = new hre.ethers.Contract(
      reverseRegistrar,
      ["function setDefaultResolver(address resolver)"],
      deployer
    );
    const tx = await reverse.setDefaultResolver(resolver.address, { gasLimit: 200_000 });
    const receipt = await tx.wait();
    reverseDefaultResolverTxHash = receipt.transactionHash;
    console.log("  Reverse default resolver updated");
  } catch (err) {
    console.log(`  Reverse default resolver not updated: ${err.reason || err.message}`);
  }

  const record = {
    network: hre.network.name,
    chainId: network.chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      publicResolver: resolver.address,
      registry,
      nameWrapper,
      controller,
      reverseRegistrar,
    },
    transactions: {
      reverseDefaultResolver: reverseDefaultResolverTxHash,
    },
    previousPublicResolver: core.contracts.publicResolver || ZERO_ADDRESS,
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const fileName = `kamet-wrapper-resolver-${record.timestamp.replace(/[:.]/g, "-").slice(0, 19)}.json`;
  fs.writeFileSync(path.join(outDir, fileName), JSON.stringify(record, null, 2));
  fs.writeFileSync(path.join(outDir, "kamet-wrapper-resolver-latest.json"), JSON.stringify(record, null, 2));

  console.log(`Saved deployments/${fileName}`);
  console.log("Saved deployments/kamet-wrapper-resolver-latest.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
