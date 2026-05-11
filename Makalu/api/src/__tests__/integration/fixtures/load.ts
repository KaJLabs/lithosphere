/**
 * Fixture loader for integration tests.
 *
 * `applySchema(pool)` is idempotent (CREATE TABLE IF NOT EXISTS) — safe to
 * call from every `beforeAll`.
 *
 * `loadFixtures(pool, corpus)` truncates the relevant tables and bulk-inserts
 * the corpus. Use this in `beforeEach` for tests that want a fixed starting
 * state, or in `beforeAll` for tests that read but never mutate.
 *
 * The corpus is intentionally JSON (not generated programmatically) so
 * adding a new scenario is just an edit to `chain-state.json` — diff-able,
 * reviewable, no helper functions to maintain.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, PoolClient } from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const FIXTURE_DIR = __dirname;

export interface BlockFixture {
  height: number;
  hash: string;
  proposer_address: string;
  num_txs: number;
  total_gas: string;
  block_time: string;
}

export interface TransactionFixture {
  hash: string;
  block_height: number;
  tx_index: number;
  tx_type: string;
  sender: string | null;
  receiver: string | null;
  amount: string;
  denom: string;
  gas_used: string;
  gas_wanted: string;
  fee: string;
  fee_denom: string;
  success: boolean;
  memo: string;
  raw_log: string;
  timestamp: string;
}

export interface ValidatorFixture {
  operator_address: string;
  moniker: string;
  tokens: string;
  delegator_shares: string;
  commission_rate: string;
  commission_max_rate: string;
  commission_max_change: string;
  min_self_delegation: string;
  status: number;
  jailed: boolean;
}

export interface ChainStateCorpus {
  blocks: BlockFixture[];
  transactions: TransactionFixture[];
  validators: ValidatorFixture[];
}

/** Read the default `chain-state.json` corpus. */
export function loadChainStateCorpus(): ChainStateCorpus {
  const raw = readFileSync(join(FIXTURE_DIR, 'chain-state.json'), 'utf8');
  const parsed = JSON.parse(raw) as ChainStateCorpus & { _doc?: string };
  return {
    blocks: parsed.blocks,
    transactions: parsed.transactions,
    validators: parsed.validators,
  };
}

/** Apply the idempotent test schema (matches indexer DDL). */
export async function applySchema(pool: Pool | PoolClient): Promise<void> {
  const sql = readFileSync(join(FIXTURE_DIR, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

/**
 * Truncate the corpus tables and bulk-insert. Order matters because of
 * implicit foreign-key intent (transactions.block_height → blocks.height),
 * but we don't enforce FK constraints in the test schema — the truncate
 * order is just for determinism.
 */
export async function loadFixtures(
  pool: Pool | PoolClient,
  corpus: ChainStateCorpus = loadChainStateCorpus(),
): Promise<void> {
  await pool.query('TRUNCATE transactions, blocks, validators');

  for (const b of corpus.blocks) {
    await pool.query(
      `INSERT INTO blocks (height, hash, proposer_address, num_txs, total_gas, block_time)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [b.height, b.hash, b.proposer_address, b.num_txs, b.total_gas, b.block_time],
    );
  }

  for (const t of corpus.transactions) {
    await pool.query(
      `INSERT INTO transactions
         (hash, block_height, tx_index, tx_type, sender, receiver, amount, denom,
          gas_used, gas_wanted, fee, fee_denom, success, memo, raw_log, timestamp)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        t.hash, t.block_height, t.tx_index, t.tx_type,
        t.sender, t.receiver, t.amount, t.denom,
        t.gas_used, t.gas_wanted, t.fee, t.fee_denom,
        t.success, t.memo, t.raw_log, t.timestamp,
      ],
    );
  }

  for (const v of corpus.validators) {
    await pool.query(
      `INSERT INTO validators
         (operator_address, moniker, tokens, delegator_shares,
          commission_rate, commission_max_rate, commission_max_change,
          min_self_delegation, status, jailed, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, NOW())`,
      [
        v.operator_address, v.moniker, v.tokens, v.delegator_shares,
        v.commission_rate, v.commission_max_rate, v.commission_max_change,
        v.min_self_delegation, v.status, v.jailed,
      ],
    );
  }
}
