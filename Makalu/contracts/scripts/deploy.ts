/**
 * Deploy production contracts and emit a structured deployment manifest.
 *
 *   pnpm hardhat run scripts/deploy.ts --network <name>
 *
 * The manifest at `deployments/<chainId>.json` records every deployed
 * address, deployer, commit, and timestamp. Downstream consumers (the
 * SDK's NETWORKS table, the validator team's runbooks, the verifier
 * script below) read the manifest rather than re-running grep on logs.
 *
 * For multi-sig / Ledger deployment, do NOT use this script — see
 * `docs/governance/contract-deployment.md` for the Safe-app flow.
 */
import { ethers } from "hardhat";
import { writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";

interface DeployedContract {
  name: string;
  address: string;
  txHash: string;
  blockNumber: number;
}

interface DeploymentManifest {
  chainId: number;
  network: string;
  deployer: string;
  commit: string;
  deployedAt: string;
  contracts: DeployedContract[];
}

async function recordDeployment(
  name: string,
  contract: { getAddress(): Promise<string>; deploymentTransaction(): { hash: string } | null },
): Promise<DeployedContract> {
  const address = await contract.getAddress();
  const tx = contract.deploymentTransaction();
  if (!tx) throw new Error(`${name}: deploymentTransaction() returned null`);
  const receipt = await tx.wait?.() ?? await ethers.provider.getTransactionReceipt(tx.hash);
  if (!receipt) throw new Error(`${name}: receipt not available for ${tx.hash}`);
  console.log(`[deploy] ${name} → ${address} (tx ${tx.hash})`);
  return { name, address, txHash: tx.hash, blockNumber: receipt.blockNumber };
}

function currentCommit(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  console.log(`[deploy] network=${network.name} chainId=${chainId} deployer=${deployer.address}`);

  const contracts: DeployedContract[] = [];

  const LITHONative = await ethers.getContractFactory("LITHONative");
  const lithoNative = await LITHONative.deploy();
  await lithoNative.waitForDeployment();
  contracts.push(await recordDeployment("LITHONative", lithoNative));

  const WLITHO = await ethers.getContractFactory("WLITHO");
  const wlitho = await WLITHO.deploy(await lithoNative.getAddress());
  await wlitho.waitForDeployment();
  contracts.push(await recordDeployment("WLITHO", wlitho));

  const manifest: DeploymentManifest = {
    chainId,
    network: network.name,
    deployer: deployer.address,
    commit: currentCommit(),
    deployedAt: new Date().toISOString(),
    contracts,
  };

  const out = resolve(__dirname, "..", "deployments", `${chainId}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  console.log("\n--- Deployment Summary ---");
  console.log(`Manifest: ${out}`);
  for (const c of contracts) console.log(`  ${c.name.padEnd(12)} ${c.address}`);
  console.log("\nNext steps:");
  console.log(`  1) pnpm hardhat run scripts/verify-deployment.ts --network ${network.name}`);
  console.log(`  2) Commit deployments/${chainId}.json so downstream consumers (SDK, runbooks) see the addresses.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
