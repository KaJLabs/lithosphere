import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDurableCursor, processBlockRange } from '../src/services/eventListener.js';

const bridge = '0x1111111111111111111111111111111111111111';
const sourceToken = '0xC0FC628e3aB128fe387e7ed5e729bD809C017888';
const blockHash = `0x${'ab'.repeat(32)}`;

const spec = (overrides = {}) => ({
  name: 'kamet',
  chainId: 900523,
  bridge,
  startBlock: 100,
  confirmations: 12,
  reorgOverlap: 10,
  ...overrides,
});

test('cold start begins immediately before the configured deployment block', async () => {
  const database = { query: async () => ({ rows: [] }) };
  const cursor = await loadDurableCursor(spec(), {}, database, 500);
  assert.equal(cursor, 99);
});

test('persisted cursor resumes with the configured reorg overlap', async () => {
  const database = {
    query: async () => ({ rows: [{ last_processed_block: '120', last_processed_hash: blockHash }] }),
  };
  const provider = { getBlock: async () => ({ hash: blockHash }) };
  const cursor = await loadDurableCursor(spec(), provider, database);
  assert.equal(cursor, 110);
});

test('cursor hash mismatch fails closed for manual reconciliation', async () => {
  const database = {
    query: async () => ({ rows: [{ last_processed_block: '120', last_processed_hash: blockHash }] }),
  };
  const provider = { getBlock: async () => ({ hash: `0x${'cd'.repeat(32)}` }) };
  await assert.rejects(
    loadDurableCursor(spec(), provider, database),
    /manual reconciliation required/
  );
});

function rangeFixture({ failInsert = false, targetChain = 11155111 } = {}) {
  const calls = [];
  const client = {
    async query(sql) {
      const text = String(sql).trim();
      calls.push(text);
      if (failInsert && text.startsWith('INSERT INTO bridge_transactions')) {
        throw new Error('temporary database failure');
      }
      return { rows: [] };
    },
    release() { calls.push('RELEASE_CLIENT'); },
  };
  const watcher = {
    spec: spec(),
    lastBlock: 99,
    provider: { getBlock: async () => ({ hash: blockHash }) },
    contract: {
      filters: { TokensLocked: () => ({}) },
      queryFilter: async () => [{
        args: {
          txHash: `0x${'12'.repeat(32)}`,
          token: sourceToken,
          user: '0x2222222222222222222222222222222222222222',
          amount: 10n,
          targetChain: BigInt(targetChain),
          nonce: 7n,
        },
        blockNumber: 100,
        blockHash,
      }],
    },
  };
  return { calls, client, watcher, database: { connect: async () => client } };
}

test('events and cursor commit atomically before in-memory progress advances', async () => {
  const fixture = rangeFixture();
  await processBlockRange(fixture.watcher, 100, fixture.database);
  assert.equal(fixture.watcher.lastBlock, 100);
  assert.equal(fixture.calls[0], 'BEGIN');
  assert.match(fixture.calls[1], /^INSERT INTO bridge_transactions/);
  assert.doesNotMatch(fixture.calls[1], /status='locked'/);
  assert.match(fixture.calls[2], /^INSERT INTO bridge_event_cursors/);
  assert.equal(fixture.calls[3], 'COMMIT');
  assert.equal(fixture.calls[4], 'RELEASE_CLIENT');
});

test('database failure rolls back and never advances the cursor', async () => {
  const fixture = rangeFixture({ failInsert: true });
  await assert.rejects(
    processBlockRange(fixture.watcher, 100, fixture.database),
    /temporary database failure/
  );
  assert.equal(fixture.watcher.lastBlock, 99);
  assert.ok(fixture.calls.includes('ROLLBACK'));
  assert.ok(!fixture.calls.includes('COMMIT'));
});

test('unmapped routes roll back instead of being skipped', async () => {
  const fixture = rangeFixture({ targetChain: 999999 });
  await assert.rejects(
    processBlockRange(fixture.watcher, 100, fixture.database),
    /No release_token mapping/
  );
  assert.equal(fixture.watcher.lastBlock, 99);
  assert.ok(fixture.calls.includes('ROLLBACK'));
});
