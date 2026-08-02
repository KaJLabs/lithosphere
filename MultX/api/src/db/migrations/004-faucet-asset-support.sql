ALTER TABLE faucet_claims
    ALTER COLUMN amount_litho DROP NOT NULL;

ALTER TABLE faucet_claims
    ADD COLUMN IF NOT EXISTS asset_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS asset_type VARCHAR(32),
    ADD COLUMN IF NOT EXISTS asset_symbol VARCHAR(32),
    ADD COLUMN IF NOT EXISTS asset_name VARCHAR(128),
    ADD COLUMN IF NOT EXISTS asset_contract_address VARCHAR(42),
    ADD COLUMN IF NOT EXISTS requested_amount VARCHAR(64),
    ADD COLUMN IF NOT EXISTS display_amount VARCHAR(128),
    ADD COLUMN IF NOT EXISTS claim_mode VARCHAR(32),
    ADD COLUMN IF NOT EXISTS token_id VARCHAR(128);

UPDATE faucet_claims
SET
    asset_id = COALESCE(asset_id, 'native-litho'),
    asset_type = COALESCE(asset_type, 'native'),
    asset_symbol = COALESCE(asset_symbol, 'LITHO'),
    asset_name = COALESCE(asset_name, 'Lithosphere'),
    requested_amount = COALESCE(requested_amount, amount_litho, '0'),
    display_amount = COALESCE(display_amount, CONCAT(COALESCE(amount_litho, '0'), ' LITHO')),
    claim_mode = COALESCE(claim_mode, 'transfer')
WHERE asset_id IS NULL
   OR asset_type IS NULL
   OR asset_symbol IS NULL
   OR asset_name IS NULL
   OR requested_amount IS NULL
   OR display_amount IS NULL
   OR claim_mode IS NULL;

ALTER TABLE faucet_claims
    ALTER COLUMN asset_id SET NOT NULL,
    ALTER COLUMN asset_type SET NOT NULL,
    ALTER COLUMN asset_symbol SET NOT NULL,
    ALTER COLUMN asset_name SET NOT NULL,
    ALTER COLUMN requested_amount SET NOT NULL,
    ALTER COLUMN display_amount SET NOT NULL,
    ALTER COLUMN claim_mode SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_faucet_claims_address_asset_time
    ON faucet_claims(normalized_address, asset_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_faucet_claims_asset_token_status
    ON faucet_claims(asset_id, token_id, status);
