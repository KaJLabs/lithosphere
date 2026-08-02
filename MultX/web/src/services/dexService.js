import { ethers } from 'ethers5';
import {
  DEX_CONFIG,
  DEX_POOLS,
  QUOTER_V2_ABI,
  SWAP_ROUTER_ABI,
  ERC20_DEX_ABI,
  POOL_ABI,
  NPM_ABI,
  FACTORY_ABI,
  MIN_TICK,
  MAX_TICK,
  FULL_RANGE_TICK_LOWER,
  FULL_RANGE_TICK_UPPER,
} from '../data/dexConfig';

// In dev the Vite proxy at /rpc-proxy/* forwards to the Kamet EVM RPC so the
// browser does not hit CORS. In production, kamet.litho.ai serves the same path.
const READ_RPC = import.meta.env.DEV
  ? '/rpc-proxy'
  : (import.meta.env.VITE_EVM_RPC_URL || 'https://rpc-3.litho.ai');
const CHAIN_ID = Number(import.meta.env.VITE_EVM_CHAIN_ID) || 900523;
const FACTORY_START_BLOCK = Number(import.meta.env.VITE_DEX_FACTORY_START_BLOCK || 0);
const BLOCKS_PER_DAY = 86400;
// Kamet sentries enforce a 10 000-block cap on eth_getLogs (app.toml
// block-range-cap). A single fromBlock:0 -> latest scan is ~8M blocks and is
// rejected with a -32000 SERVER_ERROR, which is what surfaced as the red
// "maximum [from, to] blocks distance: 10000" banner on the Pools / Positions
// pages. We page every range query into sub-cap windows instead.
const LOG_RANGE_CAP = 9000;
// Bound the 24h-volume scan so a single pool card never fans out into hundreds
// of getLogs calls against the single public sentry.
const MAX_VOLUME_CHUNKS = 12;
const ZERO = ethers.constants.Zero;
const MAX_UINT128 = ethers.BigNumber.from(2).pow(128).sub(1);

// Page a queryFilter over [fromBlock, toBlock] into <= LOG_RANGE_CAP windows.
// Windows are scanned sequentially to stay gentle on the public sentry, and a
// window the RPC rejects (range cap hit, pruned height) is skipped rather than
// failing the whole scan.
const queryFilterChunked = async (contract, filter, fromBlock, toBlock, span = LOG_RANGE_CAP) => {
  const out = [];
  for (let start = fromBlock; start <= toBlock; start += span) {
    const end = Math.min(start + span - 1, toBlock);
    try {
      const part = await contract.queryFilter(filter, start, end);
      if (part.length) out.push(...part);
    } catch {
      // Best effort: skip windows the RPC refuses.
    }
  }
  return out;
};

// Pass network explicitly so ethers v5 skips eager eth_chainId detection.
export const readProvider = () =>
  new ethers.providers.StaticJsonRpcProvider(READ_RPC, {
    chainId: CHAIN_ID,
    name: 'lithosphere-kamet',
  });

const deadlineFromNow = (deadlineSeconds = 600) =>
  Math.floor(Date.now() / 1000) + Number(deadlineSeconds || 600);

const parseNpmEvent = (receipt, eventName) => {
  const iface = new ethers.utils.Interface(NPM_ABI);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed.name === eventName) return parsed;
    } catch {
      // Not an NPM event.
    }
  }
  return null;
};

const normalizePool = (pool) => ({
  ...pool,
  fee: Number(pool.fee ?? DEX_CONFIG.feeTier),
  address: pool.address,
});

const sortedAmounts = ({ tokenA, amountA, tokenB, amountB }) => {
  const aIsZero = tokenA.toLowerCase() < tokenB.toLowerCase();
  return {
    token0: aIsZero ? tokenA : tokenB,
    token1: aIsZero ? tokenB : tokenA,
    amount0Desired: aIsZero ? amountA : amountB,
    amount1Desired: aIsZero ? amountB : amountA,
  };
};

