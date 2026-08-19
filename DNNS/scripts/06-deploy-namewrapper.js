const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const NameWrapperArt = require("@ensdomains/ens-contracts/artifacts/contracts/wrapper/NameWrapper.sol/NameWrapper.json");
const StaticMetadataArt = require("@ensdomains/ens-contracts/artifacts/contracts/wrapper/StaticMetadataService.sol/StaticMetadataService.json");
const BaseRegistrarArt = require("@ensdomains/ens-contracts/artifacts/contracts/ethregistrar/BaseRegistrarImplementation.sol/BaseRegistrarImplementation.json");

async function deploy(artifact, args, label, signer) {
  const factory = new hre.ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  console.log(`Deploying ${label}...`);
  const contract = await factory.deploy(...args);
  await contract.deployed();
  console.log(`  ${label}: ${contract.address}`);
  return contract;
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await deployer.provider.getNetwork();
  const deployment = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", "kamet-latest.json"), "utf-8"));
  const metadataUri = process.env.DNNS_METADATA_URI || "https://names.litho.ai/metadata/{id}";

  const registry = deployment.contracts.registry;
  const baseRegistrar = deployment.contracts.baseRegistrar;

  console.log("===========================================");
  console.log("  Lithosphere DNNS NameWrapper Deployment");
  console.log("===========================================");
  console.log(`  Network:        ${hre.network.name} (${network.chainId})`);
  console.log(`  Deployer:       ${deployer.address}`);
  console.log(`  Registry:       ${registry}`);
  console.log(`  BaseRegistrar:  ${baseRegistrar}`);
  console.log(`  Metadata URI:   ${metadataUri}`);
  console.log("===========================================\n");

  const metadataService = await deploy(StaticMetadataArt, [metadataUri], "StaticMetadataService", deployer);
  const nameWrapper = await deploy(NameWrapperArt, [registry, baseRegistrar, metadataService.address], "NameWrapper", deployer);

  const registrar = new hre.ethers.Contract(baseRegistrar, BaseRegistrarArt.abi, deployer);
  const approvalTx = await registrar.setApprovalForAll(nameWrapper.address, true);
  await approvalTx.wait();
  console.log("  Deployer approved NameWrapper for owned .litho ERC721 names");

  const record = {
    network: hre.network.name,
    chainId: network.chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      nameWrapper: nameWrapper.address,
      metadataService: metadataService.address,
    },
    config: {
      metadataUri,
      registry,
      baseRegistrar,
      note: "Existing names must be wrapped by their owners before subdomain issuance is enabled for each parent.",
    },
  };

  const timestamp = record.timestamp.replace(/[:.]/g, "-").slice(0, 19);
  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `kamet-namewrapper-${timestamp}.json`), JSON.stringify(record, null, 2));
  fs.writeFileSync(path.join(outDir, "kamet-namewrapper-latest.json"), JSON.stringify(record, null, 2));

  console.log(`Saved deployments/kamet-namewrapper-${timestamp}.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
