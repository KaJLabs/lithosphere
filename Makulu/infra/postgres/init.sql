-- ============================================================================
-- Lithosphere PostgreSQL Initialization Script
-- Canonical schema for LITHOSCAN Explorer & Indexer
-- ============================================================================
-- Source: Reconciled from validator-infra 001-schema.sql + Makulu schema
-- Compatible with: Ethermint dual-layer chain (Cosmos + EVM transactions)
-- ============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- BLOCKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS blocks (
    height BIGINT PRIMARY KEY,
    hash VARCHAR(64) NOT NULL UNIQUE,
    proposer_address VARCHAR(100),
    num_txs INTEGER DEFAULT 0,
    total_gas BIGINT DEFAULT 0,
    block_time TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocks_hash ON blocks(hash);
CREATE INDEX IF NOT EXISTS idx_blocks_proposer ON blocks(proposer_address);
CREATE INDEX IF NOT EXISTS idx_blocks_time ON blocks(block_time DESC);

-- ============================================================================
-- TRANSACTIONS TABLE (Cosmos-layer)
-- ============================================================================

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hash VARCHAR(64) NOT NULL UNIQUE,
    block_height BIGINT REFERENCES blocks(height),
    tx_index INTEGER,
    tx_type VARCHAR(50),
    sender VARCHAR(100),
    receiver VARCHAR(100),
    amount VARCHAR(78),
    denom VARCHAR(50),
    gas_used BIGINT,
    gas_wanted BIGINT,
    fee VARCHAR(78),
    fee_denom VARCHAR(50),
    success BOOLEAN DEFAULT TRUE,
    memo TEXT,
    raw_log TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_hash ON transactions(hash);
CREATE INDEX IF NOT EXISTS idx_tx_block ON transactions(block_height);
CREATE INDEX IF NOT EXISTS idx_tx_sender ON transactions(sender);
CREATE INDEX IF NOT EXISTS idx_tx_receiver ON transactions(receiver);
CREATE INDEX IF NOT EXISTS idx_tx_timestamp ON transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(tx_type);

-- ============================================================================
-- EVM TRANSACTIONS TABLE
-- Dual-layer: Ethermint wraps EVM txs inside Cosmos MsgEthereumTx messages
-- ============================================================================

CREATE TABLE IF NOT EXISTS evm_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hash VARCHAR(66) NOT NULL UNIQUE,
    cosmos_tx_hash VARCHAR(64) REFERENCES transactions(hash),
    block_height BIGINT,
    tx_index INTEGER,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42),
    value VARCHAR(78),
    gas_price VARCHAR(78),
    gas_limit BIGINT,
    gas_used BIGINT,
    nonce BIGINT,
    input_data TEXT,
    contract_address VARCHAR(42),
    status BOOLEAN DEFAULT TRUE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evm_tx_hash ON evm_transactions(hash);
CREATE INDEX IF NOT EXISTS idx_evm_tx_from ON evm_transactions(from_address);
CREATE INDEX IF NOT EXISTS idx_evm_tx_to ON evm_transactions(to_address);
CREATE INDEX IF NOT EXISTS idx_evm_tx_contract ON evm_transactions(contract_address);
CREATE INDEX IF NOT EXISTS idx_evm_tx_block ON evm_transactions(block_height);

-- ============================================================================
-- ACCOUNTS TABLE
-- Stores both Cosmos (litho1...) and EVM (0x...) address formats.
-- The Lithosphere chain is Ethermint-based: same key bytes, two encodings.
-- ============================================================================

