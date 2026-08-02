import { ethers } from 'ethers';
import { config } from '../config.js';
import { pool } from '../db/pool.js';
import { kmsKeyAddress, kmsSignEthMessage } from './kmsSigner.js';

let validators = [];
let signingIntervalId = null;

/**
 * Load validator identities. Each validator is identified by an AWS KMS
 * key ARN (or alias). At startup we GetPublicKey to derive the Ethereum
 * address — that address is what the on-chain bridge expects in the
 * validator set. If no KMS ARNs are configured, falls back to env-var
 * private keys (legacy / local dev only).
 */
async function loadValidators() {
  const loaded = [];

  // ── Preferred: KMS-managed validators ───────────────────────────────────
  for (let i = 0; i < 10; i++) {
    const kmsArn = process.env[`VALIDATOR_KMS_KEY_ARN_${i}`];
    if (!kmsArn) break;
    try {
      const address = await kmsKeyAddress(kmsArn);
      loaded.push({ index: i, address, kmsArn, kind: 'kms' });
    } catch (err) {
      console.error(`[ValidatorService] KMS init failed for VALIDATOR_KMS_KEY_ARN_${i}: ${err.message}`);
    }
  }

  if (loaded.length > 0) return loaded;

  // ── Fallback: env-var private keys (legacy v0 path) ─────────────────────
  for (let i = 0; i < 10; i++) {
    const key = process.env[`VALIDATOR_PRIVATE_KEY_${i}`];
    if (!key) break;
    try {
      const wallet = new ethers.Wallet(key);
      loaded.push({ index: i, address: wallet.address, wallet, kind: 'envkey' });
    } catch (err) {
      console.error(`[ValidatorService] Invalid key at VALIDATOR_PRIVATE_KEY_${i}: ${err.message}`);
    }
  }
  return loaded;
}

export async function startValidatorService() {
  validators = await loadValidators();

  if (validators.length === 0) {
    throw new Error(
      '[ValidatorService] No validator keys found. Set either ' +
      'VALIDATOR_KMS_KEY_ARN_0..N (preferred) or VALIDATOR_PRIVATE_KEY_0..N (legacy), ' +
      'or set MOCK_VALIDATOR=true for local dev with the deterministic mock.'
    );
  }

  const kinds = validators.map((v) => v.kind);
  const kmsCount = kinds.filter((k) => k === 'kms').length;
  const envCount = kinds.filter((k) => k === 'envkey').length;
  console.log(
    `[ValidatorService] Loaded ${validators.length} validator(s) — ` +
    `KMS: ${kmsCount}, env-var: ${envCount}`
  );
  validators.forEach((v) =>
    console.log(`  Validator ${v.index} (${v.kind}): ${v.address}`)
  );

  signingIntervalId = setInterval(processSignings, 5000);
  console.log('[ValidatorService] Signing loop started (interval: 5s)');
}

async function signWith(validator, messageBytes) {
  // ethers.Wallet.signMessage and KMS both produce signatures verifiable by
  // ecrecover(hashMessage(messageBytes), sig). The on-chain bridge calls
  // ecrecover with that exact hash, so both paths interop with the contract.
  if (validator.kind === 'kms') {
    return kmsSignEthMessage({
      keyId: validator.kmsArn,
      message: messageBytes,
      expectedAddress: validator.address,
    });
  }
  return validator.wallet.signMessage(messageBytes);
}

async function processSignings() {
  try {
    const result = await pool.query(
      `SELECT tx_hash, from_address, token_address, release_token, amount,
              target_chain, source_chain, source_nonce
       FROM bridge_transactions WHERE status = 'locked'`
    );

    if (result.rows.length === 0) return;

    for (const tx of result.rows) {
      await pool.query(
        `UPDATE bridge_transactions SET status = 'signing' WHERE tx_hash = $1`,
        [tx.tx_hash]
      );

      // The release-side contract verifies:
      //   keccak256(sourceTxHash, token, user, amount, sourceChain, sourceNonce)
      // where `token` is the address on the RELEASE chain (release_token).
      const releaseToken = tx.release_token || tx.token_address;
      const sourceChain  = tx.source_chain  || 900523;

      for (const validator of validators) {
        try {
          const hashHex = ethers.utils.solidityKeccak256(
            ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
            [tx.tx_hash, releaseToken, tx.from_address, tx.amount, sourceChain, tx.source_nonce]
          );

          const signature = await signWith(validator, ethers.utils.arrayify(hashHex));

          await pool.query(
            `INSERT INTO bridge_signatures (tx_hash, validator_address, signature)
             VALUES ($1, $2, $3)
             ON CONFLICT (tx_hash, validator_address) DO NOTHING`,
            [tx.tx_hash, validator.address, signature]
          );

          console.log(
            `[ValidatorService] Signed tx ${tx.tx_hash.substring(0, 10)}... ` +
            `by ${validator.address.substring(0, 10)}... (${validator.kind})`
          );

          const sigResult = await pool.query(
            `SELECT COUNT(*)::int AS sig_count FROM bridge_signatures WHERE tx_hash = $1`,
            [tx.tx_hash]
          );

          if (sigResult.rows[0].sig_count >= config.signaturesRequired) {
            await pool.query(
              `UPDATE bridge_transactions SET status = 'signed' WHERE tx_hash = $1`,
              [tx.tx_hash]
            );
            console.log(`[ValidatorService] Tx ${tx.tx_hash.substring(0, 10)}... reached signing threshold`);
          }
        } catch (err) {
          console.error(`[ValidatorService] Signing error (validator ${validator.index}): ${err.message}`);
        }
      }
    }
  } catch (err) {
    console.error('[ValidatorService] processSignings error:', err.message);
  }
}

export function stopValidatorService() {
  if (signingIntervalId) {
    clearInterval(signingIntervalId);
    console.log('[ValidatorService] Signing loop stopped');
  }
}
