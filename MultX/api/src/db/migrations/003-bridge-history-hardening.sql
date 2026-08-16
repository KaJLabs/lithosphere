ALTER TABLE bridge_transactions
    ADD COLUMN IF NOT EXISTS failure_reason TEXT;

DELETE FROM bridge_signatures
WHERE tx_hash !~ '^0x[0-9A-Fa-f]{64}$';

DELETE FROM bridge_transactions
WHERE tx_hash !~ '^0x[0-9A-Fa-f]{64}$';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'bridge_transactions_tx_hash_hex_check'
    ) THEN
        ALTER TABLE bridge_transactions
            ADD CONSTRAINT bridge_transactions_tx_hash_hex_check
            CHECK (tx_hash ~ '^0x[0-9A-Fa-f]{64}$');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'bridge_transactions_release_tx_hash_hex_check'
    ) THEN
        ALTER TABLE bridge_transactions
            ADD CONSTRAINT bridge_transactions_release_tx_hash_hex_check
            CHECK (release_tx_hash IS NULL OR release_tx_hash ~ '^0x[0-9A-Fa-f]{64}$');
    END IF;
END $$;
