/** Read-only verification of a deployed Lithoswap manifest against a live RPC. */
import { ethers } from "hardhat";
import { resolve } from "node:path";

import { positiveInteger, readDeploymentManifest } from "./lib/dex-config";

async function main(): Promise<void> {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const expected = positiveInteger(Number(process.env.EXPECTED_CHAIN_ID), "EXPECTED_CHAIN_ID");
  if (chainId !== expected) throw new Error(`Connected chain ${chainId} does not match EXPECTED_CHAIN_ID ${expected}`);

  const path = resolve(
    process.env.DEX_DEPLOYMENT_MANIFEST ?? resolve(__dirname, "..", "deployments", `dex-${chainId}.json`),
  );
  const manifest = readDeploymentManifest(path);
  if (manifest.chainId !== chainId) throw new Error("Manifest chain does not match the connected RPC");
  const factory = await ethers.getContractAt(
    "LithoswapV2Factory",
    manifest.contracts.LithoswapV2Factory,
    ethers.provider,
  );
  const router = await ethers.getContractAt(
    "LithoswapV2Router02",
    manifest.contracts.LithoswapV2Router02,
    ethers.provider,
  );
  const [factoryCode, routerCode, feeToSetter, feeTo, routerFactory, routerWlitho, wlithoCode] = await Promise.all([
    ethers.provider.getCode(manifest.contracts.LithoswapV2Factory),
    ethers.provider.getCode(manifest.contracts.LithoswapV2Router02),
    factory.feeToSetter(),
    factory.feeTo(),
    router.factory(),
    router.WLITHO(),
    ethers.provider.getCode(manifest.wlitho),
  ]);
  const checks: Array<[string, boolean]> = [
    ["factory bytecode exists", factoryCode !== "0x"],
    ["router bytecode exists", routerCode !== "0x"],
    ["WLITHO bytecode exists", wlithoCode !== "0x"],
    ["factory bytecode hash", ethers.keccak256(factoryCode) === manifest.runtimeCodeHashes.LithoswapV2Factory],
    ["router bytecode hash", ethers.keccak256(routerCode) === manifest.runtimeCodeHashes.LithoswapV2Router02],
    ["fee-controller", feeToSetter === manifest.feeToSetter],
    ["protocol fee recipient", feeTo === manifest.feeTo],
    ["router factory", routerFactory === manifest.contracts.LithoswapV2Factory],
    ["router WLITHO", routerWlitho === manifest.wlitho],
  ];
  for (const [label, ok] of checks) {
    console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
    if (!ok) throw new Error(`Deployment verification failed: ${label}`);
  }
  console.log(`[verify-dex] ${checks.length} checks passed for chain ${chainId}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
