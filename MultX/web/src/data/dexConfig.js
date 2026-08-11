// Lithosphere DEX (Uniswap v3 fork) - deployed addresses on Kamet (chainId 900523).
// Source of truth: contracts/dex/deployments/kamet-latest.json

export const DEX_CONFIG = {
  factory: '0xe6c61Ce7Cc92c732A815250d7c2292eD21F6bf85',
  swapRouter: '0x7a067A343e5e94BfDda46df496507eB98c826dA4',
  nonfungiblePositionManager: '0xB5d58B337128A6aA10494F9cA7cB899A778D00a0',
  quoter: '0xcC57C38F6225077464a3cdEaE176D212f839Cf3C',
  feeTier: 3000, // 0.30%
};

export const DEX_FEE_TIERS = [
  { fee: 500, label: '0.05%' },
  { fee: 3000, label: '0.30%' },
  { fee: 10000, label: '1.00%' },
];

// Tokens available for swap (a subset of kametRegistry - only those with seeded pools).
export const DEX_TOKENS = [
  { symbol: 'wLITHO', name: 'Wrapped Lithosphere', address: '0xC0FC628e3aB128fe387e7ed5e729bD809C017888', decimals: 18 },
  { symbol: 'QTT', name: 'Quantts', address: '0x16EE7127C9E03e29ca5727e23dd7CB03D283cDBe', decimals: 18 },
  { symbol: 'COLLE', name: 'Colle AI', address: '0x0573f66cb4bC34618e7AB8a941F7883DD2515dCA', decimals: 18 },
  { symbol: 'LitBTC', name: 'Lithosphere LitBTC', address: '0x3A8D5FdC6c8dA9f14C535424b6F7206eC1996016', decimals: 18 },
];

// Factory event discovery is the primary pool source. This static list remains
// as a fallback if a historical log scan is unavailable from the RPC.
export const DEX_POOLS = [
  { pair: 'wLITHO/QTT', fee: 3000, address: '0xc3106F1d4f9f23B299805e9B18990DBD4F26DB3C', token0: '0x16EE7127C9E03e29ca5727e23dd7CB03D283cDBe', token1: '0xC0FC628e3aB128fe387e7ed5e729bD809C017888' },
  { pair: 'wLITHO/COLLE', fee: 3000, address: '0x4C4e6b6Db814252e0Fa082B2611550fd58d3a8f0', token0: '0x0573f66cb4bC34618e7AB8a941F7883DD2515dCA', token1: '0xC0FC628e3aB128fe387e7ed5e729bD809C017888' },
  { pair: 'wLITHO/LitBTC', fee: 3000, address: '0x8875654e3fA162e16961336dbb84d9958FA6296F', token0: '0x3A8D5FdC6c8dA9f14C535424b6F7206eC1996016', token1: '0xC0FC628e3aB128fe387e7ed5e729bD809C017888' },
];

export const QUOTER_V2_ABI = [
  'function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
];

export const SWAP_ROUTER_ABI = [
  'function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)',
];

export const ERC20_DEX_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

export const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() view returns (uint128)',
  'function fee() view returns (uint24)',
  'function tickSpacing() view returns (int24)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)',
];

export const NPM_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
  'function increaseLiquidity((uint256 tokenId, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, uint256 deadline)) payable returns (uint128 liquidity, uint256 amount0, uint256 amount1)',
  'function decreaseLiquidity((uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline)) returns (uint256 amount0, uint256 amount1)',
  'function collect((uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max)) payable returns (uint256 amount0, uint256 amount1)',
  'function burn(uint256 tokenId) payable',
  'event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
  'event DecreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
  'event Collect(uint256 indexed tokenId, address recipient, uint256 amount0, uint256 amount1)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

export const FACTORY_ABI = [
  'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)',
  'event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)',
];

export const MIN_TICK = -887272;
export const MAX_TICK = 887272;

// Full-range tick bounds for fee=3000 (tickSpacing=60).
// tickSpacing must divide ticks evenly: 887272 / 60 = 14787.866 -> floor -> 14787 * 60 = 887220.
export const FULL_RANGE_TICK_LOWER = -887220;
export const FULL_RANGE_TICK_UPPER = 887220;

export const tokenBySymbol = (symbol) => DEX_TOKENS.find((t) => t.symbol === symbol);
export const tokenByAddress = (addr) => DEX_TOKENS.find((t) => t.address.toLowerCase() === String(addr).toLowerCase());

// Returns true if a swap is supported for this in/out pair (currently routes
// must go through wLITHO since that's the only paired side for v0).
export const isSupportedPair = (tokenInSymbol, tokenOutSymbol) => {
  if (tokenInSymbol === tokenOutSymbol) return false;
  const supported = ['QTT', 'COLLE', 'LitBTC'];
  return (
    (tokenInSymbol === 'wLITHO' && supported.includes(tokenOutSymbol)) ||
    (tokenOutSymbol === 'wLITHO' && supported.includes(tokenInSymbol))
  );
};
