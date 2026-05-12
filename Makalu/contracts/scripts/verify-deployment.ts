/**
 * Verify that the on-chain bytecode at each manifest address matches the
 * locally compiled artifact. Catches three classes of bug:
 *
 *   1. Manifest typo (wrong address committed)
 *   2. Source drift since the deploy (someone edited the .sol but didn't redeploy)
 *   3. Selfdestruct or proxy upgrade (bytecode at the address changed)
 *
 *   pnpm hardhat run scripts/verify-deployment.ts --network <name>
 *
 * Exits 0 if every contract in the manifest matches; 1 otherwise. CI can
 * gate on this once we have a per-network deployments JSON checked in.
 */
import { ethers, artifacts } from "hardhat";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

interface DeployedContract {
  name: string;
  address: string;
}

interface DeploymentManifest {
  chainId: number;
  contracts: DeployedContract[];
}

/**
 * Hardhat's compiled artifact bytecode is the CREATION bytecode (with
 * constructor + initialization). What's on-chain is the RUNTIME bytecode
 * (the post-constructor portion). Use `deployedBytecode` for the
 * comparison — it's the runtime view.
 */
async function expectedRuntimeBytecode(name: string): Promise<string> {
  const artifact = await artifacts.readArtifact(name);
  return artifact.deployedBytecode.toLowerCase();
}

async function main() {
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const manifestPath = resolve(__dirname, "..", "deployments", `${chainId}.json`);

  if (!existsSync(manifestPath)) {
    console.error(`[verify] No manifest at ${manifestPath}. Run scripts/deploy.ts first.`);
    process.exit(1);
  }

  const manifest: DeploymentManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  console.log(`[verify] chainId=${chainId} contracts=${manifest.contracts.length}`);

  let failures = 0;
  for (const c of manifest.contracts) {
    const onchain = (await ethers.provider.getCode(c.address)).toLowerCase();
    if (onchain === "0x" || onchain === "0x0") {
      console.error(`  ✗ ${c.name.padEnd(12)} ${c.address}: no bytecode at address`);
      failures += 1;
      continue;
    }
    const expected = await expectedRuntimeBytecode(c.name);
    if (onchain !== expected) {
      console.error(`  ✗ ${c.name.padEnd(12)} ${c.address}: bytecode mismatch`);
      console.error(`      on-chain length: ${onchain.length}, artifact length: ${expected.length}`);
      failures += 1;
      continue;
    }
    console.log(`  ✓ ${c.name.padEnd(12)} ${c.address}`);
  }

  if (failures > 0) {
    console.error(`\n[verify] ${failures} contract(s) failed verification`);
    process.exit(1);
  }
  console.log(`\n[verify] all ${manifest.contracts.length} contracts match`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
