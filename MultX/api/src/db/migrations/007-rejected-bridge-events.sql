-- Unsupported semantic routes are evidence, not fatal cursor blockers. Persist
-- them durably so operators can alert/reconcile while valid later events and
-- the durable cursor continue to advance.
CREATE TABLE IF NOT EXISTS bridge_rejected_events (
    chain_id          BIGINT      NOT NULL,
    bridge_address    VARCHAR(42) NOT NULL,
    block_number      BIGINT      NOT NULL,
    block_hash        VARCHAR(66),
    transaction_hash  VARCHAR(66),
    log_index         BIGINT      NOT NULL,
    lock_tx_hash      VARCHAR(66) NOT NULL,
    token_address     VARCHAR(42) NOT NULL,
    from_address      VARCHAR(42) NOT NULL,
    amount            VARCHAR(78) NOT NULL,
    target_chain      VARCHAR(78) NOT NULL,
    source_nonce      BIGINT      NOT NULL,
    rejection_reason  TEXT        NOT NULL,
    first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (chain_id, bridge_address, block_number, log_index)
);

CREATE INDEX IF NOT EXISTS idx_bridge_rejected_events_seen
    ON bridge_rejected_events(last_seen_at DESC);
