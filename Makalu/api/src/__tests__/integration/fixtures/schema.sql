-- ============================================================================
-- Integration-test schema.
--
-- Mirrors the columns the indexer writes against in Makalu/indexer/src/mappings.ts
-- (see INSERT INTO blocks / transactions / validators). Kept idempotent
-- (CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS) so the loader
-- can apply it before every test run without races.
--
-- This is the cut-down schema sufficient for exercising the /api/blocks,
-- /api/blocks/:height, /api/txs, /api/validators endpoints end-to-end. The
-- production schema lives in the indexer's bootstrap path; this file is
-- intentionally a snapshot, not a migration source-of-truth.
-- ============================================================================

CREATE TABLE IF NOT EXISTS blocks (
  height            BIGINT PRIMARY KEY,
  hash              TEXT NOT NULL,
  proposer_address  TEXT,
  num_txs           INTEGER NOT NULL DEFAULT 0,
  total_gas         TEXT NOT NULL DEFAULT '0',
  block_time        TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blocks_block_time ON blocks (block_time DESC);

CREATE TABLE IF NOT EXISTS transactions (
  hash          TEXT PRIMARY KEY,
  block_height  BIGINT NOT NULL,
  tx_index      INTEGER NOT NULL,
  tx_type       TEXT,
  sender        TEXT,
  receiver      TEXT,
  amount        TEXT NOT NULL DEFAULT '0',
  denom         TEXT,
  gas_used      TEXT NOT NULL DEFAULT '0',
  gas_wanted    TEXT NOT NULL DEFAULT '0',
  fee           TEXT NOT NULL DEFAULT '0',
  fee_denom     TEXT,
  success       BOOLEAN NOT NULL DEFAULT TRUE,
  memo          TEXT NOT NULL DEFAULT '',
  raw_log       TEXT NOT NULL DEFAULT '',
  timestamp     TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_block_height ON transactions (block_height DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_sender ON transactions (sender);

CREATE TABLE IF NOT EXISTS validators (
  operator_address       TEXT PRIMARY KEY,
  consensus_pubkey       TEXT,
  moniker                TEXT NOT NULL DEFAULT '',
  identity               TEXT NOT NULL DEFAULT '',
  website                TEXT NOT NULL DEFAULT '',
  security_contact       TEXT NOT NULL DEFAULT '',
  details                TEXT NOT NULL DEFAULT '',
  commission_rate        TEXT NOT NULL DEFAULT '0',
  commission_max_rate    TEXT NOT NULL DEFAULT '0',
  commission_max_change  TEXT NOT NULL DEFAULT '0',
  min_self_delegation    TEXT NOT NULL DEFAULT '0',
  tokens                 TEXT NOT NULL DEFAULT '0',
  delegator_shares       TEXT NOT NULL DEFAULT '0',
  status                 INTEGER NOT NULL DEFAULT 3,
  jailed                 BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
