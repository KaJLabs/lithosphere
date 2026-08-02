import { describe, expect, it } from 'vitest';
import { MultXClient } from '../src/client.js';

const baseConfig = {
  bridgeAddress: '0x10ed4F004Fe708014ae27Bcc20c9Ed9df3f4eadF',
  bridgeApiUrl: 'https://bridge.litho.ai',
  supportedTokens: [
    {
      symbol: 'COLLE',
      name: 'Colle AI',
      decimals: 18,
      address: '0x10D4BB600c96e9243E2f50baFED8b2478F25af61',
      icon: null,
    },
  ],
  destinationChains: [
    { name: 'Ethereum Mainnet', chainId: 1, symbol: 'ETH', label: 'Mainnet' },
  ],
};

describe('MultXClient', () => {
  it('constructs with valid config', () => {
    const client = new MultXClient(baseConfig);
    expect(client.bridgeAddress).toBe(baseConfig.bridgeAddress);
    expect(client.bridgeApiUrl).toBe(baseConfig.bridgeApiUrl);
    expect(client.supportedTokens).toHaveLength(1);
    expect(client.destinationChains).toHaveLength(1);
  });

  it('reports isContractDeployed=true for valid address', () => {
    const client = new MultXClient(baseConfig);
    expect(client.isContractDeployed()).toBe(true);
  });

  it('reports isContractDeployed=false when bridge address empty', () => {
    const client = new MultXClient({ ...baseConfig, bridgeAddress: '' });
    expect(client.isContractDeployed()).toBe(false);
  });

  it('exposes default chains mapping plus overrides', () => {
    const client = new MultXClient({
      ...baseConfig,
      chains: { custom: 42 },
    });
    expect(client.chains).toMatchObject({
      lithosphere: 900523,
      ethereum: 1,
      custom: 42,
    });
  });

  it('builds correct API URLs via api.urls', () => {
    const client = new MultXClient(baseConfig);
    expect(client.api.urls.health()).toBe('https://bridge.litho.ai/health');
    expect(client.api.urls.status('0xabc')).toBe(
      'https://bridge.litho.ai/bridge/status/0xabc',
    );
    expect(client.api.urls.signatures('0xabc')).toBe(
      'https://bridge.litho.ai/bridge/signatures/0xabc',
    );
    expect(client.api.urls.transactions('0xdef')).toBe(
      'https://bridge.litho.ai/bridge/transactions/0xdef',
    );
  });

  it('normalizes the configured base URL on construction', () => {
    const client = new MultXClient({
      ...baseConfig,
      bridgeApiUrl: 'https://bridge.litho.ai/bridge/',
    });
    expect(client.api.baseUrl).toBe('https://bridge.litho.ai');
  });

  it('returns [] from getHistory when contract not deployed', async () => {
    const client = new MultXClient({ ...baseConfig, bridgeAddress: '' });
    expect(await client.getHistory('0xanything')).toEqual([]);
  });

  it('throws from getStatus when contract not deployed', async () => {
    const client = new MultXClient({ ...baseConfig, bridgeAddress: '' });
    await expect(client.getStatus('0xabc')).rejects.toThrow(
      'MultX Bridge contract not deployed',
    );
  });

  it('uses an injected fetch implementation', async () => {
    let called = false;
    const fakeFetch: typeof fetch = async (url) => {
      called = true;
      return new Response(JSON.stringify({ signatures: ['0xsig1'] }), { status: 200 });
    };

    const client = new MultXClient({ ...baseConfig, fetch: fakeFetch });
    const sigs = await client.getSignatures('0xtest');
    expect(called).toBe(true);
    expect(sigs).toEqual(['0xsig1']);
  });
});
