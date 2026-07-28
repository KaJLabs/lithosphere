import { describe, expect, it } from 'vitest';

import { buildNetworkConfig } from '@/lib/network';

describe('explorer network configuration', () => {
  it('builds the public Lithosphere mainnet identity for chain 9005', () => {
    const config = buildNetworkConfig({
      NEXT_PUBLIC_NETWORK: 'mainnet',
      NEXT_PUBLIC_CHAIN_ID: '9005',
      NEXT_PUBLIC_COSMOS_CHAIN_ID: '9005',
      NEXT_PUBLIC_CHAIN_NAME: 'Lithosphere Mainnet',
      NEXT_PUBLIC_RPC_URL: 'https://mainnet-rpc.example',
      NEXT_PUBLIC_SITE_URL: 'https://lithoscan.ai',
    });

    expect(config).toMatchObject({
      isMainnet: true,
      evmChainId: 9005,
      chainIdHex: '0x232d',
      cosmosChainId: '9005',
      label: 'Lithosphere Mainnet',
      siteUrl: 'https://lithoscan.ai',
      defaultTheme: 'light',
      faucetEnabled: false,
      bridgeEnabled: false,
      walletReady: true,
    });
  });

  it('fails wallet configuration closed when a mainnet RPC is missing', () => {
    const config = buildNetworkConfig({
      NEXT_PUBLIC_NETWORK: 'mainnet',
      NEXT_PUBLIC_CHAIN_ID: '9005',
    });

    expect(config.walletReady).toBe(false);
    expect(config.rpcUrl).toBe('');
  });
});
