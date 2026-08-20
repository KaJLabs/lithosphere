/**
 * Cross-chain token swap — the saga that composes the MultX bridge with the
 * Lithoswap DEX so a user can go from token A on chain X to token B on chain Y.
 *
 * The DEX lives on Makalu, and the bridge locks only on the Lithosphere chains
 * (Makalu/Kamet), so a full route is up to three legs:
 *
 *   bridge_in (X → Makalu)  →  swap (A → B on Makalu)  →  bridge_out (Makalu → Y)
 *
 * Legs whose chain is already Makalu are dropped. Each bridge leg is itself
 * multi-step (lock → wait for validator signatures → claim), and claims on
 * external chains are relayer-driven rather than user-submitted.
 *
 * This is a long-running, multi-signature, multi-chain flow, so the whole saga
 * is a persisted state machine: every completed leg is written to localStorage,
 * and `currentStep()` recomputes the next action from that record — so a user
 * who closes the tab mid-flow resumes exactly where they left off. This module
 * is the logic; pages/cross-swap.tsx drives it and owns the wallet/chain UX.
 */
import { Contract, JsonRpcProvider, formatUnits, parseUnits, type Eip1193Provider } from 'ethers';
import {
  BRIDGE_TOKENS,
  approveIfNeeded,
  chainByKey,
  fetchSignatures,
  fetchStatus,
  lockTokens,
  releaseTokens,
  tokenAddressFor,
  type BridgeToken,
  type ChainInfo,
} from '@/lib/bridge';
import {
  MAKALU_RPC,
  SWAP_ROUTER,
  ensureAllowance,
  getQuote,
  minOut,
  swapExactTokensForTokens,
} from '@/lib/swap';

export type Phase = 'bridge_in' | 'swap' | 'bridge_out';

export type StepKind =
  | 'bridge_in_lock'
  | 'bridge_in_claim'
  | 'swap'
  | 'bridge_out_lock'
  | 'bridge_out_claim'
  | 'await_relayer'
  | 'done';

export interface SagaConfig {
  symbolIn: string;
  symbolOut: string;
  /** Source chain key — must be a lock-capable Lithosphere chain (makalu|kamet). */
  chainXKey: string;
  /** Destination chain key (makalu|kamet|sepolia|base|bnb). */
  chainYKey: string;
  /** Human input amount of token A. */
  amountIn: string;
  slippageBps: number;
}

interface BridgeLeg {
  bridgeTxHash?: string;
  ethTxHash?: string;
  releaseTxHash?: string;
  claimed?: boolean;
}

export interface SagaState {
  id: string;
  createdAt: number;
  config: SagaConfig;
  plan: Phase[];
  bridgeIn?: BridgeLeg;
  swap?: { txHash?: string; receivedB?: string /* wei, as string */ };
  bridgeOut?: BridgeLeg;
  status: 'active' | 'completed' | 'failed';
  error?: string;
}

const STORAGE_KEY = 'litho_crossswap_active';
const ERC20_BAL_ABI = ['function balanceOf(address) view returns (uint256)'];

// ── Lookups ──────────────────────────────────────────────────────────────────

export function tokenBySymbol(symbol: string): BridgeToken {
  return BRIDGE_TOKENS.find((t) => t.symbol === symbol) ?? BRIDGE_TOKENS[0];
}

function chain(key: string): ChainInfo {
  const c = chainByKey(key);
  if (!c) throw new Error(`Unknown chain: ${key}`);
  return c;
}

/** Source chains a cross-swap can start from: the lock-capable Lithosphere chains. */
export const SOURCE_CHAIN_KEYS = ['makalu', 'kamet'] as const;

// ── Planning ─────────────────────────────────────────────────────────────────

/** The ordered legs for a route. Swap always runs on Makalu. */
export function planRoute(chainXKey: string, chainYKey: string): Phase[] {
  const plan: Phase[] = [];
  if (chainXKey !== 'makalu') plan.push('bridge_in');
  plan.push('swap');
  if (chainYKey !== 'makalu') plan.push('bridge_out');
  return plan;
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createSaga(config: SagaConfig): SagaState {
  return {
    id: makeId(),
    createdAt: Date.now(),
    config,
    plan: planRoute(config.chainXKey, config.chainYKey),
    status: 'active',
  };
}

// ── Persistence (one active saga at a time) ──────────────────────────────────

export function saveSaga(saga: SagaState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saga));
  } catch {
    /* storage unavailable — caller keeps it in memory */
  }
}

export function loadSaga(): SagaState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SagaState) : null;
  } catch {
    return null;
  }
}