CREATE TABLE IF NOT EXISTS accounts (
    address VARCHAR(100) PRIMARY KEY,        -- Cosmos bech32 address (litho1...)
    evm_address VARCHAR(42),                 -- EVM hex address (0x...)
    balance VARCHAR(78) DEFAULT '0',
    sequence BIGINT DEFAULT 0,
    account_number BIGINT,
    pub_key TEXT,
    account_type VARCHAR(50),
    first_seen_block BIGINT,
    last_seen_block BIGINT,
    tx_count BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_evm ON accounts(evm_address);
CREATE INDEX IF NOT EXISTS idx_accounts_balance ON accounts(balance);

-- ============================================================================
-- VALIDATORS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS validators (
    operator_address VARCHAR(100) PRIMARY KEY,
    consensus_address VARCHAR(100) UNIQUE,
    consensus_pubkey TEXT,
    moniker VARCHAR(100),
    identity VARCHAR(50),
    website VARCHAR(255),
    security_contact VARCHAR(255),
    details TEXT,
    commission_rate VARCHAR(20),
    commission_max_rate VARCHAR(20),
    commission_max_change VARCHAR(20),
    min_self_delegation VARCHAR(78),
    tokens VARCHAR(78) DEFAULT '0',
    delegator_shares VARCHAR(78) DEFAULT '0',
    status INTEGER DEFAULT 0,
    jailed BOOLEAN DEFAULT FALSE,
    unbonding_height BIGINT,
    unbonding_time TIMESTAMP WITH TIME ZONE,
    uptime_percentage DECIMAL(5,2) DEFAULT 100.00,
    missed_blocks_counter BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validators_moniker ON validators(moniker);
CREATE INDEX IF NOT EXISTS idx_validators_status ON validators(status);
CREATE INDEX IF NOT EXISTS idx_validators_tokens ON validators(tokens);

-- ============================================================================
-- TOKEN TRANSFERS (LEP-100)
-- ============================================================================

CREATE TABLE IF NOT EXISTS token_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tx_hash VARCHAR(66) NOT NULL,
    log_index INTEGER,
    contract_address VARCHAR(42) NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    value VARCHAR(78) NOT NULL,
    token_id VARCHAR(78),
    block_height BIGINT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfers_tx ON token_transfers(tx_hash);
CREATE INDEX IF NOT EXISTS idx_transfers_contract ON token_transfers(contract_address);
CREATE INDEX IF NOT EXISTS idx_transfers_from ON token_transfers(from_address);
CREATE INDEX IF NOT EXISTS idx_transfers_to ON token_transfers(to_address);
CREATE INDEX IF NOT EXISTS idx_transfers_block ON token_transfers(block_height);

-- ============================================================================
-- CONTRACTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS contracts (
    address VARCHAR(42) PRIMARY KEY,
    creator VARCHAR(42),
    creation_tx VARCHAR(66),
    creation_block BIGINT,
    bytecode TEXT,
    verified BOOLEAN DEFAULT FALSE,
    name VARCHAR(100),
    symbol VARCHAR(20),
    decimals INTEGER,
    total_supply VARCHAR(78),
    contract_type VARCHAR(50),
    source_code TEXT,
    abi JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_creator ON contracts(creator);
CREATE INDEX IF NOT EXISTS idx_contracts_type ON contracts(contract_type);

-- ============================================================================
-- PROPOSALS (GOVERNANCE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS proposals (
    id BIGINT PRIMARY KEY,
    title VARCHAR(255),
    description TEXT,
    proposal_type VARCHAR(50),
    proposer VARCHAR(100),
    status VARCHAR(50),
    submit_time TIMESTAMP WITH TIME ZONE,
    deposit_end_time TIMESTAMP WITH TIME ZONE,
    voting_start_time TIMESTAMP WITH TIME ZONE,
    voting_end_time TIMESTAMP WITH TIME ZONE,
    total_deposit VARCHAR(78),
    yes_votes VARCHAR(78) DEFAULT '0',
    no_votes VARCHAR(78) DEFAULT '0',
    abstain_votes VARCHAR(78) DEFAULT '0',
    no_with_veto_votes VARCHAR(78) DEFAULT '0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_proposer ON proposals(proposer);

-- ============================================================================
-- INDEXER STATE
-- ============================================================================

CREATE TABLE IF NOT EXISTS indexer_state (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Initialize indexer state
INSERT INTO indexer_state (key, value) VALUES
    ('last_indexed_block', '0'),
    ('last_indexed_evm_block', '0'),
    ('indexer_version', '1.0.0')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- STATISTICS TABLE (for dashboard)
-- ============================================================================

CREATE TABLE IF NOT EXISTS network_stats (
    id SERIAL PRIMARY KEY,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_transactions BIGINT,
    total_accounts BIGINT,
    total_contracts BIGINT,
    avg_block_time DECIMAL(10,3),
    avg_gas_price VARCHAR(78),
    daily_transactions BIGINT,
    daily_active_accounts BIGINT
);

CREATE INDEX IF NOT EXISTS idx_stats_time ON network_stats(recorded_at DESC);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Auto-increment account tx_count on transaction insert
CREATE OR REPLACE FUNCTION update_account_tx_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE accounts SET
        tx_count = tx_count + 1,
        last_seen_block = NEW.block_height,
        updated_at = NOW()
    WHERE address = NEW.sender OR address = NEW.receiver;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for transaction counts
DROP TRIGGER IF EXISTS tx_account_counter ON transactions;
CREATE TRIGGER tx_account_counter
    AFTER INSERT ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_account_tx_count();

-- ============================================================================
-- Grant Permissions
-- ============================================================================
-- Grant permissions to known application users.
-- Dev: "lithosphere" (POSTGRES_USER in .env.local/.env.testnet)
-- Prod: "litho" / "lithoscan_admin" (RDS / .env.mainnet)
DO $$
DECLARE
    _role TEXT;
BEGIN
    FOREACH _role IN ARRAY ARRAY['lithosphere', 'litho', 'lithoscan_admin'] LOOP
        IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = _role) THEN
            EXECUTE format('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO %I', _role);
            EXECUTE format('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO %I', _role);
        END IF;
    END LOOP;
END
$$;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'LITHOSCAN database initialized successfully at %', NOW();
END
$$;
