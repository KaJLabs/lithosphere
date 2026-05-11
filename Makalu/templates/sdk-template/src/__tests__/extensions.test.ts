import { describe, expect, it, vi } from 'vitest';
import { LithoError, ErrorCode } from '@lithosphere/sdk';
import { LithosphereExtensions } from '../extensions.js';

function fakeClient(overrides: Partial<{
  getTransaction: (hash: string) => Promise<unknown>;
  getTransactionReceipt: (hash: string) => Promise<unknown>;
}> = {}) {
  return {
    getTransaction: overrides.getTransaction ?? vi.fn(async () => null),
    getTransactionReceipt: overrides.getTransactionReceipt ?? vi.fn(async () => null),
  } as any;
}

const VALID_EVM = '0x22d279d24f0b7ca5d49c5a7a7f032da416f72387';

describe('LithosphereExtensions', () => {
  it('throws INVALID_ADDRESS for malformed input', async () => {
    const ext = new LithosphereExtensions(fakeClient());
    await expect(ext.recentActivity('not-an-address', [])).rejects.toBeInstanceOf(LithoError);
    try {
      await ext.recentActivity('not-an-address', []);
    } catch (err) {
      expect((err as LithoError).code).toBe(ErrorCode.INVALID_ADDRESS);
    }
  });

  it('returns pending entries when tx + receipt are null', async () => {
    const ext = new LithosphereExtensions(fakeClient());
    const result = await ext.recentActivity(VALID_EVM, ['0xaaa']);
    expect(result.count).toBe(1);
    expect(result.entries[0]).toEqual({
      hash: '0xaaa',
      blockNumber: null,
      to: null,
      value: '0',
      status: 'pending',
    });
  });

  it('reports success when receipt status is 1', async () => {
    const ext = new LithosphereExtensions(
      fakeClient({
        getTransaction: vi.fn(async () => ({ blockNumber: 100, to: '0xdef', value: 1000n })),
        getTransactionReceipt: vi.fn(async () => ({ blockNumber: 100, status: 1 })),
      }),
    );
    const result = await ext.recentActivity(VALID_EVM, ['0xbbb']);
    expect(result.entries[0]).toMatchObject({
      hash: '0xbbb',
      blockNumber: 100,
      to: '0xdef',
      value: '1000', // bigint serialized to decimal string
      status: 'success',
    });
  });

  it('reports failure when receipt status is 0 (reverted)', async () => {
    const ext = new LithosphereExtensions(
      fakeClient({
        getTransaction: vi.fn(async () => ({ blockNumber: 101, to: '0x0', value: 0n })),
        getTransactionReceipt: vi.fn(async () => ({ blockNumber: 101, status: 0 })),
      }),
    );
    const result = await ext.recentActivity(VALID_EVM, ['0xccc']);
    expect(result.entries[0].status).toBe('failure');
  });

  it('handles a mix of pending + confirmed in one call', async () => {
    const getTx = vi.fn(async (hash: string) => (hash === '0xpending' ? null : { blockNumber: 200, to: '0xfoo', value: 5n }));
    const getReceipt = vi.fn(async (hash: string) => (hash === '0xpending' ? null : { blockNumber: 200, status: 1 }));
    const ext = new LithosphereExtensions(
      fakeClient({ getTransaction: getTx, getTransactionReceipt: getReceipt }),
    );
    const result = await ext.recentActivity(VALID_EVM, ['0xpending', '0xconfirmed']);
    expect(result.entries.map((e) => e.status)).toEqual(['pending', 'success']);
  });
});