export function clearSaga(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// ── Step machine ─────────────────────────────────────────────────────────────

/** The next action the saga needs, derived purely from its persisted record. */
export function currentStep(saga: SagaState): StepKind {
  const hasBridgeIn = saga.plan.includes('bridge_in');
  const hasBridgeOut = saga.plan.includes('bridge_out');

  if (hasBridgeIn && !saga.bridgeIn?.claimed) {
    return saga.bridgeIn?.bridgeTxHash ? 'bridge_in_claim' : 'bridge_in_lock';
  }
  if (!saga.swap?.txHash) {
    return 'swap';
  }
  if (hasBridgeOut) {
    const destLitho = chain(saga.config.chainYKey).litho;
    if (!saga.bridgeOut?.bridgeTxHash) return 'bridge_out_lock';
    if (destLitho) {
      if (!saga.bridgeOut?.claimed) return 'bridge_out_claim';
    } else {
      // External destination: the relayer releases; we only wait.
      if (!saga.bridgeOut?.releaseTxHash) return 'await_relayer';
    }
  }
  return 'done';
}

export interface StepInfo {
  kind: StepKind;
  /** Chain the user's wallet must be on for this step (null = no user tx). */
  chainKey: string | null;
  chainId: number | null;
  title: string;
  /** Bridge internal hash to poll for signatures/relayer, when relevant. */
  bridgeTxHash?: string;
}

export function describeStep(saga: SagaState): StepInfo {
  const kind = currentStep(saga);
  const x = chain(saga.config.chainXKey);
  const y = chain(saga.config.chainYKey);
  const mk = chain('makalu');
  const { symbolIn, symbolOut } = saga.config;

  switch (kind) {
    case 'bridge_in_lock':
      return { kind, chainKey: x.key, chainId: x.chainId, title: `Lock ${symbolIn} on ${x.name}` };
    case 'bridge_in_claim':
      return {
        kind,
        chainKey: mk.key,
        chainId: mk.chainId,
        title: `Claim ${symbolIn} on ${mk.name}`,
        bridgeTxHash: saga.bridgeIn?.bridgeTxHash,
      };
    case 'swap':
      return { kind, chainKey: mk.key, chainId: mk.chainId, title: `Swap ${symbolIn} → ${symbolOut} on ${mk.name}` };
    case 'bridge_out_lock':
      return { kind, chainKey: mk.key, chainId: mk.chainId, title: `Lock ${symbolOut} on ${mk.name}` };
    case 'bridge_out_claim':
      return {
        kind,
        chainKey: y.key,
        chainId: y.chainId,
        title: `Claim ${symbolOut} on ${y.name}`,
        bridgeTxHash: saga.bridgeOut?.bridgeTxHash,
      };
    case 'await_relayer':
      return {
        kind,
        chainKey: null,
        chainId: null,
        title: `Waiting for the relayer to release ${symbolOut} on ${y.name}`,
        bridgeTxHash: saga.bridgeOut?.bridgeTxHash,
      };
    case 'done':
      return { kind, chainKey: null, chainId: null, title: 'Complete' };
  }
}

// ── Balance helper (Makalu) ──────────────────────────────────────────────────

async function makaluBalance(token: string, owner: string): Promise<bigint> {
  const provider = new JsonRpcProvider(MAKALU_RPC);
  const erc20 = new Contract(token, ERC20_BAL_ABI, provider);
  return (await erc20.balanceOf(owner)) as bigint;
}

// ── Executors — each performs ONE user-facing step and returns the new saga ──

export async function runBridgeInLock(
  saga: SagaState,
  walletProvider: Eip1193Provider,
): Promise<SagaState> {
  const token = tokenBySymbol(saga.config.symbolIn);
  const source = chain(saga.config.chainXKey);
  const makalu = chain('makalu');
  const tokenAddr = tokenAddressFor(token, source.key);

  await approveIfNeeded(walletProvider, tokenAddr, source.bridge, parseUnits(saga.config.amountIn, token.decimals));
  const { ethTxHash, bridgeTxHash } = await lockTokens(
    walletProvider,
    source.bridge,
    tokenAddr,
    saga.config.amountIn,
    token.decimals,
    makalu.chainId,
  );
  return { ...saga, bridgeIn: { ...saga.bridgeIn, ethTxHash, bridgeTxHash } };
}

/** Returns true once enough validator signatures exist to claim. */
export async function claimReady(bridgeTxHash: string): Promise<boolean> {
  const status = await fetchStatus(bridgeTxHash);
  if (!status) return false;
  if (status.status === 'completed' || status.releaseTxHash) return true;
  return status.signaturesCollected >= status.signaturesRequired && status.signaturesRequired > 0;
}

export async function runBridgeInClaim(
  saga: SagaState,
  walletProvider: Eip1193Provider,
): Promise<SagaState> {
  const hash = saga.bridgeIn?.bridgeTxHash;
  if (!hash) throw new Error('No bridge-in transaction to claim');
  const status = await fetchStatus(hash);
  if (!status) throw new Error('Bridge status unavailable — try again shortly');
  const makalu = chain('makalu');

  if (status.status === 'completed' || status.releaseTxHash) {
    return { ...saga, bridgeIn: { ...saga.bridgeIn, claimed: true, releaseTxHash: status.releaseTxHash ?? undefined } };
  }
  const sigs = await fetchSignatures(hash);
  const releaseTxHash = await releaseTokens(walletProvider, makalu.bridge, status, sigs);
  return { ...saga, bridgeIn: { ...saga.bridgeIn, claimed: true, releaseTxHash } };
}

export async function runSwap(
  saga: SagaState,
  walletProvider: Eip1193Provider,
  address: string,
): Promise<SagaState> {
  const tokenIn = tokenBySymbol(saga.config.symbolIn);
  const tokenOut = tokenBySymbol(saga.config.symbolOut);

  const before = await makaluBalance(tokenOut.makalu, address);
  const quote = await getQuote(saga.config.amountIn, tokenIn.makalu, tokenIn.decimals, tokenOut.makalu);
  if (!quote) throw new Error('No swap route/liquidity for this pair on Makalu');

  const amountIn = parseUnits(saga.config.amountIn, tokenIn.decimals);
  await ensureAllowance(walletProvider, tokenIn.makalu, amountIn);
  const txHash = await swapExactTokensForTokens(
    walletProvider,
    tokenIn.makalu,
    tokenOut.makalu,
    saga.config.amountIn,
    tokenIn.decimals,
    minOut(quote.amountOut, saga.config.slippageBps),
    address,
  );
  const after = await makaluBalance(tokenOut.makalu, address);
  const receivedB = (after - before).toString();
  return { ...saga, swap: { txHash, receivedB } };
}

export async function runBridgeOutLock(
  saga: SagaState,
  walletProvider: Eip1193Provider,
): Promise<SagaState> {
  const token = tokenBySymbol(saga.config.symbolOut);
  const makalu = chain('makalu');
  const dest = chain(saga.config.chainYKey);
  const receivedWei = BigInt(saga.swap?.receivedB ?? '0');
  if (receivedWei <= BigInt(0)) throw new Error('No swapped balance to bridge out');
  const amountHuman = formatUnits(receivedWei, token.decimals);

  await approveIfNeeded(walletProvider, token.makalu, makalu.bridge, receivedWei);
  const { ethTxHash, bridgeTxHash } = await lockTokens(
    walletProvider,
    makalu.bridge,
    token.makalu,
    amountHuman,
    token.decimals,
    dest.chainId,
  );
  return { ...saga, bridgeOut: { ...saga.bridgeOut, ethTxHash, bridgeTxHash } };
}

export async function runBridgeOutClaim(
  saga: SagaState,
  walletProvider: Eip1193Provider,
): Promise<SagaState> {
  const hash = saga.bridgeOut?.bridgeTxHash;
  if (!hash) throw new Error('No bridge-out transaction to claim');
  const status = await fetchStatus(hash);
  if (!status) throw new Error('Bridge status unavailable — try again shortly');
  const dest = chain(saga.config.chainYKey);

  if (status.status === 'completed' || status.releaseTxHash) {
    return { ...saga, bridgeOut: { ...saga.bridgeOut, claimed: true, releaseTxHash: status.releaseTxHash ?? undefined } };
  }
  const sigs = await fetchSignatures(hash);
  const releaseTxHash = await releaseTokens(walletProvider, dest.bridge, status, sigs);
  return { ...saga, bridgeOut: { ...saga.bridgeOut, claimed: true, releaseTxHash } };
}

/** Poll an external-chain bridge-out for relayer completion. */
export async function pollRelayer(saga: SagaState): Promise<SagaState> {
  const hash = saga.bridgeOut?.bridgeTxHash;
  if (!hash) return saga;
  const status = await fetchStatus(hash);
  if (status && (status.status === 'completed' || status.releaseTxHash)) {
    return { ...saga, bridgeOut: { ...saga.bridgeOut, releaseTxHash: status.releaseTxHash ?? undefined } };
  }
  return saga;
}

/** True when the saga has no remaining steps. */
export function isComplete(saga: SagaState): boolean {
  return currentStep(saga) === 'done';
}

export function isCrossSwapConfigured(): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(SWAP_ROUTER);
}
