/**
 * Reserve brand-critical names so squatters can't grab them.
 *
 * Reserves: litho, kamet, makalu, dex, treasury, team, faucet, quantts, bridge
 *
 * Each name is registered to the deployer for 1 year (free under ZeroPriceOracle)
 * via the standard commit-reveal flow:
 *   1. Build commitments for all names (single secret each)
 *   2. Submit all commit() txs in parallel
 *   3. Wait minCommitmentAge + 5s buffer
 *   4. Submit register() tx for each name
 *   5. setAddr on the resolver so reverse-resolution works
 *
 * Usage:
 *   Inject DNNS_DEPLOYER_PRIVATE_KEY through the approved secret manager, then:
 *   DNNS_DEPLOYMENT_APPROVED=true npx hardhat run scripts/02-reserve-names.js --network litho_kamet
 */
const fs   = require("fs");
const path = require("path");
const hre  = require("hardhat");

const ControllerArt = require("../artifacts/contracts/LithoRegistrarController.sol/LithoRegistrarController.json");
const ResolverArt   = require("@ensdomains/ens-contracts/artifacts/contracts/resolvers/PublicResolver.sol/PublicResolver.json");
const RegistryArt   = require("@ensdomains/ens-contracts/artifacts/contracts/registry/ENSRegistry.sol/ENSRegistry.json");

const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
const ONE_YEAR     = 31_536_000;
const RESERVED     = ["litho", "kamet", "makalu", "dex", "treasury", "team", "faucet", "quantts", "bridge"];

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network    = await deployer.provider.getNetwork();

  // Load deployment record
  const latestPath = path.join(__dirname, "..", "deployments", "kamet-latest.json");
  if (!fs.existsSync(latestPath)) {
    console.error("ERROR: deployments/kamet-latest.json not found. Run 01-deploy-core.js first.");
    process.exit(1);
  }
  const deployment = JSON.parse(fs.readFileSync(latestPath, "utf-8"));
  const { controller: controllerAddr, publicResolver: resolverAddr, registry: registryAddr } = deployment.contracts;
  const minCommitmentAge = deployment.config.minCommitmentAge || 60;
  const tld = deployment.tld;

  console.log(`Deployer:    ${deployer.address}`);
  console.log(`Controller:  ${controllerAddr}`);
  console.log(`Resolver:    ${resolverAddr}`);
  console.log(`Names to reserve (${RESERVED.length}): ${RESERVED.join(", ")}\n`);

  const controller = new hre.ethers.Contract(controllerAddr, ControllerArt.abi, deployer);
  const resolver   = new hre.ethers.Contract(resolverAddr, ResolverArt.abi, deployer);
  const registry   = new hre.ethers.Contract(registryAddr, RegistryArt.abi, deployer);

  // Generate an unpredictable commitment secret for each name. Never log or
  // persist these values outside the in-memory commit/reveal operation.
  const items = RESERVED.map((name) => ({
    name,
    secret: hre.ethers.utils.hexlify(hre.ethers.utils.randomBytes(32)),
  }));

  // ───── 1. Filter out already-registered ──────────────────────────────────
  const toRegister = [];
  for (const item of items) {
    const available = await controller.available(item.name);
    if (!available) {
      console.log(`• ${item.name}.${tld} already taken — skipping`);
      continue;
    }
    toRegister.push(item);
  }
  if (toRegister.length === 0) {
    console.log("Nothing to do — all reserved names already registered.");
    return;
  }

  // ───── 2. Build + submit commitments ─────────────────────────────────────
  console.log(`\n--- Step 1: commit (${toRegister.length} names) ---`);
  for (const item of toRegister) {
    item.commitment = await controller.makeCommitment(
      item.name,
      deployer.address,
      ONE_YEAR,
      item.secret
    );
    const tx = await controller.commit(item.commitment, { gasLimit: 200_000 });
    await tx.wait();
    console.log(`  ✓ commit ${item.name}.${tld}  (${tx.hash.slice(0, 12)}...)`);
  }

  // ───── 3. Wait for commitment age ────────────────────────────────────────
  const waitMs = (minCommitmentAge + 5) * 1000;
  console.log(`\n--- Step 2: wait ${waitMs / 1000}s for commitment age ---`);
  await sleep(waitMs);

  // ───── 4. Register each name ─────────────────────────────────────────────
  console.log(`\n--- Step 3: register ---`);
  const registered = [];
  for (const item of toRegister) {
    try {
      const tx = await controller.register(
        item.name,
        deployer.address,
        ONE_YEAR,
        item.secret,
        { gasLimit: 1_500_000, value: 0 }
      );
      const r = await tx.wait();
      console.log(`  ✓ register ${item.name}.${tld}  (gas ${r.gasUsed.toString()}, tx ${tx.hash.slice(0, 12)}...)`);
      registered.push({ name: item.name, txHash: tx.hash });
    } catch (err) {
      console.error(`  ✗ register ${item.name}.${tld} FAILED: ${err.message.slice(0, 200)}`);
    }
  }

  // ───── 5. Set resolver + addr on each registered name ─────────────────────
  // Now that deployer owns each `<name>.litho` in the registry, set the public
  // resolver and the addr record so reverse-resolution / dapp lookups work.
  console.log(`\n--- Step 4: set resolver + addr records ---`);
  for (const item of registered) {
    try {
      const node = namehash(`${item.name}.${tld}`);
      const txR = await registry.setResolver(node, resolverAddr, { gasLimit: 200_000 });
      await txR.wait();
      const txA = await resolver["setAddr(bytes32,address)"](node, deployer.address, { gasLimit: 200_000 });
      await txA.wait();
      console.log(`  ✓ ${item.name}.${tld} → resolver + addr=${deployer.address}`);
    } catch (err) {
      console.error(`  ✗ ${item.name}.${tld} record set FAILED: ${err.message.slice(0, 200)}`);
    }
  }

  // Persist
  deployment.reserved = (deployment.reserved || []).concat(registered);
  fs.writeFileSync(latestPath, JSON.stringify(deployment, null, 2));
  console.log(`\n✓ Updated deployments/kamet-latest.json with ${registered.length} reserved names.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
