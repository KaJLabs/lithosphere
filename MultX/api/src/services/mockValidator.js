import { ethers } from 'ethers';
import { config } from '../config.js';
import { pool } from '../db/pool.js';

const MNEMONIC = 'test test test test test test test test test test test junk';

let validators = [];
let signingIntervalId = null;

export async function startMockValidator() {
  // Create deterministic validators from mnemonic
  validators = [];
  for (let i = 0; i < config.mockValidatorCount; i++) {
    const path = `m/44'/60'/0'/0/${i}`;
    const wallet = ethers.HDNodeWallet.fromPhrase(MNEMONIC, undefined, path);
    validators.push({
      index: i,
      address: wallet.address,
      wallet: wallet
    });
  }

  console.log(`[MockValidator] Initialized ${validators.length} validators`);
  validators.forEach((v) => console.log(`  Validator ${v.index}: ${v.address}`));

  // Start signing loop
  signingIntervalId = setInterval(processSignings, 5000);
  console.log('[MockValidator] Signing loop started (interval: 5s)');
}

async function processSignings() {
  try {
    // Find all 'locked' transactions
    const result = await pool.query(
      `SELECT tx_hash, from_address, token_address, release_token, amount,
              target_chain, source_chain, source_nonce
       FROM bridge_transactions WHERE status = 'locked'`
    );

    if (result.rows.length === 0) return;

    for (const tx of result.rows) {
      // Transition to signing
      await pool.query(
        `UPDATE bridge_transactions SET status = 'signing' WHERE tx_hash = $1`,
        [tx.tx_hash]
      );

      // Each validator signs with a delay
      for (const validator of validators) {
        setTimeout(async () => {
          try {
            const releaseToken = tx.release_token || tx.token_address;
            const sourceChain  = tx.source_chain  || 900523;
            const targetSpec = config.chainsToWatch.find(
              (chain) => Number(chain.chainId) === Number(tx.target_chain)
            );
            if (!targetSpec?.bridge) throw new Error('target bridge is not configured');
            const hash = ethers.solidityPackedKeccak256(
              ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'address'],
              [tx.tx_hash, releaseToken, tx.from_address, tx.amount, sourceChain, tx.source_nonce,
                tx.target_chain, targetSpec.bridge]
            );

            const signature = await validator.wallet.signMessage(ethers.getBytes(hash));

            await pool.query(
              `INSERT INTO bridge_signatures (tx_hash, validator_address, signature)
               VALUES ($1, $2, $3)
               ON CONFLICT (tx_hash, validator_address) DO NOTHING`,
              [tx.tx_hash, validator.address, signature]
            );

            console.log(`[MockValidator] Signed tx ${tx.tx_hash.substring(0, 10)}... by ${validator.address.substring(0, 10)}...`);

            // Check if we have enough signatures
            const sigResult = await pool.query(
              `SELECT COUNT(*)::int AS sig_count FROM bridge_signatures WHERE tx_hash = $1`,
              [tx.tx_hash]
            );

            if (sigResult.rows[0].sig_count >= config.mockSignaturesRequired) {
              await pool.query(
                `UPDATE bridge_transactions SET status = 'signed' WHERE tx_hash = $1`,
                [tx.tx_hash]
              );
              console.log(`[MockValidator] Tx ${tx.tx_hash.substring(0, 10)}... reached signing threshold`);
            }
          } catch (err) {
            console.error('[MockValidator] Signing error:', err.message);
          }
        }, config.mockSignDelayMs * (validator.index + 1));
      }
    }
  } catch (err) {
    console.error('[MockValidator] processSignings error:', err.message);
  }
}

export function stopMockValidator() {
  if (signingIntervalId) {
    clearInterval(signingIntervalId);
    console.log('[MockValidator] Signing loop stopped');
  }
}
