import { ethers } from 'ethers5';
import { CHAIN_CONFIG } from '../config/api';
import {
  BRIDGE_ADDRESS,
  BRIDGE_ABI_MINIMAL,
  ERC20_BRIDGE_ABI,
  DEST_CHAIN_DEPLOYMENTS,
} from '../data/bridgeConfig';
import { sortReleaseSignatures } from './releaseMessage';

const READ_RPC = import.meta.env.DEV
  ? '/rpc-proxy'
  : (import.meta.env.VITE_EVM_RPC_URL || 'https://rpc-3.litho.ai');
const CHAIN_ID = Number(import.meta.env.VITE_EVM_CHAIN_ID) || 900523;

const readProvider = () =>
  new ethers.providers.StaticJsonRpcProvider(READ_RPC, {
    chainId: CHAIN_ID,
    name: 'lithosphere-kamet',
  });

// ─── Multichain provider cache (for Inbound direction) ────────────────────

const destProviders = new Map();
const destProvider = (chainId) => {
  if (destProviders.has(chainId)) return destProviders.get(chainId);
  const dep = DEST_CHAIN_DEPLOYMENTS[chainId];
  if (!dep) throw new Error(`No deployment record for chain ${chainId}`);
  const p = new ethers.providers.StaticJsonRpcProvider(dep.rpc, {
    chainId,
    name: dep.name,
  });
  destProviders.set(chainId, p);
  return p;
};

const destBridge = (chainId, signerOrProvider) => {
  const dep = DEST_CHAIN_DEPLOYMENTS[chainId];
  if (!dep) throw new Error(`No deployment record for chain ${chainId}`);
  return new ethers.Contract(dep.bridge, BRIDGE_ABI_MINIMAL, signerOrProvider || destProvider(chainId));
};

const destToken = (chainId, tokenAddress, signerOrProvider) => {
  return new ethers.Contract(tokenAddress, ERC20_BRIDGE_ABI, signerOrProvider || destProvider(chainId));
};

// Read balance / allowance on a specific destination chain (Inbound).
export const getDestTokenBalance = async (chainId, tokenAddress, ownerAddress) => {
  const c = destToken(chainId, tokenAddress);
  return c.balanceOf(ownerAddress);
};

export const getDestTokenAllowance = async (chainId, tokenAddress, ownerAddress) => {
  const dep = DEST_CHAIN_DEPLOYMENTS[chainId];
  if (!dep) throw new Error(`No deployment record for chain ${chainId}`);
  const c = destToken(chainId, tokenAddress);
  return c.allowance(ownerAddress, dep.bridge);
};

// Approve + lock against the destination-chain bridge. Signer must be on `chainId`.
export const approveOnDest = async (signer, chainId, tokenAddress, amount) => {
  const dep = DEST_CHAIN_DEPLOYMENTS[chainId];
  if (!dep) throw new Error(`No deployment record for chain ${chainId}`);
  const c = destToken(chainId, tokenAddress, signer);
  const tx = await c.approve(dep.bridge, amount);
  return tx.wait();
};

// Lock on a dest chain (wrapped token → Kamet release).
// targetChain is always Kamet (900523) for v1 Inbound.
export const lockOnDest = async (signer, chainId, tokenAddress, amount, targetChain = 900523) => {
  const c = destBridge(chainId, signer);
  const tx = await c.lockTokens(tokenAddress, amount, targetChain);
  const receipt = await tx.wait();
  return { txHash: tx.hash, receipt };
};

// ─── On-chain reads ────────────────────────────────────────────────────────

export const getBridgeContract = (signerOrProvider) =>
  new ethers.Contract(BRIDGE_ADDRESS, BRIDGE_ABI_MINIMAL, signerOrProvider);

export const getTokenContract = (tokenAddress, signerOrProvider) =>
  new ethers.Contract(tokenAddress, ERC20_BRIDGE_ABI, signerOrProvider);

export const getTokenBalance = async (tokenAddress, ownerAddress) => {
  const c = getTokenContract(tokenAddress, readProvider());
  return c.balanceOf(ownerAddress);
};

export const getTokenAllowance = async (tokenAddress, ownerAddress) => {
  const c = getTokenContract(tokenAddress, readProvider());
  return c.allowance(ownerAddress, BRIDGE_ADDRESS);
};

export const getBridgePaused = async () => {
  const c = getBridgeContract(readProvider());
  return c.paused();
};

export const getDailyRemaining = async (tokenAddress) => {
  const c = getBridgeContract(readProvider());
  return c.getDailyRemaining(tokenAddress);
};

// ─── Write-side (requires signer) ─────────────────────────────────────────

export const approveToken = async (signer, tokenAddress, amount) => {
  const c = getTokenContract(tokenAddress, signer);
  const tx = await c.approve(BRIDGE_ADDRESS, amount);
  return tx.wait();
};

export const lockTokens = async (signer, tokenAddress, amount, targetChainId) => {
  const c = getBridgeContract(signer);
  const tx = await c.lockTokens(tokenAddress, amount, targetChainId);
  const receipt = await tx.wait();
  return { txHash: tx.hash, receipt };
};

export const releaseTokens = async (signer, { token, user, amount, sourceChain, sourceNonce, sourceTxHash, signatures }) => {
  const c = getBridgeContract(signer);
  const destinationChain = await signer.getChainId();
  const sortedSigs = sortReleaseSignatures(signatures, {
    sourceTxHash,
    token,
    user,
    amount,
    sourceChain,
    sourceNonce,
    destinationChain,
    destinationBridge: c.address,
  });
  const tx = await c.releaseTokens(token, user, amount, sourceChain, sourceNonce, sourceTxHash, sortedSigs);
  const receipt = await tx.wait();
  return { txHash: tx.hash, receipt };
};

// ─── Bridge API calls ──────────────────────────────────────────────────────

const BRIDGE_API = CHAIN_CONFIG.explorerDataApiUrl; // /api on same nginx origin

const apiFetch = async (path) => {
  const res = await fetch(`${BRIDGE_API}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Bridge API error: ${res.status}`);
  }
  return res.json();
};

export const getBridgeStatus = (txHash) => apiFetch(`/bridge/status/${txHash}`);
export const getBridgeSignatures = (txHash) => apiFetch(`/bridge/signatures/${txHash}`);
export const getBridgeHistory = (address, limit = 25, cursor) => {
  const params = new URLSearchParams({ limit });
  if (cursor) params.set('cursor', cursor);
  return apiFetch(`/bridge/transactions/${address}?${params}`);
};
export const getSupportedChains = () => apiFetch('/chains');
