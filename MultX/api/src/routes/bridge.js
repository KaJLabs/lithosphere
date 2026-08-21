import express from 'express';
import { config } from '../config.js';
import { pool } from '../db/pool.js';
import {
  getAllowedSignerAddresses,
  getSignaturesRequired,
} from '../services/validatorService.js';

const router = express.Router();

const statusMapping = {
  pending: 'pending',
  locked: 'pending',
  signing: 'signing',
  signed: 'signing',
  completed: 'completed',
  failed: 'failed'
};

// GET /bridge/status/:txHash
router.get('/status/:txHash', async (req, res, next) => {
  try {
    const { txHash } = req.params;
    const allowedSigners = config.useMockValidator ? null : getAllowedSignerAddresses();

    const result = await pool.query(
      `SELECT bt.*, COUNT(DISTINCT LOWER(bs.validator_address))::int AS signatures_collected
       FROM bridge_transactions bt
       LEFT JOIN bridge_signatures bs ON bs.tx_hash = bt.tx_hash
        AND ($2::text[] IS NULL OR LOWER(bs.validator_address) = ANY($2::text[]))
       WHERE bt.tx_hash = $1
       GROUP BY bt.tx_hash`,
      [txHash, allowedSigners]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const tx = result.rows[0];
    res.json({
      txHash: tx.tx_hash,
      fromAddress: tx.from_address,
      tokenAddress: tx.token_address,
      releaseToken: tx.release_token,
      amount: tx.amount,
      sourceChain: tx.source_chain ? Number(tx.source_chain) : null,
      sourceBridge: tx.source_bridge,
      targetChain: tx.target_chain ? Number(tx.target_chain) : null,
      sourceNonce: tx.source_nonce,
      status: statusMapping[tx.status] || tx.status,
      dbStatus: tx.status,
      signaturesCollected: tx.signatures_collected,
      signaturesRequired: config.useMockValidator
        ? config.mockSignaturesRequired
        : getSignaturesRequired(),
      blockNumber: tx.block_number,
      timestamp: tx.timestamp,
      releaseTxHash: tx.release_tx_hash
    });
  } catch (err) {
    next(err);
  }
});

// GET /bridge/signatures/:txHash
router.get('/signatures/:txHash', async (req, res, next) => {
  try {
    const { txHash } = req.params;
    const allowedSigners = config.useMockValidator ? null : getAllowedSignerAddresses();

    const result = await pool.query(
      `SELECT DISTINCT ON (LOWER(validator_address)) signature FROM bridge_signatures
       WHERE tx_hash = $1
         AND ($2::text[] IS NULL OR LOWER(validator_address) = ANY($2::text[]))
       ORDER BY LOWER(validator_address) ASC, id ASC`,
      [txHash, allowedSigners]
    );

    res.json({
      txHash,
      signatures: result.rows.map(r => r.signature)
    });
  } catch (err) {
    next(err);
  }
});

// GET /bridge/transactions/:address?limit=25&cursor=<timestamp_iso>
router.get('/transactions/:address', async (req, res, next) => {
  try {
    const { address } = req.params;
    const limit  = Math.min(parseInt(req.query.limit  || '25', 10), 100);
    const cursor = req.query.cursor || null; // ISO timestamp — return rows older than this

    const cols = `tx_hash, timestamp, token_address, release_token, source_bridge,
                  source_chain, target_chain, amount, status`;
    let query, params;
    if (cursor) {
      query = `SELECT ${cols}
               FROM bridge_transactions
               WHERE from_address = $1 AND timestamp < $2
               ORDER BY timestamp DESC LIMIT $3`;
      params = [address, cursor, limit];
    } else {
      query = `SELECT ${cols}
               FROM bridge_transactions
               WHERE from_address = $1
               ORDER BY timestamp DESC LIMIT $2`;
      params = [address, limit];
    }

    const result = await pool.query(query, params);

    const transactions = result.rows.map(row => ({
      txHash:       row.tx_hash,
      timestamp:    row.timestamp,
      fromToken:    row.token_address,
      toToken:      row.release_token || row.token_address,
      sourceChain:  row.source_chain ? Number(row.source_chain) : 900523,
      sourceBridge: row.source_bridge,
      targetChain:  row.target_chain ? Number(row.target_chain) : null,
      amount:       (BigInt(row.amount) / BigInt(10 ** 18)).toString(),
      status:       statusMapping[row.status] || row.status,
      explorerUrl:  `https://kamet.litho.ai/tx/${row.tx_hash}`
    }));

    const nextCursor = transactions.length === limit
      ? transactions[transactions.length - 1].timestamp
      : null;

    res.json({ transactions, nextCursor, count: transactions.length });
  } catch (err) {
    next(err);
  }
});

export default router;