const absBN = (value) => {
  if (!value) return ZERO;
  return typeof value.abs === 'function'
    ? value.abs()
    : (value.lt(ZERO) ? value.mul(-1) : value);
};

// Live quote via Quoter contract. tokenIn / tokenOut are addresses, amountIn is a BigNumber.
// Returns { amountOut: BigNumber, gasEstimate: BigNumber } or throws.
export const getQuote = async ({ tokenIn, tokenOut, amountIn, fee = DEX_CONFIG.feeTier }) => {
  const quoter = new ethers.Contract(DEX_CONFIG.quoter, QUOTER_V2_ABI, readProvider());
  const result = await quoter.callStatic.quoteExactInputSingle({
    tokenIn,
    tokenOut,
    amountIn,
    fee,
    sqrtPriceLimitX96: 0,
  });
  return {
    amountOut: result.amountOut,
    sqrtPriceX96After: result.sqrtPriceX96After,
    gasEstimate: result.gasEstimate,
  };
};

export const getAllowance = async ({ token, owner, spender = DEX_CONFIG.swapRouter }) => {
  const c = new ethers.Contract(token, ERC20_DEX_ABI, readProvider());
  return c.allowance(owner, spender);
};

export const getBalance = async ({ token, owner }) => {
  const c = new ethers.Contract(token, ERC20_DEX_ABI, readProvider());
  return c.balanceOf(owner);
};

export const approveToken = async ({ signer, token, amount, spender = DEX_CONFIG.swapRouter }) => {
  const c = new ethers.Contract(token, ERC20_DEX_ABI, signer);
  const tx = await c.approve(spender, amount);
  const receipt = await tx.wait();
  return receipt.transactionHash;
};

export const executeSwap = async ({
  signer,
  tokenIn,
  tokenOut,
  amountIn,
  amountOutMinimum,
  recipient,
  fee = DEX_CONFIG.feeTier,
  deadlineSeconds = 600,
}) => {
  const router = new ethers.Contract(DEX_CONFIG.swapRouter, SWAP_ROUTER_ABI, signer);
  const tx = await router.exactInputSingle({
    tokenIn,
    tokenOut,
    fee,
    recipient,
    deadline: deadlineFromNow(deadlineSeconds),
    amountIn,
    amountOutMinimum,
    sqrtPriceLimitX96: 0,
  });
  const receipt = await tx.wait();
  return receipt.transactionHash;
};

// Slippage helper: applies basis points (50 = 0.50%) to a BigNumber output to
// return a minimum amount.
export const applySlippage = (amountOut, slippageBps = 50) => {
  return ethers.BigNumber.from(amountOut).mul(10_000 - slippageBps).div(10_000);
};

export const feeToPercent = (fee) => `${(Number(fee) / 10_000).toFixed(2)}%`;

// Pool reads -----------------------------------------------------------------

export const getPoolState = async (poolAddress) => {
  const pool = new ethers.Contract(poolAddress, POOL_ABI, readProvider());
  const [slot0, liquidity, fee, tickSpacing, token0, token1] = await Promise.all([
    pool.slot0(),
    pool.liquidity(),
    pool.fee(),
    pool.tickSpacing(),
    pool.token0(),
    pool.token1(),
  ]);
  return {
    sqrtPriceX96: slot0.sqrtPriceX96,
    tick: Number(slot0.tick),
    fee: Number(fee),
    tickSpacing: Number(tickSpacing),
    liquidity,
    token0,
    token1,
  };
};

export const getPoolByPair = async (tokenA, tokenB, fee = DEX_CONFIG.feeTier) => {
  const factory = new ethers.Contract(DEX_CONFIG.factory, FACTORY_ABI, readProvider());
  return factory.getPool(tokenA, tokenB, fee);
};

