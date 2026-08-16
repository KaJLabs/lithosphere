-- 005-multichain-events.sql
--
-- Schema additions for multichain bridge event handling (M4 v1).
--
-- Until this migration, the event listener only watched Kamet (chainId 900523)
-- and the validator service implicitly assumed every lock originated there.
-- The release-side hash that the contract verifies (per MultXBridge.releaseTokens)
-- is keccak256(sourceTxHash, token, user, amount, sourceChain, sourceNonce),
-- where `token` is the address on the chain WHERE RELEASE HAPPENS — which may
-- differ from the locked token (e.g. wrapped vs original). The current code
-- erroneously substitutes target_chain into the sourceChain slot of the hash,
-- which only happened to work because cross-chain release was never executed
-- end-to-end in production.
--
-- This migration adds:
--   1. source_chain   — chainId where the lock event was observed
--   2. release_token  — token address on the chain where release will happen
--                       (looked up from the token registry in bridge-api config)
--
-- Both have safe defaults: existing rows are all Kamet locks targeting dest
-- chains, so source_chain=900523 is correct, and release_token defaults to
-- token_address (the locked token = the released token only when the bridge
-- holds the same canonical asset; for v0/v1 testnet rollout, the populated
-- value will be the dest-chain wrapped token).

ALTER TABLE bridge_transactions
    ADD COLUMN IF NOT EXISTS source_chain  BIGINT  NOT NULL DEFAULT 900523,
    ADD COLUMN IF NOT EXISTS release_token VARCHAR(42);

-- Backfill release_token from token_address where unset (preserves existing
-- single-direction behavior; will be overwritten by the event listener for
-- new rows once the multichain registry kicks in).
UPDATE bridge_transactions
SET release_token = token_address
WHERE release_token IS NULL;

CREATE INDEX IF NOT EXISTS idx_bridge_tx_source_chain ON bridge_transactions(source_chain);
