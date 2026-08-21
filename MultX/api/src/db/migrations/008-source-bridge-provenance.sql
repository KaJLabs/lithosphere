-- Persist the immutable source-bridge identity observed by the event watcher.
-- Existing rows are backfilled only when their source chain has exactly one
-- durable bridge cursor; ambiguous history fails closed for manual review.

ALTER TABLE bridge_transactions
    ADD COLUMN IF NOT EXISTS source_bridge VARCHAR(42);

WITH unique_chain_bridges AS (
    SELECT chain_id, MIN(bridge_address) AS bridge_address
      FROM bridge_event_cursors
     GROUP BY chain_id
    HAVING COUNT(DISTINCT LOWER(bridge_address)) = 1
)
UPDATE bridge_transactions AS tx
   SET source_bridge = source.bridge_address
  FROM unique_chain_bridges AS source
 WHERE tx.source_bridge IS NULL
   AND tx.source_chain = source.chain_id;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM bridge_transactions WHERE source_bridge IS NULL) THEN
        RAISE EXCEPTION 'Cannot prove source bridge for existing bridge transaction history; reconcile before migration';
    END IF;
END $$;

ALTER TABLE bridge_transactions
    ALTER COLUMN source_bridge SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'bridge_transactions_source_bridge_hex_check'
    ) THEN
        ALTER TABLE bridge_transactions
            ADD CONSTRAINT bridge_transactions_source_bridge_hex_check
            CHECK (source_bridge ~ '^0x[0-9a-fA-F]{40}$');
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bridge_tx_source_bridge
    ON bridge_transactions(source_chain, LOWER(source_bridge));
