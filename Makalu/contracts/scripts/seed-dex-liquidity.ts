/**
 * Validate or execute an approved, first-liquidity plan for Lithoswap.
 *
 * The default mode is read-only preflight. Execution additionally requires:
 *
 *   DEX_SEED_EXECUTE=true
 *   DEX_SEED_CONFIRM=SEED_LITHOSWAP_<chainId>
 *
 * The plan must explicitly bind chain, router, liquidity provider, LP
 * recipient, token addresses, decimals, and human amounts. Existing non-empty pools abort the whole run;
 * this prevents an initial price from silently changing after a front-run or
 * partial earlier seed.
 */
import { ethers } from "hardhat";
import { execFileSync } from "node:child_process";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  readDeploymentManifest,
  readLiquidityPlan,
  requiredConfirmation,
} from "./lib/dex-config";

const ERC20_ABI = [
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

function dirtyWorktree(): boolean {
  try {
    return execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0;
  } catch (error) {
    throw new Error(`Cannot determine repository state: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main(): Promise<void> {
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const manifestPath = resolve(__dirname, "..", "deployments", `dex-${chainId}.json`);
  const planPath = resolve(
    process.env.DEX_LIQUIDITY_PLAN ?? resolve(__dirname, "..", "deployments", `dex-pairs.${chainId}.json`),
  );
  const manifest = readDeploymentManifest(manifestPath);
  const plan = readLiquidityPlan(planPath);
  const execute = process.env.DEX_SEED_EXECUTE === "true";

  if (manifest.chainId !== chainId || plan.chainId !== chainId) {
    throw new Error(`Manifest/plan chain does not match connected chain ${chainId}`);
  }
  if (manifest.dirty) throw new Error("Refusing liquidity for a deployment produced from a dirty worktree");
  if (plan.router !== manifest.contracts.LithoswapV2Router02) {
    throw new Error("Liquidity plan router does not match the deployment manifest");
  }
  let signer: Awaited<ReturnType<typeof ethers.getSigners>>[number] | undefined;
  if (execute) {
    requiredConfirmation(process.env.DEX_SEED_CONFIRM, "SEED_LITHOSWAP", chainId);
    const localDirtyOverride = process.env.ALLOW_DIRTY_DEX_SEED === "true" && [31337, 1337].includes(chainId);
    if (dirtyWorktree() && !localDirtyOverride) {
      throw new Error("Refusing to seed from a dirty worktree");
    }
    [signer] = await ethers.getSigners();
    if (!signer) throw new Error("No liquidity signer is configured");
    if ((await signer.getAddress()) !== plan.liquidityProvider) {
      throw new Error("Configured signer does not match the approved liquidityProvider");
    }
  }

  const runner = signer ?? ethers.provider;
  const routerAddress = manifest.contracts.LithoswapV2Router02;
  const factoryAddress = manifest.contracts.LithoswapV2Factory;
  const router = await ethers.getContractAt("LithoswapV2Router02", routerAddress, runner);
  const factory = await ethers.getContractAt("LithoswapV2Factory", factoryAddress, runner);

  const [routerCode, factoryCode, actualFactory, actualWlitho] = await Promise.all([
    ethers.provider.getCode(routerAddress),
    ethers.provider.getCode(factoryAddress),
    router.factory(),
    router.WLITHO(),
  ]);
  if (routerCode === "0x" || factoryCode === "0x") throw new Error("DEX deployment code is missing");
  if (ethers.keccak256(routerCode) !== manifest.runtimeCodeHashes.LithoswapV2Router02) {
    throw new Error("Router runtime bytecode hash differs from the deployment manifest");
  }
  if (ethers.keccak256(factoryCode) !== manifest.runtimeCodeHashes.LithoswapV2Factory) {
    throw new Error("Factory runtime bytecode hash differs from the deployment manifest");
  }
  if (actualFactory !== factoryAddress || actualWlitho !== manifest.wlitho) {
    throw new Error("Router immutable configuration differs from the deployment manifest");
  }

  const prepared: Array<{
    tokenA: string;
    tokenB: string;
    symbolA: string;
    symbolB: string;
    amountA: bigint;
    amountB: bigint;
  }> = [];

  for (const [index, spec] of plan.pairs.entries()) {
    const [codeA, codeB] = await Promise.all([
      ethers.provider.getCode(spec.tokenA),
      ethers.provider.getCode(spec.tokenB),
    ]);
    if (codeA === "0x" || codeB === "0x") throw new Error(`Pair ${index} contains a token without contract code`);

    const tokenA = await ethers.getContractAt(ERC20_ABI, spec.tokenA, runner);
    const tokenB = await ethers.getContractAt(ERC20_ABI, spec.tokenB, runner);
    const [decimalsA, decimalsB, symbolA, symbolB] = await Promise.all([
      tokenA.decimals(),
      tokenB.decimals(),
      tokenA.symbol(),
      tokenB.symbol(),
    ]);
    if (Number(decimalsA) !== spec.decimalsA || Number(decimalsB) !== spec.decimalsB) {
      throw new Error(`Pair ${index} decimals do not match the on-chain token metadata`);
    }
    const amountA = ethers.parseUnits(spec.amountA, spec.decimalsA);
    const amountB = ethers.parseUnits(spec.amountB, spec.decimalsB);
    const pairAddress = await factory.getPair(spec.tokenA, spec.tokenB);
    if (pairAddress !== ethers.ZeroAddress) {
      const pair = await ethers.getContractAt("LithoswapV2Pair", pairAddress);
      const [reserve0, reserve1] = await pair.getReserves();
      if (reserve0 !== 0n || reserve1 !== 0n) {
        throw new Error(`Approved initial pool ${symbolA}/${symbolB} is already non-empty at ${pairAddress}`);
      }
    }
    const [balanceA, balanceB] = await Promise.all([
      tokenA.balanceOf(plan.liquidityProvider),
      tokenB.balanceOf(plan.liquidityProvider),
    ]);
    if (balanceA < amountA || balanceB < amountB) {
      throw new Error(`Liquidity signer lacks the approved ${symbolA}/${symbolB} amounts`);
    }
    prepared.push({ tokenA: spec.tokenA, tokenB: spec.tokenB, symbolA, symbolB, amountA, amountB });
  }

  console.log(`[seed-dex] ${execute ? "EXECUTE" : "READ-ONLY PREFLIGHT"} chain=${chainId}`);
  console.log(`[seed-dex] liquidity provider=${plan.liquidityProvider} LP recipient=${plan.lpRecipient}`);
  for (const pair of prepared) {
    console.log(
      `[seed-dex] ${pair.symbolA}/${pair.symbolB}: ${pair.amountA.toString()} raw + ${pair.amountB.toString()} raw`,
    );
  }
  if (!execute) {
    console.log(`[seed-dex] Preflight passed. To execute, set DEX_SEED_EXECUTE=true and DEX_SEED_CONFIRM=SEED_LITHOSWAP_${chainId}.`);
    return;
  }
  if (!signer) throw new Error("Execution signer is unavailable");
  const signerAddress = await signer.getAddress();

  const receipts: Array<Record<string, unknown>> = [];
  for (const pair of prepared) {
    const tokenA = await ethers.getContractAt(ERC20_ABI, pair.tokenA, signer);
    const tokenB = await ethers.getContractAt(ERC20_ABI, pair.tokenB, signer);
    for (const [token, amount, symbol] of [
      [tokenA, pair.amountA, pair.symbolA],
      [tokenB, pair.amountB, pair.symbolB],
    ] as const) {
      const current: bigint = await token.allowance(signerAddress, routerAddress);
      if (current !== 0n) await (await token.approve(routerAddress, 0n)).wait();
      const approval = await token.approve(routerAddress, amount);
      const approvalReceipt = await approval.wait();
      if (!approvalReceipt || approvalReceipt.status !== 1) throw new Error(`${symbol} approval failed`);
    }

    const latest = await ethers.provider.getBlock("latest");
    if (!latest) throw new Error("Cannot read the latest block for a deadline");
    const deadline = latest.timestamp + 1800;
    const preview = await router.addLiquidity.staticCall(
      pair.tokenA,
      pair.tokenB,
      pair.amountA,
      pair.amountB,
      pair.amountA,
      pair.amountB,
      plan.lpRecipient,
      deadline,
    );
    if (preview[0] !== pair.amountA || preview[1] !== pair.amountB || preview[2] <= 0n) {
      throw new Error(`Unexpected ${pair.symbolA}/${pair.symbolB} liquidity preview`);
    }

    const transaction = await router.addLiquidity(
      pair.tokenA,
      pair.tokenB,
      pair.amountA,
      pair.amountB,
      pair.amountA,
      pair.amountB,
      plan.lpRecipient,
      deadline,
    );
    const receipt = await transaction.wait();
    if (!receipt || receipt.status !== 1) throw new Error(`${pair.symbolA}/${pair.symbolB} liquidity transaction failed`);
    const pairAddress = await factory.getPair(pair.tokenA, pair.tokenB);
    const pairContract = await ethers.getContractAt("LithoswapV2Pair", pairAddress, signer);
    const [reserves, lpBalance] = await Promise.all([
      pairContract.getReserves(),
      pairContract.balanceOf(plan.lpRecipient),
    ]);
    if (reserves[0] === 0n || reserves[1] === 0n || lpBalance === 0n) {
      throw new Error(`${pair.symbolA}/${pair.symbolB} post-transaction verification failed`);
    }
    receipts.push({
      pair: pairAddress,
      tokenA: pair.tokenA,
      tokenB: pair.tokenB,
      symbolA: pair.symbolA,
      symbolB: pair.symbolB,
      amountA: pair.amountA.toString(),
      amountB: pair.amountB.toString(),
      transactionHash: transaction.hash,
      blockNumber: receipt.blockNumber,
      lpRecipient: plan.lpRecipient,
      lpBalance: lpBalance.toString(),
    });
  }

  const evidence = {
    schemaVersion: 1,
    chainId,
    router: routerAddress,
    factory: factoryAddress,
    signer: signerAddress,
    executedAt: new Date().toISOString(),
    planHash: ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(plan))),
    pairs: receipts,
  };
  const out = resolve(__dirname, "..", "deployments", `dex-liquidity-${chainId}.json`);
  const temporary = `${out}.tmp`;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(temporary, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  renameSync(temporary, out);
  console.log(`[seed-dex] Completed ${receipts.length} approved pair(s); evidence written to ${out}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
