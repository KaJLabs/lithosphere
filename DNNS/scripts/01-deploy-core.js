/**
 * Deploy ENS-fork DNNS to Lithosphere Kamet (chainId 900523).
 *
 *   ENSRegistry
 *   ZeroPriceOracle (free pricing for testnet v0)
 *   ReverseRegistrar
 *   BaseRegistrarImplementation  (manages .litho 2LD as ERC721)
 *   ETHRegistrarController       (commit-reveal registration entry point)
 *   PublicResolver               (default resolver for new registrations)
 *
 * v0 scope: Kamet only, no NameWrapper, no subdomains, free pricing.
 *
 * Usage:
 *   Inject DNNS_DEPLOYER_PRIVATE_KEY through the approved secret manager, then:
 *   DNNS_DEPLOYMENT_APPROVED=true npx hardhat run scripts/01-deploy-core.js --network litho_kamet
 */
const fs   = require("fs");
const path = require("path");
const hre  = require("hardhat");

const RegistryArt           = require("@ensdomains/ens-contracts/artifacts/contracts/registry/ENSRegistry.sol/ENSRegistry.json");
const BaseRegistrarArt      = require("@ensdomains/ens-contracts/artifacts/contracts/ethregistrar/BaseRegistrarImplementation.sol/BaseRegistrarImplementation.json");
const ResolverArt           = require("@ensdomains/ens-contracts/artifacts/contracts/resolvers/PublicResolver.sol/PublicResolver.json");
const ReverseRegistrarArt   = require("@ensdomains/ens-contracts/artifacts/contracts/reverseRegistrar/ReverseRegistrar.sol/ReverseRegistrar.json");
// Compiled in this package: ZeroPriceOracle + LithoRegistrarController
// (skip ETHRegistrarController — it requires NameWrapper, which hard-codes .eth)
const ZeroPriceArt          = require("../artifacts/contracts/ZeroPriceOracle.sol/ZeroPriceOracle.json");
const ControllerArt         = require("../artifacts/contracts/LithoRegistrarController.sol/LithoRegistrarController.json");

const TLD                = "litho";
const ZERO_ADDRESS       = "0x0000000000000000000000000000000000000000";
const ZERO_BYTES32       = "0x0000000000000000000000000000000000000000000000000000000000000000";
const MIN_COMMITMENT_AGE = 60;       // seconds
const MAX_COMMITMENT_AGE = 86400;    // 1 day

function namehash(name) {
  let node = ZERO_BYTES32;
  if (!name) return node;
  const labels = name.split(".").reverse();
  for (const label of labels) {
    const labelHash = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes(label));
    node = hre.ethers.utils.keccak256(
      hre.ethers.utils.solidityPack(["bytes32", "bytes32"], [node, labelHash])
    );
  }
  return node;
}

function labelhash(label) {
  return hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes(label));
}

