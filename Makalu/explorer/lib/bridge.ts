/**
 * MultX cross-chain bridge integration (Route 1: Makalu ↔ Kamet).
 *
 * On-chain calls use ethers v6 against the deployed MultXBridge contracts;
 * status/signature/history reads go through the same-origin `/api/bridge/*`
 * proxy (which forwards to the shared bridge-api). The release/claim flow
 * mirrors the proven kamet-explorer + @litho/multx-sdk logic.
 */
import { BrowserProvider, Contract, Interface, parseUnits } from 'ethers';
import type { Eip1193Provider } from 'ethers';

export const BRIDGE_CHAINS = {
  makalu: { chainId: 700777, name: 'Lithosphere Makalu', bridge: '0x5832D5E609c6690f74c7683606Eb20F89ff096a6' },
  kamet: { chainId: 900523, name: 'Lithosphere Kamet', bridge: '0x3a896BDF3a1088287FA84aB5a43bB30e2535F263' },
} as const;

export type BridgeDirection = 'makalu-to-kamet' | 'kamet-to-makalu';

export interface BridgeToken {
  symbol: string;
  name: string;
  decimals: number;
  makalu: string;
  kamet: string;
}

/** Route 1 token pairs (same source-of-truth as the API proxy config). */
export const BRIDGE_TOKENS: BridgeToken[] = [
  { symbol: 'wLITHO', name: 'Wrapped Lithosphere', decimals: 18, makalu: '0x599a7E135f1790ae117b4EdDc0422D24Bc766161', kamet: '0xC0FC628e3aB128fe387e7ed5e729bD809C017888' },
  { symbol: 'LitBTC', name: 'Lithosphere LitBTC', decimals: 18, makalu: '0xC4645CA5411D6E27556780AB4cdd0DF7e609df74', kamet: '0x3A8D5FdC6c8dA9f14C535424b6F7206eC1996016' },
  { symbol: 'LAX', name: 'Lithosphere Algo', decimals: 18, makalu: '0x1Cde2Ca6c2ab8622003ebe06e382bC07850d4B8d', kamet: '0xe8f504f9cE5391Fb5968b317f0b24b8A0306ACeb' },
  { symbol: 'JOT', name: 'Jot Art', decimals: 18, makalu: '0xEF2f35f6d0fb7DC9E87b8ca8252AE2E6ffb2a25e', kamet: '0x6AE14CEb3962664b13c5dEF29EB172De76bd0ac9' },
  { symbol: 'COLLE', name: 'Colle AI', decimals: 18, makalu: '0x10D4BB600c96e9243E2f50baFED8b2478F25af61', kamet: '0x0573f66cb4bC34618e7AB8a941F7883DD2515dCA' },
  { symbol: 'IMAGE', name: 'Imagen Network', decimals: 18, makalu: '0xAcD98E323968647936887aD4934e64B01060727e', kamet: '0x8Ba6E3A0759144245f2939eB54164e32bb78B8E0' },
  { symbol: 'AGII', name: 'AGII', decimals: 18, makalu: '0x10052B8ccD2160b8F9880C6b4F5DD117fF253B1c', kamet: '0x17D506aF1d0Dc2f4f64f15748a5aC46FAd3f06D7' },
  { symbol: 'BLDR', name: 'Built AI', decimals: 18, makalu: '0x798eD6bFc5bfCFc60938d5098825b354427A0786', kamet: '0xF05f1F79273874E554F02ce06585E16132a3B62B' },
  { symbol: 'FGPT', name: 'FurGPT', decimals: 18, makalu: '0x151ef362eA96853702Cc5e7728107e3961fbD22e', kamet: '0x2F366c6350A6b211f6D6F847c3D56738C2E847ca' },
  { symbol: 'MUSA', name: 'Mansa AI', decimals: 18, makalu: '0xDB829befCF8E582379E2c034FA2589b8D2EA1c5D', kamet: '0x17A357262097B4e70acFfe8B71bC61e8bBcc3B42' },
];

const BRIDGE_ABI = [
  'function lockTokens(address token, uint256 amount, uint256 targetChain) returns (bytes32)',
  'function releaseTokens(address token, address user, uint256 amount, uint256 sourceChain, uint256 sourceNonce, bytes32 sourceTxHash, bytes[] signatures)',
  'function supportedTokens(address) view returns (bool)',
  'event TokensLocked(bytes32 indexed txHash, address indexed token, address indexed user, uint256 amount, uint256 targetChain, uint256 nonce)',
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
];

export interface BridgeStatus {
  txHash: string;
  fromAddress: string;
  tokenAddress: string;
  releaseToken: string | null;
  amount: string;
  sourceChain: number;
  targetChain: number | null;
  sourceNonce: number | string;
  status: 'pending' | 'signing' | 'completed' | 'failed' | string;
  signaturesCollected: number;
  signaturesRequired: number;
  releaseTxHash: string | null;
}

