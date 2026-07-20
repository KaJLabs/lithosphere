/**
 * Lithoswap V2 same-chain swap integration (Makalu 700777).
 *
 * Talks to the Lithoswap Router (a Uniswap V2 port deployed by
 * Makalu/contracts/scripts/deploy-dex.ts) with ethers v6. Quotes are read-only
 * via getAmountsOut against the public RPC; the swap itself goes through the
 * connected wallet. WLITHO is the routing base — pairs are seeded token↔WLITHO,
 * so a token→token swap routes token→WLITHO→token.
 *
 * The router address is injected at build time as NEXT_PUBLIC_SWAP_ROUTER once
 * the DEX is deployed; until then `isSwapConfigured()` is false and the UI shows
 * a "not yet live" state instead of calling a zero address.
 */
import { BrowserProvider, Contract, JsonRpcProvider, formatUnits, parseUnits } from 'ethers';
import type { Eip1193Provider } from 'ethers';
import { BRIDGE_TOKENS, approveIfNeeded } from '@/lib/bridge';

export const MAKALU_CHAIN_ID = 700777;
export const MAKALU_RPC = 'https://rpc.litho.ai';

/** WLITHO — the wrapped-native LEP-100 ERC-20, used as the routing base. */
export const WLITHO_ADDRESS = '0x599a7E135f1790ae117b4EdDc0422D24Bc766161';

/** Router address, injected post-deploy. Empty until the DEX is live. */
export const SWAP_ROUTER = (process.env.NEXT_PUBLIC_SWAP_ROUTER ?? '').trim();

const ZERO = '0x0000000000000000000000000000000000000000';

export function isSwapConfigured(): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(SWAP_ROUTER) && SWAP_ROUTER.toLowerCase() !== ZERO;
}

export interface SwapToken {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
}

/**
 * Swappable tokens on Makalu = the same LEP-100 set the bridge lists, using
 * their Makalu-side addresses (wLITHO first — it is the routing base).
 */
export const SWAP_TOKENS: SwapToken[] = BRIDGE_TOKENS.map((t) => ({
  symbol: t.symbol,
  name: t.name,
  address: t.makalu,
  decimals: t.decimals,
}));

const ROUTER_ABI = [
  'function factory() view returns (address)',
  'function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)',
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)',
];

/**
 * Route between two tokens. A direct pair is used when one side is WLITHO;
 * otherwise the swap hops through WLITHO (the base every pool is seeded against).
 */
export function buildPath(tokenIn: string, tokenOut: string): string[] {
  const wl = WLITHO_ADDRESS.toLowerCase();
  if (tokenIn.toLowerCase() === wl || tokenOut.toLowerCase() === wl) {
    return [tokenIn, tokenOut];
  }
  return [tokenIn, WLITHO_ADDRESS, tokenOut];
}

export interface Quote {
  /** Raw output amount (wei of tokenOut). */
  amountOut: bigint;
  /** Route taken. */
  path: string[];
  /** True when the hop goes token→WLITHO→token. */
  multiHop: boolean;
}

/**
 * Read-only quote via the router's getAmountsOut. Returns null if the DEX is
 * not configured; throws (caller shows the message) when the route has no
 * liquidity — getAmountsOut reverts in that case.
 */
export async function getQuote(
  amountInHuman: string,
  tokenIn: string,
  decimalsIn: number,
  tokenOut: string,
): Promise<Quote | null> {
  if (!isSwapConfigured()) return null;
  if (!/^\d+(\.\d+)?$/.test(amountInHuman) || Number(amountInHuman) <= 0) return null;

  const provider = new JsonRpcProvider(MAKALU_RPC);
  const router = new Contract(SWAP_ROUTER, ROUTER_ABI, provider);
  const amountIn = parseUnits(amountInHuman, decimalsIn);
  const path = buildPath(tokenIn, tokenOut);
  const amounts = (await router.getAmountsOut(amountIn, path)) as bigint[];
  return { amountOut: amounts[amounts.length - 1], path, multiHop: path.length > 2 };
}

/** Apply a slippage tolerance (in basis points) to a quoted output. */
export function minOut(amountOut: bigint, slippageBps: number): bigint {
  return (amountOut * BigInt(10_000 - slippageBps)) / BigInt(10_000);
}

/** Ensure the router can pull `amount` of `token` from the user. */
export async function ensureAllowance(
  walletProvider: Eip1193Provider,
  token: string,
  amount: bigint,
): Promise<string | null> {
  return approveIfNeeded(walletProvider, token, SWAP_ROUTER, amount);
}

/**
 * Execute the swap through the connected wallet. `amountOutMin` is the
 * slippage-guarded floor; the tx reverts on-chain if the pool can't deliver it.
 */
export async function swapExactTokensForTokens(
  walletProvider: Eip1193Provider,
  tokenIn: string,
  tokenOut: string,
  amountInHuman: string,
  decimalsIn: number,
  amountOutMin: bigint,
  to: string,
  deadlineSecondsFromNow = 1800,
): Promise<string> {
  const signer = await new BrowserProvider(walletProvider).getSigner();
  const router = new Contract(SWAP_ROUTER, ROUTER_ABI, signer);
  const amountIn = parseUnits(amountInHuman, decimalsIn);
  const path = buildPath(tokenIn, tokenOut);
  const deadline = Math.floor(Date.now() / 1000) + deadlineSecondsFromNow;

  const tx = await router.swapExactTokensForTokens(amountIn, amountOutMin, path, to, deadline);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error('Swap transaction failed');
  return tx.hash;
}

export function formatAmount(value: bigint, decimals: number, maxFrac = 6): string {
  const s = formatUnits(value, decimals);
  const [int, frac = ''] = s.split('.');
  return frac ? `${int}.${frac.slice(0, maxFrac)}`.replace(/\.?0+$/, '') || int : int;
}

/** Compact, actionable message for the common swap failures. */
export function describeSwapError(err: unknown, symbolOut: string): string {
  const e = err as { code?: number | string; shortMessage?: string; reason?: string; message?: string } | null;
  const msg = [e?.shortMessage, e?.reason, e?.message].filter((v) => typeof v === 'string').join(' | ');

  if (e?.code === 'ACTION_REJECTED' || /user denied|user rejected|4001/i.test(msg)) {
    return 'Swap cancelled in the wallet — nothing was sent.';
  }
  if (/INSUFFICIENT_OUTPUT_AMOUNT/i.test(msg)) {
    return `Price moved beyond your slippage tolerance — you'd receive less ${symbolOut} than the minimum. Raise slippage or retry.`;
  }
  if (/INSUFFICIENT_LIQUIDITY|PAIR_NOT_FOUND/i.test(msg)) {
    return 'This pair has no liquidity pool yet on Lithoswap. Try routing through wLITHO or pick another token.';
  }
  if (/EXPIRED/i.test(msg)) {
    return 'The swap deadline passed before it confirmed. Retry.';
  }
  if (/insufficient funds/i.test(msg)) {
    return 'Not enough native LITHO to pay gas — top up from the faucet and retry.';
  }
  if (/transfer amount exceeds balance|insufficient balance/i.test(msg)) {
    return 'Insufficient token balance for this swap.';
  }
  const trimmed = msg.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed.slice(0, 200) : 'Swap failed.';
}
