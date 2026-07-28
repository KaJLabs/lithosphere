type PublicEnvironment = {
  NEXT_PUBLIC_NETWORK?: string;
  NEXT_PUBLIC_CHAIN_ID?: string;
  NEXT_PUBLIC_COSMOS_CHAIN_ID?: string;
  NEXT_PUBLIC_CHAIN_NAME?: string;
  NEXT_PUBLIC_RPC_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  NEXT_PUBLIC_EXPLORER_TITLE?: string;
  NEXT_PUBLIC_DEFAULT_THEME?: string;
  NEXT_PUBLIC_BRIDGE_ENABLED?: string;
  NEXT_PUBLIC_SWAP_ROUTER?: string;
};

function enabled(value: string | undefined): boolean {
  return value?.toLowerCase() === 'true';
}

function validHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function buildNetworkConfig(env: PublicEnvironment) {
  const parsedChainId = Number(env.NEXT_PUBLIC_CHAIN_ID || '700777');
  const evmChainId = Number.isSafeInteger(parsedChainId) && parsedChainId > 0
    ? parsedChainId
    : 700777;
  const isMainnet = env.NEXT_PUBLIC_NETWORK === 'mainnet' || evmChainId === 9005;
  const rpcUrl = env.NEXT_PUBLIC_RPC_URL?.trim() || (isMainnet ? '' : 'https://rpc.litho.ai');
  const siteUrl = env.NEXT_PUBLIC_SITE_URL?.trim()
    || (isMainnet ? 'https://lithoscan.ai' : 'https://makalu.litho.ai');
  const defaultTheme: 'dark' | 'light' = env.NEXT_PUBLIC_DEFAULT_THEME === 'dark'
    ? 'dark'
    : env.NEXT_PUBLIC_DEFAULT_THEME === 'light' || isMainnet
      ? 'light'
      : 'dark';

  return {
    mode: isMainnet ? 'mainnet' as const : 'testnet' as const,
    isMainnet,
    evmChainId,
    chainIdHex: `0x${evmChainId.toString(16)}`,
    cosmosChainId: env.NEXT_PUBLIC_COSMOS_CHAIN_ID?.trim()
      || (isMainnet ? 'lithosphere_9005-1' : 'lithosphere_700777-2'),
    name: env.NEXT_PUBLIC_CHAIN_NAME?.trim()
      || (isMainnet ? 'Lithosphere Mainnet' : 'Lithosphere Makalu Testnet'),
    shortName: isMainnet ? 'Mainnet' : 'Makalu',
    label: isMainnet ? 'Lithosphere Mainnet' : 'Lithosphere Makalu Testnet',
    rpcUrl,
    siteUrl,
    explorerTitle: env.NEXT_PUBLIC_EXPLORER_TITLE?.trim() || 'Lithoscan',
    logoPath: isMainnet ? '/litho-coin-logo.svg' : '/litho-logo.png',
    faviconPath: isMainnet ? '/litho-coin-logo.svg' : '/makalu-testnet-favicon.png',
    defaultTheme,
    walletReady: validHttpUrl(rpcUrl),
    faucetEnabled: !isMainnet,
    bridgeEnabled: enabled(env.NEXT_PUBLIC_BRIDGE_ENABLED),
    swapEnabled: /^0x[0-9a-fA-F]{40}$/.test(env.NEXT_PUBLIC_SWAP_ROUTER?.trim() || ''),
  };
}

export const NETWORK = buildNetworkConfig({
  NEXT_PUBLIC_NETWORK: process.env.NEXT_PUBLIC_NETWORK,
  NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
  NEXT_PUBLIC_COSMOS_CHAIN_ID: process.env.NEXT_PUBLIC_COSMOS_CHAIN_ID,
  NEXT_PUBLIC_CHAIN_NAME: process.env.NEXT_PUBLIC_CHAIN_NAME,
  NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_EXPLORER_TITLE: process.env.NEXT_PUBLIC_EXPLORER_TITLE,
  NEXT_PUBLIC_DEFAULT_THEME: process.env.NEXT_PUBLIC_DEFAULT_THEME,
  NEXT_PUBLIC_BRIDGE_ENABLED: process.env.NEXT_PUBLIC_BRIDGE_ENABLED,
  NEXT_PUBLIC_SWAP_ROUTER: process.env.NEXT_PUBLIC_SWAP_ROUTER,
});

export const WALLET_CHAIN = {
  chainId: NETWORK.chainIdHex,
  chainName: NETWORK.name,
  rpcUrls: NETWORK.rpcUrl ? [NETWORK.rpcUrl] : [],
  nativeCurrency: { name: 'LITHO', symbol: 'LITHO', decimals: 18 },
  blockExplorerUrls: [NETWORK.siteUrl],
};
