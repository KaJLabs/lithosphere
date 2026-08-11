/**
 * Kamet mainnet (EVM chainId 900523) MultX bridge preset.
 *
 * Drop-in config for {@link MultXClient} — no manual assembly required:
 *
 * ```ts
 * import { MultXClient } from '@litho/multx-sdk';
 * import { KAMET_MAINNET } from '@litho/multx-sdk/presets';
 *
 * const client = new MultXClient(KAMET_MAINNET);
 * ```
 *
 * Every address below was verified live against `https://rpc-3.litho.ai`
 * on 2026-06-16:
 *  - the bridge has bytecode and is exactly what `bridge.litho.ai/chains`
 *    reports as the Kamet bridge;
 *  - each token's on-chain `symbol()` matches and `decimals() == 18`;
 *  - each token returns `supportedTokens(addr) == true` on the bridge.
 *
 * Source of truth: contracts/deployments/kamet-bridge-hardened-2026-05-09*.json
 * (the canonical hardened deployment; the dead 2026-04-01 set is NOT used).
 */

import type {
  DestinationChain,
  MultXConfig,
  SupportedToken,
} from '../types.js';

/** EVM chainId of Lithosphere Kamet (the bridge's source chain). */
export const KAMET_CHAIN_ID = 900523;

/** Deployed hardened MultXBridge on Kamet. */
export const KAMET_BRIDGE_ADDRESS =
  '0x3a896BDF3a1088287FA84aB5a43bB30e2535F263';

/** Public bridge backend (signature aggregation, status, history). */
export const KAMET_BRIDGE_API_URL = 'https://bridge.litho.ai';

/**
 * The 11 LEP100 tokens whitelisted on the Kamet bridge. Names are the
 * canonical on-chain names (note: the explorer historically mislabels MUSA
 * as "Mansa AI" and FGPT as "FurGPT" — the on-chain symbol is authoritative).
 */
export const KAMET_SUPPORTED_TOKENS: SupportedToken[] = [
  { symbol: 'wLITHO', name: 'Wrapped LITHO',       decimals: 18, address: '0xC0FC628e3aB128fe387e7ed5e729bD809C017888' },
  { symbol: 'LitBTC', name: 'Lithosphere Bitcoin', decimals: 18, address: '0x3A8D5FdC6c8dA9f14C535424b6F7206eC1996016' },
  { symbol: 'LAX',    name: 'LAX Token',           decimals: 18, address: '0xe8f504f9cE5391Fb5968b317f0b24b8A0306ACeb' },
  { symbol: 'JOT',    name: 'JOT Token',           decimals: 18, address: '0x6AE14CEb3962664b13c5dEF29EB172De76bd0ac9' },
  { symbol: 'COLLE',  name: 'Colle AI',            decimals: 18, address: '0x0573f66cb4bC34618e7AB8a941F7883DD2515dCA' },
  { symbol: 'IMAGE',  name: 'Image AI',            decimals: 18, address: '0x8Ba6E3A0759144245f2939eB54164e32bb78B8E0' },
  { symbol: 'AGII',   name: 'AGI Inception',       decimals: 18, address: '0x17D506aF1d0Dc2f4f64f15748a5aC46FAd3f06D7' },
  { symbol: 'BLDR',   name: 'Builder Finance',     decimals: 18, address: '0xF05f1F79273874E554F02ce06585E16132a3B62B' },
  { symbol: 'FGPT',   name: 'Finesse GPT',         decimals: 18, address: '0x2F366c6350A6b211f6D6F847c3D56738C2E847ca' },
  { symbol: 'MUSA',   name: 'Musa AI',             decimals: 18, address: '0x17A357262097B4e70acFfe8B71bC61e8bBcc3B42' },
  { symbol: 'QTT',    name: 'Quantts',             decimals: 18, address: '0x16EE7127C9E03e29ca5727e23dd7CB03D283cDBe' },
];

/**
 * Chains the Kamet bridge can forward to today. These are the EVM
 * destinations with a deployed dest-side bridge, per `bridge.litho.ai/chains`.
 * (Makalu 700777 is advertised but has no dest bridge yet, so it is omitted.)
 */
export const KAMET_DESTINATION_CHAINS: DestinationChain[] = [
  { name: 'Ethereum Sepolia',  chainId: 11155111, symbol: 'ETH', label: 'Sepolia Testnet' },
  { name: 'Base Sepolia',      chainId: 84532,    symbol: 'ETH', label: 'Base Sepolia' },
  { name: 'BNB Chain Testnet', chainId: 97,       symbol: 'BNB', label: 'BSC Testnet' },
];

/** Convenient name→chainId map matching the destinations above plus L1s. */
export const KAMET_CHAINS: Record<string, number> = {
  lithosphere: KAMET_CHAIN_ID,
  ethereum: 1,
  sepolia: 11155111,
  baseSepolia: 84532,
  bnbTestnet: 97,
};

/** Ready-to-use {@link MultXConfig} for the Kamet bridge. */
export const KAMET_MAINNET: MultXConfig = {
  bridgeAddress: KAMET_BRIDGE_ADDRESS,
  bridgeApiUrl: KAMET_BRIDGE_API_URL,
  supportedTokens: KAMET_SUPPORTED_TOKENS,
  destinationChains: KAMET_DESTINATION_CHAINS,
  lithoTokenAddress: '0xC0FC628e3aB128fe387e7ed5e729bD809C017888', // wLITHO
  chains: KAMET_CHAINS,
};
