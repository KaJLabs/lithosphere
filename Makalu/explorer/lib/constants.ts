import { NETWORK } from './network';

export const CHAIN_NAME = NETWORK.name;
export const CHAIN_ID = NETWORK.cosmosChainId;
export const EVM_CHAIN_ID = String(NETWORK.evmChainId);
export const DENOM = 'LITHO';
export const DENOM_BASE = 'ulitho';
export const DECIMALS = 18;          // EVM-side balance (like wei → ETH)
export const ULITHO_DECIMALS = 18;   // Cosmos tx amounts (1 LITHO = 1e18 ulitho)
export const EXPLORER_TITLE = NETWORK.explorerTitle;
export const PAGE_SIZE = 20;
export const POLL_INTERVAL = 6000;
export const HOMEPAGE_ITEMS = 10;
