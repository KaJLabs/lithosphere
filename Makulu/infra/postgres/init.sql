-- ============================================================================
-- Lithosphere PostgreSQL Initialization Script
-- Creates the initial database schema for the Lithosphere network
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- Token Transfers Table
-- Stores all LEP-100 token transfer events
-- ============================================================================
CREATE TABLE IF NOT EXISTS transfers (
    id VARCHAR(255) PRIMARY KEY,
    "from" VARCHAR(42) NOT NULL,
    "to" VARCHAR(42) NOT NULL,
    value VARCHAR(78) NOT NULL,
    token_id INTEGER NOT NULL DEFAULT 0,
    tx_hash VARCHAR(66) NOT NULL,
    block_height BIGINT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_transfers_from ON transfers("from");
CREATE INDEX IF NOT EXISTS idx_transfers_to ON transfers("to");
CREATE INDEX IF NOT EXISTS idx_transfers_block_height ON transfers(block_height);
CREATE INDEX IF NOT EXISTS idx_transfers_timestamp ON transfers(timestamp);
CREATE INDEX IF NOT EXISTS idx_transfers_token_id ON transfers(token_id);

-- ============================================================================
-- Blocks Table
-- Stores indexed block metadata
-- ============================================================================
CREATE TABLE IF NOT EXISTS blocks (
    number BIGINT PRIMARY KEY,
    hash VARCHAR(66) NOT NULL UNIQUE,
    parent_hash VARCHAR(66) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    gas_used VARCHAR(78),
    gas_limit VARCHAR(78),
    indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocks_hash ON blocks(hash);
CREATE INDEX IF NOT EXISTS idx_blocks_timestamp ON blocks(timestamp);

-- ============================================================================
-- Indexer State Table
-- Tracks the indexer's progress
-- ============================================================================
CREATE TABLE IF NOT EXISTS indexer_state (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Initialize indexer state
INSERT INTO indexer_state (key, value) VALUES 
    ('last_indexed_block', '0'),
    ('indexer_version', '1.0.0')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- Accounts Table (optional, for account tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS accounts (
    address VARCHAR(42) PRIMARY KEY,
    balance VARCHAR(78) NOT NULL DEFAULT '0',
    transaction_count BIGINT NOT NULL DEFAULT 0,
    first_seen_block BIGINT NOT NULL,
    last_seen_block BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_balance ON accounts(balance);
CREATE INDEX IF NOT EXISTS idx_accounts_tx_count ON accounts(transaction_count);

-- ============================================================================
-- Grant Permissions
-- ============================================================================
-- Grant permissions to the lithosphere user (created by POSTGRES_USER env var)
DO $$
BEGIN
    -- Check if the role exists before granting
    IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'lithosphere') THEN
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO lithosphere;
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO lithosphere;
    END IF;
END
$$;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Lithosphere database initialized successfully at %', NOW();
END
$$;
