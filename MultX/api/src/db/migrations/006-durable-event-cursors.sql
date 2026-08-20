-- Durable, per-chain event-listener progress. Cursor updates are committed in
-- the same PostgreSQL transaction as every event in the processed block range.

ALTER TABLE bridge_transactions
  ADD COLUMN IF NOT EXISTS block_hash VARCHAR(66);

CREATE TABLE IF NOT EXISTS bridge_event_cursors (
    chain_id             BIGINT      NOT NULL,
    bridge_address       VARCHAR(42) NOT NULL,
    last_processed_block BIGINT      NOT NULL CHECK (last_processed_block >= 0),
    last_processed_hash  VARCHAR(66) NOT NULL,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (chain_id, bridge_address)
);
