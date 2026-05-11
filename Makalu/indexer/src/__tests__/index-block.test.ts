import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Shared fake client that captures every query made against it
type CapturedQuery = { sql: string; params?: unknown[] };
let captured: CapturedQuery[];
let mockQueryImpl: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
let releaseSpy: ReturnType<typeof vi.fn>;

vi.mock('pg', () => {
  class FakePool {
    on() {
      return this;
    }
    async connect() {
      return {
        query: vi.fn(async (sql: string, params?: unknown[]) => {
          captured.push({ sql, params });
          return mockQueryImpl(sql, params);
        }),
        release: releaseSpy,
      };
    }
    async query(sql: string, params?: unknown[]) {
      captured.push({ sql, params });
      return mockQueryImpl(sql, params);
    }
  }
  return { default: { Pool: FakePool }, Pool: FakePool };
});

// Stub fetch globally — rpcGet uses fetch(url, { signal })
const originalFetch = globalThis.fetch;
beforeEach(() => {
  captured = [];
  mockQueryImpl = async () => ({ rows: [] });
  releaseSpy = vi.fn();
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function stubRpc(responses: Record<string, unknown>) {
  globalThis.fetch = vi.fn(async (url: unknown) => {
    const u = String(url);
    for (const [key, body] of Object.entries(responses)) {
      if (u.includes(key)) {
        return new Response(JSON.stringify({ result: body }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    return new Response(JSON.stringify({ error: { message: 'unknown rpc path: ' + u } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
}

const { indexBlock } = await import('../mappings.js');

describe('indexBlock', () => {
  it('issues BEGIN → INSERT blocks → COMMIT for an empty block', async () => {
    stubRpc({
      '/block?height=100': {
        block_id: { hash: '0xabc' },
        block: {
          header: { proposer_address: '0xprop', time: '2026-05-11T12:00:00Z' },
          data: { txs: [] },
        },
      },
      '/block_results?height=100': {
        txs_results: [],
      },
    });

    await indexBlock(100);

    const sqls = captured.map((c) => c.sql.trim());
    expect(sqls[0]).toBe('BEGIN');
    expect(sqls.some((s) => s.startsWith('INSERT INTO blocks'))).toBe(true);
    expect(sqls[sqls.length - 1]).toBe('COMMIT');
    expect(releaseSpy).toHaveBeenCalledOnce();
  });

  it('lowercases block hash and proposer address before INSERT', async () => {
    stubRpc({
      '/block?height=101': {
        block_id: { hash: '0xABCDEF' },
        block: {
          header: { proposer_address: '0xPROP', time: '2026-05-11T12:00:00Z' },
          data: { txs: [] },
        },
      },
      '/block_results?height=101': { txs_results: [] },
    });

    await indexBlock(101);

    const blocksInsert = captured.find((c) => c.sql.trim().startsWith('INSERT INTO blocks'));
    expect(blocksInsert).toBeDefined();
    const params = blocksInsert!.params as unknown[];
    expect(params[1]).toBe('0xabcdef');
    expect(params[2]).toBe('0xprop');
  });

  it('rolls back and releases the client on RPC failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response('boom', { status: 502 }),
    ) as typeof fetch;

    await expect(indexBlock(102)).rejects.toThrow();

    // RPC failed before any DB write, so we never reach BEGIN.
    expect(captured.find((c) => c.sql.trim() === 'ROLLBACK')).toBeUndefined();
    expect(releaseSpy).not.toHaveBeenCalled();
  });

  it('deletes existing block rows first when replaceExisting=true', async () => {
    stubRpc({
      '/block?height=103': {
        block_id: { hash: '0xabc' },
        block: {
          header: { proposer_address: '0xprop', time: '2026-05-11T12:00:00Z' },
          data: { txs: [] },
        },
      },
      '/block_results?height=103': { txs_results: [] },
    });

    await indexBlock(103, { replaceExisting: true });

    const sqls = captured.map((c) => c.sql.trim());
    const deleteIndex = sqls.findIndex((s) => s.startsWith('DELETE FROM token_transfers'));
    const insertIndex = sqls.findIndex((s) => s.startsWith('INSERT INTO blocks'));
    expect(deleteIndex).toBeGreaterThan(-1);
    expect(insertIndex).toBeGreaterThan(deleteIndex);

    // Verify all 5 expected tables are cleared
    expect(sqls).toEqual(expect.arrayContaining([
      expect.stringMatching(/^DELETE FROM token_transfers/),
      expect.stringMatching(/^DELETE FROM evm_transactions/),
      expect.stringMatching(/^DELETE FROM transactions/),
      expect.stringMatching(/^DELETE FROM contracts/),
      expect.stringMatching(/^DELETE FROM blocks/),
    ]));
  });
});
