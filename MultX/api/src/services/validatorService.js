import fs from 'fs';
import { ethers } from 'ethers';
import { config } from '../config.js';
import { pool } from '../db/pool.js';
import { createRemoteSigner } from './remoteSigner.js';

let validators = [];
let signingIntervalId = null;

/**
 * Production uses one independently operated HTTPS signer per validator,
 * authenticated with mTLS. A signer-reported address must match the explicit
 * configured on-chain address before the API accepts it.
 *
 * File-backed keys exist only for local development and tests. Production
 * rejects them so a single API VPS cannot silently hold the whole quorum.
 */
async function loadValidators() {
  const loaded = [];

  for (let i = 0; i < 10; i++) {
    const url = process.env[`VALIDATOR_SIGNER_URL_${i}`];
    if (!url) break;
    try {
      loaded.push(await createRemoteSigner({
        index: i,
        url,
        expectedAddress: process.env[`VALIDATOR_SIGNER_ADDRESS_${i}`],
        caFile: process.env[`VALIDATOR_SIGNER_CA_FILE_${i}`],
        certFile: process.env[`VALIDATOR_SIGNER_CERT_FILE_${i}`],
        keyFile: process.env[`VALIDATOR_SIGNER_KEY_FILE_${i}`],
        timeoutMs: parseInt(process.env.VALIDATOR_SIGNER_TIMEOUT_MS || '8000', 10),
      }));
    } catch (err) {
      throw new Error(`[ValidatorService] remote signer ${i} initialization failed: ${err.message}`);
    }
  }

  if (loaded.length > 0 || process.env.NODE_ENV === 'production') return loaded;

  for (let i = 0; i < 10; i++) {
    const keyFile = process.env[`VALIDATOR_PRIVATE_KEY_FILE_${i}`];
    if (!keyFile) break;
    try {
      const key = fs.readFileSync(keyFile, 'utf8').trim();
      const wallet = new ethers.Wallet(key);
      loaded.push({ index: i, address: wallet.address, wallet, kind: 'filekey' });
    } catch (err) {
      console.error(`[ValidatorService] Invalid key file at VALIDATOR_PRIVATE_KEY_FILE_${i}: ${err.message}`);
    }
  }
  return loaded;
}

export async function startValidatorService() {
  if (process.env.NODE_ENV === 'production' && !process.env.SIGNATURES_REQUIRED) {
    throw new Error('[ValidatorService] SIGNATURES_REQUIRED must be explicit in production');
  }
  if (!Number.isSafeInteger(config.signaturesRequired) || config.signaturesRequired < 1) {
    throw new Error('[ValidatorService] SIGNATURES_REQUIRED must be a positive safe integer');
  }
  validators = await loadValidators();

  if (validators.length === 0) {
    throw new Error(
      '[ValidatorService] No validator signers found. Production requires ' +
      'VALIDATOR_SIGNER_URL_0..N plus address and mTLS file settings. ' +
      'Local development may use VALIDATOR_PRIVATE_KEY_FILE_0..N or MOCK_VALIDATOR=true.'
    );
  }
  if (validators.length < config.signaturesRequired) {
    throw new Error(
      `[ValidatorService] Loaded ${validators.length} signer(s), below configured threshold ` +
      `${config.signaturesRequired}. Refusing to start.`
    );
  }

  const remoteCount = validators.filter((v) => v.kind === 'remote').length;
  const fileCount = validators.filter((v) => v.kind === 'filekey').length;
  console.log(
    `[ValidatorService] Loaded ${validators.length} validator(s) - ` +
    `remote: ${remoteCount}, local-file: ${fileCount}`
  );
  validators.forEach((v) =>
    console.log(`  Validator ${v.index} (${v.kind}): ${v.address}`)
  );

  signingIntervalId = setInterval(processSignings, 5000);
  console.log('[ValidatorService] Signing loop started (interval: 5s)');
}

async function signWith(validator, attestation) {
  if (validator.kind === 'remote') return validator.signRelease(attestation);
  const hashHex = ethers.solidityPackedKeccak256(
    ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'address'],
    [
      attestation.sourceTxHash,
      attestation.releaseToken,
      attestation.user,
      attestation.amount,
      attestation.sourceChain,
      attestation.sourceNonce,
      attestation.targetChain,
      attestation.releaseBridge,
    ]
  );
  return validator.wallet.signMessage(ethers.getBytes(hashHex));
}

async function processSignings() {
  try {
    const result = await pool.query(
      `SELECT tx_hash, from_address, token_address, release_token, amount,
              target_chain, source_chain, source_nonce, block_number
       FROM bridge_transactions WHERE status IN ('locked', 'signing')`
    );

    if (result.rows.length === 0) return;

    for (const tx of result.rows) {
      const releaseToken = tx.release_token || tx.token_address;
      const sourceChain = tx.source_chain || 900523;
      const sourceSpec = config.chainsToWatch.find((c) => Number(c.chainId) === Number(sourceChain));
      const targetSpec = config.chainsToWatch.find((c) => Number(c.chainId) === Number(tx.target_chain));
      if (!sourceSpec?.bridge || !targetSpec?.bridge || !tx.block_number) {
        console.error(`[ValidatorService] Refusing ${tx.tx_hash}: missing source/target bridge or block evidence`);
        continue;
      }

      const attestation = {
        sourceTxHash: tx.tx_hash,
        sourceChain,
        sourceNonce: tx.source_nonce,
        sourceBlock: tx.block_number,
        sourceBridge: sourceSpec.bridge,
        sourceToken: tx.token_address,
        releaseToken,
        user: tx.from_address,
        amount: tx.amount,
        targetChain: tx.target_chain,
        releaseBridge: targetSpec.bridge,
      };

      await pool.query(
        `UPDATE bridge_transactions SET status = 'signing' WHERE tx_hash = $1 AND status = 'locked'`,
        [tx.tx_hash]
      );

      for (const validator of validators) {
        try {
          const signature = await signWith(validator, attestation);

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
