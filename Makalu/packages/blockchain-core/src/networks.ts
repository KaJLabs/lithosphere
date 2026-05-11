/**
 * Network registry — chain IDs, RPC URLs, explorer URLs per environment.
 *
 * Sourcing notes:
 *  - chainId 700777 is the EVM chain ID for Lithosphere across all environments;
 *    there is currently no separate mainnet (the live chain is the Makalu testnet —
 *    see docs/network/chain-parameters.md).
 *  - bech32Prefix is `litho` for accounts, `lithovaloper` for validators.
 *  - denom `ulitho` is the smallest unit; 1 LITHO = 1e18 ulitho.
 */

export type NetworkName = 'mainnet' | 'staging' | 'devnet' | 'local';

export interface NetworkConfig {
  name: NetworkName;
  /** Whether this network is the live, public-facing chain. */
  isPublic: boolean;
  /** EVM JSON-RPC URL. */
  rpcUrl: string;
  /** Cosmos LCD / REST URL (read-only Cosmos state). */
  lcdUrl?: string;
  /** Cosmos RPC (CometBFT) URL. */
  cosmosRpcUrl?: string;
  /** Explorer base URL. */
  explorerUrl?: string;
  /** EVM chain ID. */
  chainId: number;
  /** Cosmos chain ID string. */
  cosmosChainId?: string;
  /** Bech32 address prefix (e.g. "litho"). */
  bech32Prefix: string;
  /** Native currency definition. */
  currency: {
    name: string;
    symbol: string;
    decimals: number;
    /** Smallest-unit denom (ulitho = 1e-18 LITHO). */
    denom: string;
  };
}

export const NETWORKS: Record<NetworkName, NetworkConfig> = {
  mainnet: {
    name: 'mainnet',
    isPublic: true,
    rpcUrl: 'https://rpc.litho.ai',
    lcdUrl: 'https://api.litho.ai',
    cosmosRpcUrl: 'https://rpc.litho.ai',
    explorerUrl: 'https://makalu.litho.ai',
    chainId: 700777,
    cosmosChainId: 'lithosphere_700777-2',
    bech32Prefix: 'litho',
    currency: {
      name: 'Lithosphere',
      symbol: 'LITHO',
      decimals: 18,
      denom: 'ulitho',
    },
  },
  // Staging and devnet currently route to the same testnet — there is no separate
  // mainnet yet. Kept as named profiles so consumer code can target by intent
  // ("I'm running staging integration") even though the endpoints overlap.
  staging: {
    name: 'staging',
    isPublic: true,
    rpcUrl: 'https://rpc.litho.ai',
    lcdUrl: 'https://api.litho.ai',
    cosmosRpcUrl: 'https://rpc.litho.ai',
    explorerUrl: 'https://makalu.litho.ai',
    chainId: 700777,
    cosmosChainId: 'lithosphere_700777-2',
    bech32Prefix: 'litho',
    currency: {
      name: 'Lithosphere',
      symbol: 'LITHO',
      decimals: 18,
      denom: 'ulitho',
    },
  },
  devnet: {
    name: 'devnet',
    isPublic: true,
    rpcUrl: 'https://rpc.litho.ai',
    lcdUrl: 'https://api.litho.ai',
    cosmosRpcUrl: 'https://rpc.litho.ai',
    explorerUrl: 'https://makalu.litho.ai',
    chainId: 700777,
    cosmosChainId: 'lithosphere_700777-2',
    bech32Prefix: 'litho',
    currency: {
      name: 'Lithosphere',
      symbol: 'LITHO',
      decimals: 18,
      denom: 'ulitho',
    },
  },
  local: {
    name: 'local',
    isPublic: false,
    rpcUrl: 'http://localhost:8545',
    cosmosRpcUrl: 'http://localhost:26657',
    lcdUrl: 'http://localhost:1317',
    chainId: 700777,
    cosmosChainId: 'lithosphere_700777-2',
    bech32Prefix: 'litho',
    currency: {
      name: 'Lithosphere',
      symbol: 'LITHO',
      decimals: 18,
      denom: 'ulitho',
    },
  },
};

export function isNetworkName(value: string): value is NetworkName {
  return value === 'mainnet' || value === 'staging' || value === 'devnet' || value === 'local';
}

export function getNetwork(name: NetworkName): NetworkConfig {
  return NETWORKS[name];
}