async function deploy(artifact, args, label, signer) {
  const factory = new hre.ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  console.log(`Deploying ${label}...`);
  const c = await factory.deploy(...args, { gasLimit: 6_000_000 });
  await c.deployed();
  console.log(`  ✓ ${label}: ${c.address}`);
  return c;
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network    = await deployer.provider.getNetwork();
  const balance    = await deployer.getBalance();
  const tldNode    = namehash(TLD);
  const reverseNode = namehash("reverse");
  const addrReverseNode = namehash("addr.reverse");

  console.log("===========================================");
  console.log("  Lithosphere DNNS Core Deployment — Kamet");
  console.log("===========================================");
  console.log(`  Network:      chainId ${network.chainId}`);
  console.log(`  Deployer:     ${deployer.address}`);
  console.log(`  Balance:      ${hre.ethers.utils.formatEther(balance)} LITHO`);
  console.log(`  TLD:          .${TLD}`);
  console.log(`  TLD node:     ${tldNode}`);
  console.log("===========================================\n");

  // 1. Registry
  const registry = await deploy(RegistryArt, [], "ENSRegistry", deployer);

  // 2. Zero price oracle (free pricing for testnet)
  const oracle = await deploy(ZeroPriceArt, [], "ZeroPriceOracle", deployer);

  // 3. Set up reverse: deployer owns "reverse", reverseRegistrar owns "addr.reverse"
  console.log("Setting up reverse subdomain ownership...");
  let tx = await registry.setSubnodeOwner(ZERO_BYTES32, labelhash("reverse"), deployer.address, { gasLimit: 200_000 });
  await tx.wait();
  console.log("  ✓ deployer owns .reverse");

  // 4. Reverse registrar (must be deployed after registry)
  const reverseRegistrar = await deploy(ReverseRegistrarArt, [registry.address], "ReverseRegistrar", deployer);

  // Set reverseRegistrar as owner of addr.reverse
  tx = await registry.setSubnodeOwner(reverseNode, labelhash("addr"), reverseRegistrar.address, { gasLimit: 200_000 });
  await tx.wait();
  console.log("  ✓ ReverseRegistrar owns addr.reverse");

  // 5. Base registrar for .litho
  const baseRegistrar = await deploy(
    BaseRegistrarArt,
    [registry.address, tldNode],
    "BaseRegistrarImplementation",
    deployer
  );

  // Transfer TLD to BaseRegistrar
  console.log("Transferring .litho TLD ownership to BaseRegistrar...");
  tx = await registry.setSubnodeOwner(ZERO_BYTES32, labelhash(TLD), baseRegistrar.address, { gasLimit: 200_000 });
  await tx.wait();
  console.log("  ✓ BaseRegistrar owns .litho TLD");

  // 6. Litho-native registrar controller (no NameWrapper — it hardcodes .eth)
  const controller = await deploy(
    ControllerArt,
    [
      baseRegistrar.address,
      oracle.address,
      MIN_COMMITMENT_AGE,
      MAX_COMMITMENT_AGE,
      registry.address,
      tldNode,
    ],
    "LithoRegistrarController",
    deployer
  );

  // Wire controller ↔ baseRegistrar / reverseRegistrar
  tx = await baseRegistrar.addController(controller.address, { gasLimit: 200_000 });
  await tx.wait();
  console.log("  ✓ Controller authorized on BaseRegistrar");

  tx = await reverseRegistrar.setController(controller.address, true, { gasLimit: 200_000 });
  await tx.wait();
  console.log("  ✓ Controller authorized on ReverseRegistrar");

  // 7. Public resolver
  const publicResolver = await deploy(
    ResolverArt,
    [registry.address, ZERO_ADDRESS, controller.address, reverseRegistrar.address],
    "PublicResolver",
    deployer
  );

  // Set the default reverse resolver so claim() flows pick it up
  tx = await reverseRegistrar.setDefaultResolver(publicResolver.address, { gasLimit: 200_000 });
  await tx.wait();
  console.log("  ✓ Default reverse resolver set");

  // ───── Save deployment record ────────────────────────────────────────────
  const record = {
    network:   `kamet-${network.chainId}`,
    chainId:   network.chainId,
    deployer:  deployer.address,
    timestamp: new Date().toISOString(),
    tld:       TLD,
    tldNode:   tldNode,
    contracts: {
      registry:         registry.address,
      baseRegistrar:    baseRegistrar.address,
      controller:       controller.address,
      publicResolver:   publicResolver.address,
      reverseRegistrar: reverseRegistrar.address,
      priceOracle:      oracle.address,
    },
    config: {
      minCommitmentAge: MIN_COMMITMENT_AGE,
      maxCommitmentAge: MAX_COMMITMENT_AGE,
    },
  };

  const fname = `kamet-dnns-${record.timestamp.replace(/[:.]/g, "-").slice(0, 19)}.json`;
  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, fname), JSON.stringify(record, null, 2));
  fs.writeFileSync(path.join(outDir, "kamet-latest.json"), JSON.stringify(record, null, 2));

  console.log("\n===========================================");
  console.log(`  Saved: deployments/${fname}`);
  console.log(`  Saved: deployments/kamet-latest.json`);
  console.log("===========================================");
}

main().catch((e) => { console.error(e); process.exit(1); });
