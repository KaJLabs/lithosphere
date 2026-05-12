import { afterEach, describe, expect, it, vi } from 'vitest';
import { LithoClient } from '../client.js';
import { ErrorCode, LithoError, NETWORKS } from '@lithosphere/blockchain-core';

const ADDR = '0x22d279d24f0b7ca5d49c5a7a7f032da416f72387';
const HASH = '0xf3df3dce8dce77d8b1172dc9d191e11caed85563f5b5a323f6ea4a18ab97077f';

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('LithoClient constructor', () => {
  it('accepts a known NetworkName and adopts its RPC + chainId', () => {
    const client = new LithoClient('mainnet');
    expect(client.rpcUrl).toBe(NETWORKS.mainnet.rpcUrl);
  });

  it('accepts a custom https URL', () => {
    const client = new LithoClient('https://custom.example.com/rpc');
    expect(client.rpcUrl).toBe('https://custom.example.com/rpc');
  });

  it('rejects a custom URL without an http(s) scheme', () => {
    expect(() => new LithoClient('not-a-url')).toThrow(LithoError);
    try {
      new LithoClient('not-a-url');
    } catch (err) {
      expect(err).toBeInstanceOf(LithoError);
      expect((err as LithoError).code).toBe(ErrorCode.INVALID_PARAMETER);
    }
  });

  it('getNetworkConfig() finds the matching NetworkConfig', () => {
    const client = new LithoClient('mainnet');
    expect(client.getNetworkConfig()?.name).toBe('mainnet');
  });
});

describe('LithoClient.getChainId', () => {
  it('returns the configured chainId without calling RPC when known', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as typeof fetch;
    const client = new LithoClient('mainnet');
    expect(await client.getChainId()).toBe(NETWORKS.mainnet.chainId);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('queries eth_chainId for custom RPCs', async () => {
    // 700777 = 0xab169
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockResponse({ jsonrpc: '2.0', id: 1, result: '0xab169' })) as typeof fetch;
    const client = new LithoClient('https://custom.example.com');
    expect(await client.getChainId()).toBe(700777);
  });
});

describe('LithoClient.getBlockNumber', () => {
  it('parses the hex result to a decimal number', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockResponse({ jsonrpc: '2.0', id: 1, result: '0x64' })) as typeof fetch;
    const client = new LithoClient('mainnet', { retry: { count: 0, delay: 0 } });
    expect(await client.getBlockNumber()).toBe(100);
  });
});

describe('LithoClient.getBalance', () => {
  it('formats wei into LITHO with 18 decimals', async () => {
    // 1.5 LITHO = 1.5e18 wei
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockResponse({ jsonrpc: '2.0', id: 1, result: '0x14d1120d7b160000' })) as typeof fetch;
    const client = new LithoClient('mainnet', { retry: { count: 0, delay: 0 } });
    const result = await client.getBalance(ADDR);
    expect(result.address).toBe(ADDR);
    expect(result.balance).toBe(1_500_000_000_000_000_000n);
    expect(result.formatted).toBe('1.5');
    expect(result.symbol).toBe('LITHO');
  });

  it('rejects malformed addresses with INVALID_ADDRESS before hitting RPC', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as typeof fetch;
    const client = new LithoClient('mainnet');
    await expect(client.getBalance('not-an-address')).rejects.toMatchObject({
      code: ErrorCode.INVALID_ADDRESS,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('LithoClient.getTransaction / getTransactionReceipt', () => {
  it('returns null when eth_getTransactionByHash returns null', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockResponse({ jsonrpc: '2.0', id: 1, result: null })) as typeof fetch;
    const client = new LithoClient('mainnet', { retry: { count: 0, delay: 0 } });
    expect(await client.getTransaction(HASH)).toBeNull();
  });

  it('parses a confirmed transaction', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      mockResponse({
        jsonrpc: '2.0',
        id: 1,
        result: {
          hash: HASH,
          blockNumber: '0x64',
          blockHash: '0x' + 'a'.repeat(64),
          transactionIndex: '0x0',
          from: ADDR,
          to: ADDR,
          value: '0x10',
          gas: '0x5208',
          gasPrice: '0x4a817c800',
        },
      }),
    ) as typeof fetch;
    const client = new LithoClient('mainnet', { retry: { count: 0, delay: 0 } });
    const tx = await client.getTransaction(HASH);
    expect(tx).not.toBeNull();
    expect(tx!.blockNumber).toBe(100);
    expect(tx!.value).toBe(16n);
    expect(tx!.status).toBe('confirmed');
  });

  it('rejects malformed tx hashes', async () => {
    const client = new LithoClient('mainnet');
    await expect(client.getTransactionReceipt('0xabc')).rejects.toMatchObject({
      code: ErrorCode.INVALID_PARAMETER,
    });
  });
});

describe('retry + typed errors', () => {
  it('retries on 500 then succeeds, using exponential backoff', async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return new Response('boom', { status: 502 });
      if (calls === 2) return new Response('boom', { status: 503 });
      return mockResponse({ jsonrpc: '2.0', id: calls, result: '0x7' });
    }) as typeof fetch;

    const client = new LithoClient('mainnet', { retry: { count: 4, delay: 1 } });
    expect(await client.getBlockNumber()).toBe(7);
    expect(calls).toBe(3);
  });

  it('throws RATE_LIMITED for 429', async () => {
    globalThis.fetch = vi.fn(async () => new Response('slow down', { status: 429 })) as typeof fetch;
    const client = new LithoClient('mainnet', { retry: { count: 0, delay: 1 } });
    await expect(client.getBlockNumber()).rejects.toMatchObject({
      code: ErrorCode.RATE_LIMITED,
    });
  });

  it('eventually gives up after retry budget is exhausted', async () => {
    globalThis.fetch = vi.fn(async () => new Response('boom', { status: 503 })) as typeof fetch;
    const client = new LithoClient('mainnet', { retry: { count: 2, delay: 1 } });
    await expect(client.getBlockNumber()).rejects.toBeInstanceOf(LithoError);
    // 1 initial + 2 retries
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it('wraps a JSON-RPC error in CONTRACT_ERROR and does NOT retry', async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls += 1;
      return mockResponse({ jsonrpc: '2.0', id: 1, error: { code: -32602, message: 'invalid params' } });
    }) as typeof fetch;
    const client = new LithoClient('mainnet', { retry: { count: 3, delay: 1 } });
    await expect(client.getBlockNumber()).rejects.toMatchObject({
      code: ErrorCode.CONTRACT_ERROR,
    });
    expect(calls).toBe(1);
  });
});

describe('waitForTransaction', () => {
  it('throws TIMEOUT when the tx never lands within the budget (real timers, tight poll)', async () => {
    // Use a short timeout and a short poll interval to keep the test fast.
    globalThis.fetch = vi.fn(async () =>
      mockResponse({ jsonrpc: '2.0', id: 1, result: null }),
    ) as typeof fetch;
    const client = new LithoClient('mainnet', { retry: { count: 0, delay: 1 } });

    await expect(
      client.waitForTransaction(HASH, 1, /*timeoutMs*/ 50, /*pollIntervalMs*/ 10),
    ).rejects.toMatchObject({ code: ErrorCode.TIMEOUT });
  });
});
