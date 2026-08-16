/**
 * Singleton factory for the MultXClient used across the kamet-explorer app.
 *
 * Reads bridge address + API URL from Vite env vars, normalizes the LEP100
 * token list out of `data/kametRegistry`, and constructs one MultXClient at
 * module load time. Re-exports `MULTX_CONFIG` (legacy shape) and `MultXAPI`
 * (URL builder) so existing call sites can keep working with minimal change
 * during the migration.
 */
import { ethers } from 'ethers5';
import { MultXClient, normalizeAddress } from '@litho/multx-sdk';
import { KAMET_KNOWN_TOKENS } from '../data/kametRegistry';

const normalizeAddressLocal = (value = '') => {
  // The shared SDK helper uses ethers v6's address validators. The kamet-explorer
  // uses ethers v5 elsewhere — keep behaviour identical to the legacy file by
  // delegating to the SDK helper, which already normalizes via ethers v6.
  return normalizeAddress(value);
};

const bridgeAddress = normalizeAddressLocal(import.meta.env.VITE_MULTX_BRIDGE_ADDRESS || '');
const bridgeApiUrl = import.meta.env.VITE_MULTX_API_URL || 'https://bridge.litho.ai';
const lithoTokenAddress = normalizeAddressLocal(import.meta.env.VITE_LITHO_TOKEN_ADDRESS || '');

const lep100Tokens = KAMET_KNOWN_TOKENS
  .filter((t) => t.type === 'LEP100')
  .map((t) => ({
    symbol: t.symbol,
    name: t.name,
    decimals: t.decimals,
    address: normalizeAddressLocal(t.address),
    icon: null
  }));

const destinationChains = [
  { name: 'Ethereum Sepolia',  chainId: 11155111, symbol: 'ETH', label: 'Testnet' },
  { name: 'BNB Testnet',       chainId: 97,       symbol: 'BNB', label: 'Testnet' },
  { name: 'Base Sepolia',      chainId: 84532,    symbol: 'ETH', label: 'Testnet' },
  { name: 'Ethereum Mainnet',  chainId: 1,        symbol: 'ETH', label: 'Mainnet' },
];

export const multxClient = new MultXClient({
  bridgeAddress,
  bridgeApiUrl,
  supportedTokens: lep100Tokens,
  destinationChains,
  lithoTokenAddress,
  chains: { lithosphere: 900523, ethereum: 1 }
});

/**
 * Legacy compatibility shim. Existing consumers (Swap.jsx, deploymentStatusService.js)
 * read fields off MULTX_CONFIG directly. This shape mirrors the original
 * src/config/multx.js export so the migration is a one-line import swap.
 */
export const MULTX_CONFIG = {
  bridgeAddress: multxClient.bridgeAddress,
  bridgeApiUrl: multxClient.bridgeApiUrl,
  supportedTokens: multxClient.supportedTokens,
  destinationChains: multxClient.destinationChains,
  lithoTokenAddress: multxClient.lithoTokenAddress,
  chains: multxClient.chains,
};

/**
 * Legacy URL-builder shim. Maps onto the SDK's `client.api.urls` namespace.
 */
export const MultXAPI = multxClient.api.urls;

// Re-export ethers v5 reference as well, in case any consumer imports it from
// here today. (Currently nobody does — this is just a safety hatch for the
// migration window.)
export { ethers };
