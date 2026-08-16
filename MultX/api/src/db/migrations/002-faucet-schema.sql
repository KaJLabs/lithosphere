CREATE TABLE IF NOT EXISTS faucet_claims (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requested_address   VARCHAR(128) NOT NULL,
    normalized_address  VARCHAR(42)  NOT NULL,
    address_type        VARCHAR(16)  NOT NULL,
    amount_litho        VARCHAR(32)  NOT NULL,
    tx_hash             VARCHAR(66),
    status              VARCHAR(20)  NOT NULL DEFAULT 'submitted',
    failure_reason      TEXT,
    requested_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    confirmed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faucet_claims_address_time
    ON faucet_claims(normalized_address, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_faucet_claims_status
    ON faucet_claims(status);

CREATE INDEX IF NOT EXISTS idx_faucet_claims_tx_hash
    ON faucet_claims(tx_hash);