// Discover pools from PoolCreated events. Returns [] (never throws) so callers
// fall back to the static DEX_POOLS list. Event discovery only runs when an
// operator pins VITE_DEX_FACTORY_START_BLOCK to the factory deploy height —
// without it a fromBlock:0 scan would be ~900 chunks against the public sentry,
// so the static list (the source of truth for seeded pools) is used instead.
export const getAllPools = async () => {
  if (!FACTORY_START_BLOCK) return [];
  try {
    const provider = readProvider();
    const factory = new ethers.Contract(DEX_CONFIG.factory, FACTORY_ABI, provider);
    const tip = await provider.getBlockNumber();
    const events = await queryFilterChunked(
      factory,
      factory.filters.PoolCreated(),
      FACTORY_START_BLOCK,
      tip
    );
    const unique = new Map();
    events.forEach((event) => {
      unique.set(event.args.pool.toLowerCase(), {
        token0: event.args.token0,
        token1: event.args.token1,
        fee: Number(event.args.fee),
        tickSpacing: Number(event.args.tickSpacing),
        address: event.args.pool,
      });
    });
    return [...unique.values()];
  } catch {
    return [];
  }
};

export const getConfiguredPools = () => DEX_POOLS.map(normalizePool);

export const getPoolReserves = async (poolAddress, token0, token1) => {
  const t0 = new ethers.Contract(token0, ERC20_DEX_ABI, readProvider());
  const t1 = new ethers.Contract(token1, ERC20_DEX_ABI, readProvider());
  const [reserve0, reserve1] = await Promise.all([
    t0.balanceOf(poolAddress),
    t1.balanceOf(poolAddress),
  ]);
  return { reserve0, reserve1 };
};

export const getPool24hVolume = async (poolAddress) => {
  const provider = readProvider();
  const currentBlock = await provider.getBlockNumber();
  // Cap the lookback so the chunked scan stays within MAX_VOLUME_CHUNKS calls.
  const span = Math.min(BLOCKS_PER_DAY, LOG_RANGE_CAP * MAX_VOLUME_CHUNKS);
  const fromBlock = Math.max(0, currentBlock - span);
  const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
  const events = await queryFilterChunked(pool, pool.filters.Swap(), fromBlock, currentBlock);
  let vol0 = ZERO;
  let vol1 = ZERO;
  for (const event of events) {
    vol0 = vol0.add(absBN(event.args.amount0));
    vol1 = vol1.add(absBN(event.args.amount1));
  }
  return {
    vol0,
    vol1,
    swapCount: events.length,
    fromBlock,
    toBlock: currentBlock,
  };
};

// Read symbol + decimals for an unknown token. Used when an address is not in DEX_TOKENS.
export const getTokenMeta = async (tokenAddress) => {
  const c = new ethers.Contract(tokenAddress, ERC20_DEX_ABI, readProvider());
  const [symbol, decimals] = await Promise.all([
    c.symbol().catch(() => 'TOKEN'),
    c.decimals().catch(() => 18),
  ]);
  return { address: tokenAddress, symbol, decimals: Number(decimals) };
};

// Compute price from sqrtPriceX96 (Uniswap v3). Returns floats for display only.
// price1per0: how much token1 per 1 token0 in human units.
export const priceFromSqrtPriceX96 = (sqrtPriceX96, decimals0, decimals1) => {
  const Q96 = 2 ** 96;
  const sqrt = Number(sqrtPriceX96.toString()) / Q96;
  const rawPrice = sqrt * sqrt;
  const adjusted = rawPrice * 10 ** (decimals0 - decimals1);
  return {
    price1per0: adjusted,
    price0per1: adjusted > 0 ? 1 / adjusted : 0,
  };
};

export const tickToPrice = (tick, decimals0 = 18, decimals1 = 18) => {
  const rawPrice = Math.pow(1.0001, Number(tick));
  return rawPrice * 10 ** (Number(decimals0) - Number(decimals1));
};

export const priceToTick = (price, decimals0 = 18, decimals1 = 18) => {
  const numeric = Number(price);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const rawPrice = numeric / 10 ** (Number(decimals0) - Number(decimals1));
  return Math.floor(Math.log(rawPrice) / Math.log(1.0001));
};

