import { getAddress, isAddress, parseUnits, ZeroAddress } from "ethers";
import { readFileSync } from "node:fs";

export interface DexDeploymentManifest {
  schemaVersion: 1;
  chainId: number;
  network: string;
  deployer: string;
  feeToSetter: string;
  feeTo: string;
  commit: string;
  dirty: boolean;
  deployedAt: string;
  confirmations: number;
  wlitho: string;
  contracts: {
    LithoswapV2Factory: string;
    LithoswapV2Router02: string;
  };
  transactions: {
    LithoswapV2Factory: string;
    LithoswapV2Router02: string;
  };
  deploymentBlocks: {
    LithoswapV2Factory: number;
    LithoswapV2Router02: number;
  };
  runtimeCodeHashes: {
    LithoswapV2Factory: string;
    LithoswapV2Router02: string;
  };
}

export interface LiquidityPairSpec {
  tokenA: string;
  tokenB: string;
  amountA: string;
  amountB: string;
  decimalsA: number;
  decimalsB: number;
}

export interface DexLiquidityPlan {
  schemaVersion: 1;
  chainId: number;
  router: string;
  liquidityProvider: string;
  lpRecipient: string;
  pairs: LiquidityPairSpec[];
}

type JsonObject = Record<string, unknown>;

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
}

export function address(value: unknown, label: string): string {
  if (typeof value !== "string" || !isAddress(value) || value.toLowerCase() === ZeroAddress) {
    throw new Error(`${label} must be a non-zero EVM address`);
  }
  return getAddress(value);
}

export function positiveInteger(value: unknown, label: string, maximum = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new Error(`${label} must be an integer between 1 and ${maximum}`);
  }
  return value;
}

export function integerInRange(value: unknown, label: string, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

export function positiveAmount(value: unknown, decimals: number, label: string): string {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    throw new Error(`${label} must be a positive decimal string`);
  }
  let parsed: bigint;
  try {
    parsed = parseUnits(value, decimals);
  } catch {
    throw new Error(`${label} has more precision than its token supports`);
  }
  if (parsed <= 0n) throw new Error(`${label} must be greater than zero`);
  return value;
}

function hash(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${label} must be a 32-byte hex value`);
  }
  return value.toLowerCase();
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

export function parseDeploymentManifest(value: unknown): DexDeploymentManifest {
  const input = object(value, "DEX deployment manifest");
  if (input.schemaVersion !== 1) throw new Error("Unsupported DEX deployment manifest schemaVersion");
  const contracts = object(input.contracts, "contracts");
  const transactions = object(input.transactions, "transactions");
  const deploymentBlocks = object(input.deploymentBlocks, "deploymentBlocks");
  const runtimeCodeHashes = object(input.runtimeCodeHashes, "runtimeCodeHashes");

  return {
    schemaVersion: 1,
    chainId: positiveInteger(input.chainId, "chainId"),
    network: text(input.network, "network"),
    deployer: address(input.deployer, "deployer"),
    feeToSetter: address(input.feeToSetter, "feeToSetter"),
    feeTo: typeof input.feeTo === "string" && input.feeTo.toLowerCase() === ZeroAddress
      ? ZeroAddress
      : address(input.feeTo, "feeTo"),
    commit: text(input.commit, "commit"),
    dirty: typeof input.dirty === "boolean" ? input.dirty : (() => { throw new Error("dirty must be boolean"); })(),
    deployedAt: text(input.deployedAt, "deployedAt"),
    confirmations: positiveInteger(input.confirmations, "confirmations", 100),
    wlitho: address(input.wlitho, "wlitho"),
    contracts: {
      LithoswapV2Factory: address(contracts.LithoswapV2Factory, "contracts.LithoswapV2Factory"),
      LithoswapV2Router02: address(contracts.LithoswapV2Router02, "contracts.LithoswapV2Router02"),
    },
    transactions: {
      LithoswapV2Factory: hash(transactions.LithoswapV2Factory, "transactions.LithoswapV2Factory"),
      LithoswapV2Router02: hash(transactions.LithoswapV2Router02, "transactions.LithoswapV2Router02"),
    },
    deploymentBlocks: {
      LithoswapV2Factory: positiveInteger(deploymentBlocks.LithoswapV2Factory, "deploymentBlocks.LithoswapV2Factory"),
      LithoswapV2Router02: positiveInteger(deploymentBlocks.LithoswapV2Router02, "deploymentBlocks.LithoswapV2Router02"),
    },
    runtimeCodeHashes: {
      LithoswapV2Factory: hash(runtimeCodeHashes.LithoswapV2Factory, "runtimeCodeHashes.LithoswapV2Factory"),
      LithoswapV2Router02: hash(runtimeCodeHashes.LithoswapV2Router02, "runtimeCodeHashes.LithoswapV2Router02"),
    },
  };
}

export function parseLiquidityPlan(value: unknown): DexLiquidityPlan {
  const input = object(value, "DEX liquidity plan");
  if (input.schemaVersion !== 1) throw new Error("Unsupported DEX liquidity plan schemaVersion");
  const chainId = positiveInteger(input.chainId, "chainId");
  const router = address(input.router, "router");
  const liquidityProvider = address(input.liquidityProvider, "liquidityProvider");
  const lpRecipient = address(input.lpRecipient, "lpRecipient");
  if (!Array.isArray(input.pairs) || input.pairs.length === 0) {
    throw new Error("pairs must contain at least one approved pair");
  }

  const seen = new Set<string>();
  const pairs = input.pairs.map((raw, index): LiquidityPairSpec => {
    const pair = object(raw, `pairs[${index}]`);
    const tokenA = address(pair.tokenA, `pairs[${index}].tokenA`);
    const tokenB = address(pair.tokenB, `pairs[${index}].tokenB`);
    if (tokenA === tokenB) throw new Error(`pairs[${index}] contains identical tokens`);
    const key = [tokenA.toLowerCase(), tokenB.toLowerCase()].sort().join(":");
    if (seen.has(key)) throw new Error(`pairs[${index}] duplicates an earlier pair`);
    seen.add(key);
    const decimalsA = integerInRange(pair.decimalsA, `pairs[${index}].decimalsA`, 0, 255);
    const decimalsB = integerInRange(pair.decimalsB, `pairs[${index}].decimalsB`, 0, 255);
    return {
      tokenA,
      tokenB,
      amountA: positiveAmount(pair.amountA, decimalsA, `pairs[${index}].amountA`),
      amountB: positiveAmount(pair.amountB, decimalsB, `pairs[${index}].amountB`),
      decimalsA,
      decimalsB,
    };
  });

  return { schemaVersion: 1, chainId, router, liquidityProvider, lpRecipient, pairs };
}

export function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read JSON from ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function readDeploymentManifest(path: string): DexDeploymentManifest {
  return parseDeploymentManifest(readJson(path));
}

export function readLiquidityPlan(path: string): DexLiquidityPlan {
  return parseLiquidityPlan(readJson(path));
}

export function requiredConfirmation(actual: string | undefined, action: string, chainId: number): void {
  const expected = `${action}_${chainId}`;
  if (actual !== expected) {
    throw new Error(`Refusing value-moving action. Set confirmation exactly to ${expected}`);
  }
}
