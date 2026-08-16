import { describe, expect, it, vi } from 'vitest';

import { isThanosIdentity, prioritizeThanosConnectors } from '@/lib/thanos';
import { ensureExplorerNetwork, walletErrorCode } from '@/lib/walletNetwork';

describe('wallet network setup', () => {
  it('switches to the configured explorer chain', async () => {
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === 'eth_chainId') return '0x1';
      return null;
    });

    await ensureExplorerNetwork({ request });

    expect(request).toHaveBeenCalledWith({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0xab169' }],
    });
  });

  it('adds the network when the wallet reports an unknown chain', async () => {
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === 'eth_chainId') return '0x1';
      if (method === 'wallet_switchEthereumChain') throw { data: { originalError: { code: 4902 } } };
      return null;
    });

    await ensureExplorerNetwork({ request });

    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'wallet_addEthereumChain',
    }));
  });

  it('reads nested wallet error codes', () => {
    expect(walletErrorCode({ error: { code: 4902 } })).toBe(4902);
  });
});

describe('Thanos wallet preference', () => {
  it('recognizes Thanos by RDNS or announced name', () => {
    expect(isThanosIdentity('fi.thanos.wallet', 'Wallet')).toBe(true);
    expect(isThanosIdentity('example.wallet', 'Thanos Wallet')).toBe(true);
  });

  it('moves Thanos ahead of other announced wallets without removing them', () => {
    const connectors = [
      { name: 'MetaMask', info: { rdns: 'io.metamask' } },
      { name: 'Thanos Wallet', info: { rdns: 'fi.thanos.wallet' } },
      { name: 'Trust Wallet', info: { rdns: 'com.trustwallet.app' } },
    ];

    expect(prioritizeThanosConnectors(connectors).map((connector) => connector.name))
      .toEqual(['Thanos Wallet', 'MetaMask', 'Trust Wallet']);
  });
});
