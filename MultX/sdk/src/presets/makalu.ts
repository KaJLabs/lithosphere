/**
 * Makalu testnet (EVM chainId 700777) MultX bridge preset.
 *
 * ```ts
 * import { MultXClient } from '@litho/multx-sdk';
 * import { MAKALU_TESTNET } from '@litho/multx-sdk/presets';
 *
 * const client = new MultXClient(MAKALU_TESTNET);
 * ```
 *
 * Verified live against `https://rpc.litho.ai` on 2026-06-17:
 *  - bridge `0x5832D5E6…096a6` has bytecode, `signaturesRequired == 2`;
 *  - all 10 tokens return `supportedTokens(addr) == true` and `symbol()` matches.
 *
 * Source of truth: contracts/deployments/makalu-bridge-latest.json.
 *
 * Routes (per the 2026-06-17 client decision, both planned):
 *  - Route 1 — Makalu ↔ Kamet — LIVE target below (`destinationChains`).
 *  - Route 2 — Makalu → Sepolia + Base Sepolia — LIVE (dest-side m-prefixed
 *    wrapped tokens deployed + registered on dest bridge `0xfdA3b83F…` 2026-06-18).
 *
 * NOTE: Makalu has 10 bridge tokens — QTT is Kamet-only.
 */

import type {
  DestinationChain,
  MultXConfig,
  SupportedToken,
} from '../types.js';

/** EVM chainId of Lithosphere Makalu testnet (the bridge's source chain). */
export const MAKALU_CHAIN_ID = 700777;

/** Deployed MultXBridge on Makalu (same hardened contract as Kamet). */
export const MAKALU_BRIDGE_ADDRESS =
  '0x5832D5E609c6690f74c7683606Eb20F89ff096a6';

/** Public bridge backend (shared with Kamet — multichain). */
export const MAKALU_BRIDGE_API_URL = 'https://bridge.litho.ai';

/** The 10 LEP100 tokens whitelisted on the Makalu bridge. */
export const MAKALU_SUPPORTED_TOKENS: SupportedToken[] = [
  { symbol: 'wLITHO', name: 'Wrapped LITHO',       decimals: 18, address: '0x599a7E135f1790ae117b4EdDc0422D24Bc766161' },
  { symbol: 'LitBTC', name: 'Lithosphere Bitcoin', decimals: 18, address: '0xC4645CA5411D6E27556780AB4cdd0DF7e609df74' },
  { symbol: 'LAX',    name: 'LAX Token',           decimals: 18, address: '0x1Cde2Ca6c2ab8622003ebe06e382bC07850d4B8d' },
  { symbol: 'JOT',    name: 'JOT Token',           decimals: 18, address: '0xEF2f35f6d0fb7DC9E87b8ca8252AE2E6ffb2a25e' },
  { symbol: 'COLLE',  name: 'Colle AI',            decimals: 18, address: '0x10D4BB600c96e9243E2f50baFED8b2478F25af61' },
  { symbol: 'IMAGE',  name: 'Image AI',            decimals: 18, address: '0xAcD98E323968647936887aD4934e64B01060727e' },
  { symbol: 'AGII',   name: 'AGI Inception',       decimals: 18, address: '0x10052B8ccD2160b8F9880C6b4F5DD117fF253B1c' },
  { symbol: 'BLDR',   name: 'Builder Finance',     decimals: 18, address: '0x798eD6bFc5bfCFc60938d5098825b354427A0786' },
  { symbol: 'FGPT',   name: 'Finesse GPT',         decimals: 18, address: '0x151ef362eA96853702Cc5e7728107e3961fbD22e' },
  { symbol: 'MUSA',   name: 'Musa AI',             decimals: 18, address: '0xDB829befCF8E582379E2c034FA2589b8D2EA1c5D' },
];

/**
 * Destinations the Makalu bridge can forward to. Route 1 (Kamet) and Route 2
 * (Sepolia + Base Sepolia) are both LIVE: the Route 2 Makalu-origin wrapped
 * tokens (m-prefixed) were deployed + registered on the shared dest bridge
 * `0xfdA3b83F…` on both chains 2026-06-18, and the bridge-api backend wires the
 * Makalu→dest pairs. Per-destination wrapped-token resolution is handled by the
 * bridge backend; the SDK only enumerates reachable destination chains.
 */
export const MAKALU_DESTINATION_CHAINS: DestinationChain[] = [
  { name: 'Lithosphere Kamet', chainId: 900523,   symbol: 'LITHO', label: 'Kamet' },
  { name: 'Ethereum Sepolia',  chainId: 11155111, symbol: 'ETH',   label: 'Sepolia Testnet' },
  { name: 'Base Sepolia',      chainId: 84532,    symbol: 'ETH',   label: 'Base Sepolia' },
];

/** name→chainId map for the destinations above plus common L1s. */
export const MAKALU_CHAINS: Record<string, number> = {
  lithosphere: MAKALU_CHAIN_ID,
  kamet: 900523,
  sepolia: 11155111,
  'base-sepolia': 84532,
  ethereum: 1,
};

/** Ready-to-use {@link MultXConfig} for the Makalu bridge. */
export const MAKALU_TESTNET: MultXConfig = {
  bridgeAddress: MAKALU_BRIDGE_ADDRESS,
  bridgeApiUrl: MAKALU_BRIDGE_API_URL,
  supportedTokens: MAKALU_SUPPORTED_TOKENS,
  destinationChains: MAKALU_DESTINATION_CHAINS,
  lithoTokenAddress: '0x599a7E135f1790ae117b4EdDc0422D24Bc766161', // wLITHO
  chains: MAKALU_CHAINS,
};