export const roundToTickSpacing = (tick, tickSpacing) => {
  const spacing = Math.abs(Number(tickSpacing) || 1);
  return Math.round(Number(tick) / spacing) * spacing;
};

export const clampTick = (tick) => Math.max(MIN_TICK, Math.min(MAX_TICK, Number(tick)));

export const sqrtRatioAtTick = (tick) => Math.pow(1.0001, Number(tick) / 2);

export const getPositionTokenAmounts = ({
  liquidity,
  tickLower,
  tickUpper,
  currentTick,
  decimals0 = 18,
  decimals1 = 18,
}) => {
  const L = Number(liquidity?.toString?.() ?? liquidity);
  if (!Number.isFinite(L) || L <= 0 || Number(tickLower) >= Number(tickUpper)) {
    return { amount0Raw: 0, amount1Raw: 0, amount0: 0, amount1: 0 };
  }

  const sqrtLower = sqrtRatioAtTick(tickLower);
  const sqrtUpper = sqrtRatioAtTick(tickUpper);
  const sqrtCurrent = sqrtRatioAtTick(currentTick);
  let amount0Raw = 0;
  let amount1Raw = 0;

  if (currentTick < tickLower) {
    amount0Raw = L * (sqrtUpper - sqrtLower) / (sqrtLower * sqrtUpper);
  } else if (currentTick >= tickUpper) {
    amount1Raw = L * (sqrtUpper - sqrtLower);
  } else {
    amount0Raw = L * (sqrtUpper - sqrtCurrent) / (sqrtCurrent * sqrtUpper);
    amount1Raw = L * (sqrtCurrent - sqrtLower);
  }

  return {
    amount0Raw,
    amount1Raw,
    amount0: amount0Raw / 10 ** Number(decimals0),
    amount1: amount1Raw / 10 ** Number(decimals1),
  };
};

// Position reads --------------------------------------------------------------

export const getPosition = async (tokenId) => {
  const npm = new ethers.Contract(DEX_CONFIG.nonfungiblePositionManager, NPM_ABI, readProvider());
  const [p, owner] = await Promise.all([
    npm.positions(tokenId),
    npm.ownerOf(tokenId).catch(() => null),
  ]);
  return {
    tokenId: String(tokenId),
    owner,
    token0: p.token0,
    token1: p.token1,
    fee: Number(p.fee),
    tickLower: Number(p.tickLower),
    tickUpper: Number(p.tickUpper),
    liquidity: p.liquidity,
    tokensOwed0: p.tokensOwed0,
    tokensOwed1: p.tokensOwed1,
  };
};

export const getUserPositions = async (owner) => {
  if (!owner) return [];
  const npm = new ethers.Contract(DEX_CONFIG.nonfungiblePositionManager, NPM_ABI, readProvider());
  const balance = await npm.balanceOf(owner);
  const count = balance.toNumber();
  if (count === 0) return [];

  const tokenIds = await Promise.all(
    Array.from({ length: count }, (_, i) => npm.tokenOfOwnerByIndex(owner, i))
  );
  return Promise.all(tokenIds.map((tokenId) => getPosition(tokenId.toString())));
};

// Position writes -------------------------------------------------------------

export const mintPosition = async ({
  signer,
  tokenA,
  amountA,
  tokenB,
  amountB,
  recipient,
  fee = DEX_CONFIG.feeTier,
  tickLower = FULL_RANGE_TICK_LOWER,
  tickUpper = FULL_RANGE_TICK_UPPER,
  slippageBps = 50,
  deadlineSeconds = 1200,
}) => {
  const {
    token0,
    token1,
    amount0Desired,
    amount1Desired,
  } = sortedAmounts({ tokenA, amountA, tokenB, amountB });

  const amount0Min = applySlippage(amount0Desired, slippageBps);
  const amount1Min = applySlippage(amount1Desired, slippageBps);

  const npm = new ethers.Contract(DEX_CONFIG.nonfungiblePositionManager, NPM_ABI, signer);
  const tx = await npm.mint({
    token0,
    token1,
    fee,
    tickLower,
    tickUpper,
    amount0Desired,
    amount1Desired,
    amount0Min,
    amount1Min,
    recipient,
    deadline: deadlineFromNow(deadlineSeconds),
  });
  const receipt = await tx.wait();
  const event = parseNpmEvent(receipt, 'IncreaseLiquidity');

  return {
    tokenId: event?.args?.tokenId?.toString?.() ?? null,
    liquidity: event?.args?.liquidity,
    amount0: event?.args?.amount0,
    amount1: event?.args?.amount1,
    txHash: receipt.transactionHash,
  };
};

