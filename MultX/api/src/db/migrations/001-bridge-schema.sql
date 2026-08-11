CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS bridge_transactions (
    tx_hash       VARCHAR(66) PRIMARY KEY,
    from_address  VARCHAR(42) NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    amount        VARCHAR(78) NOT NULL,
    target_chain  BIGINT      NOT NULL,
    source_nonce  BIGINT      NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    block_number  BIGINT,
    timestamp     TIMESTAMPTZ DEFAULT NOW(),
    release_tx_hash VARCHAR(66),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bridge_tx_from      ON bridge_transactions(from_address);
CREATE INDEX IF NOT EXISTS idx_bridge_tx_status    ON bridge_transactions(status);
CREATE INDEX IF NOT EXISTS idx_bridge_tx_timestamp ON bridge_transactions(timestamp DESC);

CREATE TABLE IF NOT EXISTS bridge_signatures (
    id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tx_hash           VARCHAR(66) NOT NULL REFERENCES bridge_transactions(tx_hash),
    validator_address VARCHAR(42) NOT NULL,
    signature         TEXT        NOT NULL,
    signed_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sig_unique  ON bridge_signatures(tx_hash, validator_address);
CREATE INDEX        IF NOT EXISTS idx_sig_tx_hash ON bridge_signatures(tx_hash);
