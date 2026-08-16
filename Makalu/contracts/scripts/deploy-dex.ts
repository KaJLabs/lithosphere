/**
 * Deploy Lithoswap V2 Factory + Router02 and write an evidence-rich manifest.
 *
 * No production defaults are accepted. A deployment must explicitly name the
 * chain, WLITHO contract, final fee-controller, and confirmation phrase:
 *
 *   EXPECTED_CHAIN_ID=700777
 *   WLITHO_ADDRESS=0x...
 *   DEX_FEE_TO_SETTER_ADDRESS=0x...
 *   DEX_DEPLOY_CONFIRMATIONS=<approved count>
 *   DEX_DEPLOY_CONFIRM=DEPLOY_LITHOSWAP_700777
 *   DEPLOYER_PRIVATE_KEY=<secret reference injected by the runner>
 *   pnpm hardhat run scripts/deploy-dex.ts --network makalu
 *
 * The script refuses a dirty worktree. `ALLOW_DIRTY_DEX_DEPLOY=true` is honored
 * only on disposable local chain IDs 31337 and 1337.
 */
import { ethers } from "hardhat";
import { execFileSync } from "node:child_process";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  address,
  positiveInteger,
  requiredConfirmation,
  type DexDeploymentManifest,
} from "./lib/dex-config";

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function repositoryState(): { commit: string; dirty: boolean } {
  try {
    return {
      commit: git("rev-parse", "HEAD"),
      dirty: git("status", "--porcelain").length > 0,
    };
  } catch (error) {
    throw new Error(`Cannot determine repository state: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function requiredChainId(value: string | undefined): number {
  const parsed = Number(value);
  return positiveInteger(parsed, "EXPECTED_CHAIN_ID");
}

async function main(): Promise<void> {
  const expectedChainId = requiredChainId(process.env.EXPECTED_CHAIN_ID);
  const wlitho = address(process.env.WLITHO_ADDRESS, "WLITHO_ADDRESS");
  const feeToSetter = address(process.env.DEX_FEE_TO_SETTER_ADDRESS, "DEX_FEE_TO_SETTER_ADDRESS");
  const confirmations = positiveInteger(
    Number(process.env.DEX_DEPLOY_CONFIRMATIONS),
    "DEX_DEPLOY_CONFIRMATIONS",
    100,
  );

  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== expectedChainId) {
    throw new Error(`Connected chain ${chainId} does not match EXPECTED_CHAIN_ID ${expectedChainId}`);
  }
  requiredConfirmation(process.env.DEX_DEPLOY_CONFIRM, "DEPLOY_LITHOSWAP", chainId);

  const source = repositoryState();
  const localDirtyOverride = process.env.ALLOW_DIRTY_DEX_DEPLOY === "true" && [31337, 1337].includes(chainId);
  if (source.dirty && !localDirtyOverride) {
    throw new Error("Refusing to deploy from a dirty worktree. Commit/review the release or use a disposable rehearsal.");
  }

  const wlithoCode = await ethers.provider.getCode(wlitho);
  if (wlithoCode === "0x") throw new Error(`WLITHO_ADDRESS has no contract code on chain ${chainId}`);

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No deployment signer is configured");
  console.log(`[deploy-dex] chainId=${chainId} deployer=${deployer.address}`);
  console.log(`[deploy-dex] feeToSetter=${feeToSetter} WLITHO=${wlitho} confirmations=${confirmations}`);

  const factory = await (await ethers.getContractFactory("LithoswapV2Factory", deployer)).deploy(feeToSetter);
  const factoryTx = factory.deploymentTransaction();
  if (!factoryTx) throw new Error("Factory deployment transaction is unavailable");
  const factoryReceipt = await factoryTx.wait(confirmations);
  if (!factoryReceipt || factoryReceipt.status !== 1) throw new Error("Factory deployment failed");
  const factoryAddress = await factory.getAddress();

  const router = await (await ethers.getContractFactory("LithoswapV2Router02", deployer)).deploy(
    factoryAddress,
    wlitho,
  );
  const routerTx = router.deploymentTransaction();
  if (!routerTx) throw new Error("Router deployment transaction is unavailable");
  const routerReceipt = await routerTx.wait(confirmations);
  if (!routerReceipt || routerReceipt.status !== 1) throw new Error("Router deployment failed");
  const routerAddress = await router.getAddress();

  const [actualFeeSetter, actualFeeTo, actualFactory, actualWlitho] = await Promise.all([
    factory.feeToSetter(),
    factory.feeTo(),
    router.factory(),
    router.WLITHO(),
  ]);
  if (actualFeeSetter !== feeToSetter) throw new Error("Factory fee-controller verification failed");
  if (actualFactory !== factoryAddress) throw new Error("Router factory verification failed");
  if (actualWlitho !== wlitho) throw new Error("Router WLITHO verification failed");

  const [factoryCode, routerCode] = await Promise.all([
    ethers.provider.getCode(factoryAddress),
    ethers.provider.getCode(routerAddress),
  ]);
  if (factoryCode === "0x" || routerCode === "0x") throw new Error("Runtime bytecode verification failed");

  const manifest: DexDeploymentManifest = {
    schemaVersion: 1,
    chainId,
    network: network.name,
    deployer: deployer.address,
    feeToSetter,
    feeTo: actualFeeTo,
    commit: source.commit,
    dirty: source.dirty,
    deployedAt: new Date().toISOString(),
    confirmations,
    wlitho,
    contracts: {
      LithoswapV2Factory: factoryAddress,
      LithoswapV2Router02: routerAddress,
    },
    transactions: {
      LithoswapV2Factory: factoryTx.hash,
      LithoswapV2Router02: routerTx.hash,
    },
    deploymentBlocks: {
      LithoswapV2Factory: factoryReceipt.blockNumber,
      LithoswapV2Router02: routerReceipt.blockNumber,
    },
    runtimeCodeHashes: {
      LithoswapV2Factory: ethers.keccak256(factoryCode),
      LithoswapV2Router02: ethers.keccak256(routerCode),
    },
  };

  const out = resolve(__dirname, "..", "deployments", `dex-${chainId}.json`);
  const temporary = `${out}.tmp`;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  renameSync(temporary, out);

  console.log(`[deploy-dex] Factory  ${factoryAddress} tx=${factoryTx.hash}`);
  console.log(`[deploy-dex] Router02 ${routerAddress} tx=${routerTx.hash}`);
  console.log(`[deploy-dex] manifest ${out}`);
  console.log("[deploy-dex] Next: review the manifest, verify it independently, then prepare an approved liquidity plan.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