// Caller must pre-approve both tokens to the NPM.
export const mintFullRangePosition = async (args) => (
  mintPosition({
    ...args,
    tickLower: FULL_RANGE_TICK_LOWER,
    tickUpper: FULL_RANGE_TICK_UPPER,
  })
);

export const increasePosition = async ({
  signer,
  tokenId,
  amount0,
  amount1,
  slippageBps = 50,
  deadlineSeconds = 1200,
}) => {
  const npm = new ethers.Contract(DEX_CONFIG.nonfungiblePositionManager, NPM_ABI, signer);
  const params = {
    tokenId,
    amount0Desired: amount0,
    amount1Desired: amount1,
    amount0Min: applySlippage(amount0, slippageBps),
    amount1Min: applySlippage(amount1, slippageBps),
    deadline: deadlineFromNow(deadlineSeconds),
  };
  const tx = await npm.increaseLiquidity(params);
  const receipt = await tx.wait();
  const event = parseNpmEvent(receipt, 'IncreaseLiquidity');
  return {
    liquidity: event?.args?.liquidity,
    amount0: event?.args?.amount0,
    amount1: event?.args?.amount1,
    txHash: receipt.transactionHash,
  };
};

export const decreasePosition = async ({
  signer,
  tokenId,
  liquidity,
  slippageBps = 50,
  deadlineSeconds = 1200,
}) => {
  const npm = new ethers.Contract(DEX_CONFIG.nonfungiblePositionManager, NPM_ABI, signer);
  const baseParams = {
    tokenId,
    liquidity,
    amount0Min: ZERO,
    amount1Min: ZERO,
    deadline: deadlineFromNow(deadlineSeconds),
  };
  const expected = await npm.callStatic.decreaseLiquidity(baseParams).catch(() => null);
  const params = expected
    ? {
        ...baseParams,
        amount0Min: applySlippage(expected.amount0, slippageBps),
        amount1Min: applySlippage(expected.amount1, slippageBps),
      }
    : baseParams;
  const tx = await npm.decreaseLiquidity(params);
  const receipt = await tx.wait();
  const event = parseNpmEvent(receipt, 'DecreaseLiquidity');
  return {
    amount0: event?.args?.amount0 ?? expected?.amount0,
    amount1: event?.args?.amount1 ?? expected?.amount1,
    txHash: receipt.transactionHash,
  };
};

export const collectFees = async ({ signer, tokenId, recipient }) => {
  const npm = new ethers.Contract(DEX_CONFIG.nonfungiblePositionManager, NPM_ABI, signer);
  const tx = await npm.collect({
    tokenId,
    recipient,
    amount0Max: MAX_UINT128,
    amount1Max: MAX_UINT128,
  });
  const receipt = await tx.wait();
  const event = parseNpmEvent(receipt, 'Collect');
  return {
    amount0: event?.args?.amount0,
    amount1: event?.args?.amount1,
    txHash: receipt.transactionHash,
  };
};

export const burnPosition = async ({ signer, tokenId }) => {
  const npm = new ethers.Contract(DEX_CONFIG.nonfungiblePositionManager, NPM_ABI, signer);
  const tx = await npm.burn(tokenId);
  const receipt = await tx.wait();
  return receipt.transactionHash;
};
