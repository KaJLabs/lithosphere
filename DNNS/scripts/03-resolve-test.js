/**
 * Sanity-check the deployed DNNS:
 *   - Registry owner of `.litho` TLD == BaseRegistrar
 *   - Reserved name `dex.litho` resolves to deployer
 *   - Random name `randomname123` is available
 *   - Controller available() agrees
 */
const fs   = require("fs");
const path = require("path");
const hre  = require("hardhat");

const RegistryArt    = require("@ensdomains/ens-contracts/artifacts/contracts/registry/ENSRegistry.sol/ENSRegistry.json");
const BaseRegArt     = require("@ensdomains/ens-contracts/artifacts/contracts/ethregistrar/BaseRegistrarImplementation.sol/BaseRegistrarImplementation.json");
const ResolverArt    = require("@ensdomains/ens-contracts/artifacts/contracts/resolvers/PublicResolver.sol/PublicResolver.json");
const ControllerArt  = require("../artifacts/contracts/LithoRegistrarController.sol/LithoRegistrarController.json");

const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

function namehash(name) {
  let node = ZERO_BYTES32;
  if (!name) return node;
  for (const label of name.split(".").reverse()) {
    const lh = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes(label));
    node = hre.ethers.utils.keccak256(hre.ethers.utils.solidityPack(["bytes32", "bytes32"], [node, lh]));
  }
  return node;
}
const labelhash = (l) => hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes(l));

async function main() {
  const provider   = hre.ethers.provider;
  const deployment = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", "kamet-latest.json"), "utf-8"));
  const { registry: regAddr, baseRegistrar: brAddr, controller: ctlAddr, publicResolver: resAddr } = deployment.contracts;
  const tld = deployment.tld;

  const registry   = new hre.ethers.Contract(regAddr, RegistryArt.abi, provider);
  const baseReg    = new hre.ethers.Contract(brAddr, BaseRegArt.abi, provider);
  const controller = new hre.ethers.Contract(ctlAddr, ControllerArt.abi, provider);
  const resolver   = new hre.ethers.Contract(resAddr, ResolverArt.abi, provider);

  console.log("=== Lithosphere DNNS sanity check ===\n");

  // 1. TLD ownership
  const tldNode = namehash(tld);
  const tldOwner = await registry.owner(tldNode);
  console.log(`registry.owner(.${tld})        = ${tldOwner}`);
  console.log(`  expected BaseRegistrar    = ${brAddr}`);
  console.log(`  match                     = ${tldOwner.toLowerCase() === brAddr.toLowerCase()}\n`);

  // 2. Reserved name resolution
  const reserved = "dex";
  const reservedNode = namehash(`${reserved}.${tld}`);
  const reservedOwner = await registry.owner(reservedNode);
  const reservedAddr = await resolver["addr(bytes32)"](reservedNode);
  console.log(`registry.owner(${reserved}.${tld})   = ${reservedOwner}`);
  console.log(`resolver.addr(${reserved}.${tld})    = ${reservedAddr}`);
  console.log(`  expected deployer        = ${deployment.deployer}`);
  console.log(`  match                     = ${reservedAddr.toLowerCase() === deployment.deployer.toLowerCase()}\n`);

  // 3. Random name should be available
  const random = "randomname123";
  const randomAvailable = await controller.available(random);
  const baseRandomAvail = await baseReg.available(hre.ethers.BigNumber.from(labelhash(random)));
  console.log(`controller.available(${random})   = ${randomAvailable}`);
  console.log(`baseRegistrar.available(${random}) = ${baseRandomAvail}\n`);

  // 4. Reserved name should NOT be available
  const reservedAvailable = await controller.available(reserved);
  console.log(`controller.available(${reserved})           = ${reservedAvailable} (expected false)\n`);

  // 5. Short names invalid
  const shortValid = await controller.valid("ab");
  const longValid  = await controller.valid("alice");
  console.log(`controller.valid('ab')           = ${shortValid} (expected false)`);
  console.log(`controller.valid('alice')        = ${longValid} (expected true)\n`);

  console.log("=== done ===");
}

main().catch((e) => { console.error(e); process.exit(1); });