export interface BridgeHistoryItem {
  txHash: string;
  timestamp: string;
  fromToken: string;
  toToken: string;
  sourceChain: number;
  targetChain: number | null;
  amount: string;
  status: string;
  explorerUrl?: string;
}

export function sourceChainFor(direction: BridgeDirection): number {
  return direction === 'makalu-to-kamet' ? BRIDGE_CHAINS.makalu.chainId : BRIDGE_CHAINS.kamet.chainId;
}

export function targetChainFor(direction: BridgeDirection): number {
  return direction === 'makalu-to-kamet' ? BRIDGE_CHAINS.kamet.chainId : BRIDGE_CHAINS.makalu.chainId;
}

async function getSigner(walletProvider: Eip1193Provider) {
  const provider = new BrowserProvider(walletProvider);
  return provider.getSigner();
}

/** Ensure the bridge has at least `amount` allowance for `tokenAddress`. */
export async function approveIfNeeded(
  walletProvider: Eip1193Provider,
  tokenAddress: string,
  spender: string,
  amount: bigint,
): Promise<string | null> {
  const signer = await getSigner(walletProvider);
  const owner = await signer.getAddress();
  const token = new Contract(tokenAddress, ERC20_ABI, signer);
  const current: bigint = await token.allowance(owner, spender);
  if (current >= amount) return null;
  const tx = await token.approve(spender, amount);
  await tx.wait();
  return tx.hash;
}

export interface LockResult {
  /** EVM transaction hash of the lock tx. */
  ethTxHash: string;
  /** Internal bridge hash (TokensLocked.txHash) — the key the bridge-api uses. */
  bridgeTxHash: string;
}

/**
 * Lock tokens on the *source* chain (the chain the wallet is currently on).
 * Returns both the EVM tx hash and the internal bridge hash to poll status with.
 */
export async function lockTokens(
  walletProvider: Eip1193Provider,
  sourceBridge: string,
  tokenAddress: string,
  amountHuman: string,
  decimals: number,
  targetChainId: number,
): Promise<LockResult> {
  const signer = await getSigner(walletProvider);
  const amount = parseUnits(amountHuman, decimals);
  const bridge = new Contract(sourceBridge, BRIDGE_ABI, signer);

  const supported: boolean = await bridge.supportedTokens(tokenAddress).catch(() => true);
  if (!supported) throw new Error('Token is not on the bridge supported-token list');

  const tx = await bridge.lockTokens(tokenAddress, amount, targetChainId);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error('Lock transaction failed');

  // Recover the internal bridge hash from the TokensLocked event.
  const iface = new Interface(BRIDGE_ABI);
  let bridgeTxHash = '';
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== sourceBridge.toLowerCase()) continue;
    try {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === 'TokensLocked') {
        bridgeTxHash = parsed.args.txHash as string;
        break;
      }
    } catch {
      /* not our event */
    }
  }
  if (!bridgeTxHash) throw new Error('Lock succeeded but TokensLocked event was not found');

  return { ethTxHash: tx.hash, bridgeTxHash };
}

/**
 * Claim (release) tokens on the *destination* chain (the chain the wallet is
 * currently on). `status` + `signatures` come from the bridge-api for the
 * source lock's internal hash. Permissionless — the wallet just submits.
 */
export async function releaseTokens(
  walletProvider: Eip1193Provider,
  destBridge: string,
  status: BridgeStatus,
  signatures: string[],
): Promise<string> {
  if (!status.releaseToken) throw new Error('Release token unknown for this transfer');
  if (signatures.length < status.signaturesRequired) {
    throw new Error(`Need ${status.signaturesRequired} signatures, have ${signatures.length}`);
  }
  const signer = await getSigner(walletProvider);
  const bridge = new Contract(destBridge, BRIDGE_ABI, signer);
  const tx = await bridge.releaseTokens(
    status.releaseToken,
    status.fromAddress,
    status.amount,
    status.sourceChain,
    status.sourceNonce,
    status.txHash,
    signatures,
  );
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error('Release transaction failed');
  return tx.hash;
}

// ── bridge-api reads (via the same-origin /api/bridge proxy) ────────────────

export async function fetchStatus(bridgeTxHash: string): Promise<BridgeStatus | null> {
  const res = await fetch(`/api/bridge/status/${bridgeTxHash}`);
  if (!res.ok) return null;
  return (await res.json()) as BridgeStatus;
}

export async function fetchSignatures(bridgeTxHash: string): Promise<string[]> {
  const res = await fetch(`/api/bridge/signatures/${bridgeTxHash}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { signatures?: string[] };
  return Array.isArray(data.signatures) ? data.signatures : [];
}

export async function fetchHistory(address: string): Promise<BridgeHistoryItem[]> {
  try {
    const res = await fetch(`/api/bridge/transactions/${address}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { transactions?: BridgeHistoryItem[] };
    return Array.isArray(data.transactions) ? data.transactions : [];
  } catch {
    return [];
  }
}
