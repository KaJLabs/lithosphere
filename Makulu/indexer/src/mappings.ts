import 'dotenv/config';
import { createHash } from 'crypto';
import pkg, { type PoolClient } from 'pg';
const { Pool } = pkg;
import { Gauge, register, collectDefaultMetrics } from 'prom-client';
import express from 'express';

// ─── Config ───────────────────────────────────────────────────────────────────

const RPC_URL = (process.env.RPC_URL || process.env.LITHO_RPC_URL || 'https://rpc.litho.ai').replace(/\/$/, '');
// Derive LCD from RPC: https://rpc.litho.ai → https://api.litho.ai
const LCD_URL = (process.env.REST_URL || process.env.LCD_URL || RPC_URL.replace('://rpc.', '://api.')).replace(/\/$/, '');
const EVM_RPC_URL = process.env.EVM_RPC_URL || null;
const START_BLOCK = parseInt(process.env.START_BLOCK || process.env.INDEXER_START_BLOCK || '1');
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || process.env.INDEXER_BATCH_SIZE || '100');
const POLL_MS = 6000;           // Wait between polls when caught up
const CATCHUP_DELAY_MS = 100;   // Delay between batches during bulk sync

// ─── DB Pool ──────────────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: process.env.DATABASE_URL?.includes('sslmode=disable')
    ? false
    : { rejectUnauthorized: false },
});
pool.on('error', (err) => console.error('[db] Pool error:', err.message));

// ─── Prometheus ───────────────────────────────────────────────────────────────

collectDefaultMetrics({ prefix: 'litho_indexer_' });
const gIndexed = new Gauge({ name: 'litho_indexer_last_indexed_block', help: 'Last indexed block height' });
const gChain   = new Gauge({ name: 'litho_indexer_chain_height',       help: 'Chain tip height' });

// ─── Types ────────────────────────────────────────────────────────────────────

interface RpcBlock {
  block_id: { hash: string };
  block: {
    header: { height: string; time: string; proposer_address: string };
    data: { txs?: string[] };
  };
}

interface TxEvent {
  type: string;
  attributes: Array<{ key: string; value: string }>;
}

interface TxResult {
  code: number;
  log: string;
  gas_wanted: string;
  gas_used: string;
  events: TxEvent[];
}

interface RpcBlockResults {
  height: string;
  txs_results: TxResult[] | null;
}

type DbClient = PoolClient;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Safely decode a CometBFT base64-encoded attribute. Returns null if not valid base64. */
function tryBase64(s: string): string | null {
  if (!s) return null;
  try {
    const buf = Buffer.from(s, 'base64');
    // Only accept if round-trip matches (i.e. string is genuine base64, not plain text)
    if (buf.toString('base64').replace(/=+$/, '') !== s.replace(/=+$/, '')) return null;
    const d = buf.toString('utf-8');
    // Reject if it contains replacement characters (invalid UTF-8)
    if (d.includes('\uFFFD')) return null;
    return d;
  } catch { return null; }
}

/** Get the first matching event attribute value. Handles both plain and base64-encoded attributes. */
function attr(events: TxEvent[], eventType: string, key: string): string {
  for (const ev of events) {
    if (ev.type !== eventType) continue;
    for (const a of ev.attributes) {
      // Try plain text first, then base64-decoded
      const rawKey = a.key;
      if (rawKey === key) return a.value;
      const decodedKey = tryBase64(rawKey);
      if (decodedKey === key) {
        // Keys are base64-encoded, so decode the value too
        return tryBase64(a.value) ?? a.value;
      }
    }
  }
  return '';
}

/** Fetch from CometBFT JSON-RPC. */
async function rpcGet<T>(path: string): Promise<T> {
  const resp = await fetch(`${RPC_URL}${path}`, { signal: AbortSignal.timeout(30_000) });
  if (!resp.ok) throw new Error(`RPC ${path} → HTTP ${resp.status}`);
  const json = await resp.json() as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(`RPC error on ${path}: ${json.error.message}`);
  return json.result as T;
}

async function getLastIndexedBlock(): Promise<number> {
  const r = await pool.query<{ value: string }>(
    `SELECT value FROM indexer_state WHERE key = 'last_indexed_block'`
  );
  return parseInt(r.rows[0]?.value ?? '0') || 0;
}

async function setLastIndexedBlock(height: number): Promise<void> {
  await pool.query(
    `INSERT INTO indexer_state (key, value, updated_at)
     VALUES ('last_indexed_block', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [String(height)]
  );
  gIndexed.set(height);
}

// ─── Block Indexing ───────────────────────────────────────────────────────────

async function indexBlock(height: number): Promise<void> {
  const [blockData, resultsData] = await Promise.all([
    rpcGet<RpcBlock>(`/block?height=${height}`),
    rpcGet<RpcBlockResults>(`/block_results?height=${height}`),
  ]);

  const rawTxs    = blockData.block.data.txs ?? [];
  const txResults = resultsData.txs_results ?? [];
  const totalGas  = txResults.reduce((s, r) => s + parseInt(r.gas_used || '0'), 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO blocks (height, hash, proposer_address, num_txs, total_gas, block_time)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (height) DO UPDATE SET
         num_txs = GREATEST(blocks.num_txs, EXCLUDED.num_txs),
         total_gas = GREATEST(blocks.total_gas, EXCLUDED.total_gas),
         proposer_address = COALESCE(EXCLUDED.proposer_address, blocks.proposer_address)`,
      [
        height,
        blockData.block_id.hash.toLowerCase(),
        blockData.block.header.proposer_address.toLowerCase(),
        rawTxs.length,
        totalGas,
        blockData.block.header.time,
      ]
    );

    for (let i = 0; i < rawTxs.length; i++) {
      const txBytes = Buffer.from(rawTxs[i], 'base64');
      const txHash  = createHash('sha256').update(txBytes).digest('hex').toUpperCase();
      const result  = txResults[i];
      if (result) {
        await indexTx(client, txHash, height, i, blockData.block.header.time, result);
      }
    }

    await client.query('COMMIT');
    if (rawTxs.length > 0) {
      console.log(`[indexer] Block ${height}: ${rawTxs.length} tx(s) indexed`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[indexer] Block ${height} FAILED: ${msg}`);
    // Log the first block failure in detail to help diagnose schema mismatches
    if (height <= 10 || rawTxs.length > 0) {
      console.error(`[indexer] Block ${height} detail — txs: ${rawTxs.length}, hash: ${blockData.block_id.hash.substring(0, 16)}…`);
    }
    throw err;
  } finally {
    client.release();
  }
}

// ─── Transaction Indexing ─────────────────────────────────────────────────────

async function indexTx(
  client: DbClient,
  hash: string,
  height: number,
  index: number,
  blockTime: string,
  result: TxResult
): Promise<void> {
  const evts    = result.events ?? [];
  const success = result.code === 0;
  const gasUsed = parseInt(result.gas_used   || '0');
  const gasWant = parseInt(result.gas_wanted || '0');

  // Action / tx type (e.g. "/cosmos.bank.v1beta1.MsgSend" → "MsgSend")
  const action = attr(evts, 'message', 'action');
  const txType = action ? (action.split('.').pop() ?? action) : 'Unknown';
  const isEvm  = txType === 'MsgEthereumTx';
  // Log tx details for diagnostics
  console.log(`[tx] height=${height} hash=${hash.substring(0, 16)}… type=${txType} action=${action} isEvm=${isEvm} events=${evts.map(e => e.type).join(',')}`);

  // Sender / receiver / amount — pulled from emitted events (no protobuf needed)
  const sender   = attr(evts, 'message', 'sender')          ||
                   attr(evts, 'transfer', 'sender')          || '';
  const receiver = attr(evts, 'coin_received', 'receiver')   ||
                   attr(evts, 'transfer', 'recipient')        || '';
  const rawAmt   = attr(evts, 'coin_received', 'amount')     ||
                   attr(evts, 'transfer', 'amount')           || '0';

  // Parse "1234567ulitho" → amount + denom
  const amtMatch = rawAmt.match(/^(\d+)([a-zA-Z/]+)$/);
  const amount   = amtMatch?.[1] ?? '0';
  const denom    = amtMatch?.[2] ?? 'ulitho';

  // Fee
  const feeStr   = attr(evts, 'tx', 'fee') || '';
  const feeMatch = feeStr.match(/^(\d+)([a-zA-Z/]+)$/);
  const fee      = feeMatch?.[1] ?? '0';
  const feeDenom = feeMatch?.[2] ?? 'ulitho';
  const memo     = attr(evts, 'tx', 'memo') || '';

  if (sender)                   await upsertAccount(client, sender,   height);
  if (receiver && receiver !== sender) await upsertAccount(client, receiver, height);

  await client.query(
    `INSERT INTO transactions
       (hash, block_height, tx_index, tx_type, sender, receiver, amount, denom,
        gas_used, gas_wanted, fee, fee_denom, success, memo, raw_log, timestamp)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (hash) DO NOTHING`,
    [
      hash, height, index, txType,
      sender   || null,
      receiver || null,
      amount, denom,
      gasUsed, gasWant,
      fee, feeDenom,
      success,
      memo,
      result.log?.substring(0, 2000) || '',
      blockTime,
    ]
  );

  // EVM transaction
  if (isEvm) {
    const evmHash = attr(evts, 'ethereum_tx', 'ethereumTxHash');
    if (evmHash) {
      console.log(`[evm] Indexing EVM tx ${evmHash} (cosmos: ${hash}) at height ${height}`);
      await indexEvmTx(client, evmHash, hash, height, index, blockTime, evts, result, gasUsed);
    } else {
      console.warn(`[evm] MsgEthereumTx at height ${height} has no ethereumTxHash event`);
    }
  }
}

// ─── EVM Transaction Indexing ─────────────────────────────────────────────────

async function indexEvmTx(
  client: DbClient,
  evmHash: string,
  cosmosTxHash: string,
  height: number,
  txIndex: number,
  blockTime: string,
  evts: TxEvent[],
  result: TxResult,
  gasUsed: number
): Promise<void> {
  // Initial values from Cosmos events
  let fromAddr = (attr(evts, 'message', 'sender') || '').toLowerCase();
  let toAddr: string | null = (attr(evts, 'ethereum_tx', 'recipient') || '').toLowerCase() || null;
  let value    = '0';
  let gasPrice = '0';
  let gasLimit = gasUsed;
  let nonce    = 0;
  let input    = '';

  // Enrich with EVM JSON-RPC details when available
  if (EVM_RPC_URL) {
    try {
      const r = await fetch(EVM_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method: 'eth_getTransactionByHash',
          params: [evmHash],
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const j = await r.json() as {
        result?: {
          from: string; to: string | null; value: string;
          gasPrice: string; gas: string; nonce: string; input: string;
        };
      };
      if (j.result) {
        const t = j.result;
        fromAddr = (t.from  ?? fromAddr).toLowerCase();
        toAddr   = t.to ? t.to.toLowerCase() : null;
        value    = String(parseInt(t.value    ?? '0x0', 16));
        gasPrice = String(parseInt(t.gasPrice ?? '0x0', 16));
        gasLimit = parseInt(t.gas   ?? '0x0', 16);
        nonce    = parseInt(t.nonce ?? '0x0', 16);
        input    = t.input ?? '';
      }
    } catch (err) {
      console.warn(`[evm] RPC enrichment failed for ${evmHash}:`, err instanceof Error ? err.message : String(err));
    }
  }

  const contractAddr = !toAddr
    ? (attr(evts, 'ethereum_tx', 'contractAddress') || null)
    : null;

  await client.query(
    `INSERT INTO evm_transactions
       (hash, cosmos_tx_hash, block_height, tx_index,
        from_address, to_address, value, gas_price, gas_limit, gas_used,
        nonce, input_data, contract_address, status, timestamp)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (hash) DO NOTHING`,
    [
      evmHash, cosmosTxHash, height, txIndex,
      fromAddr, toAddr,
      value, gasPrice, gasLimit, gasUsed,
      nonce, input.substring(0, 4096),
      contractAddr,
      result.code === 0,
      blockTime,
    ]
  );

  // Track contract deployments
  if (contractAddr && fromAddr) {
    await client.query(
      `INSERT INTO contracts (address, creator, creation_tx, creation_block)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (address) DO NOTHING`,
      [contractAddr, fromAddr, evmHash, height]
    );
  }
}

// ─── Account Upsert ───────────────────────────────────────────────────────────

async function upsertAccount(client: DbClient, address: string, height: number): Promise<void> {
  if (!address || address.length < 5) return;
  await client.query(
    `INSERT INTO accounts (address, first_seen_block, last_seen_block, updated_at)
     VALUES ($1, $2, $2, NOW())
     ON CONFLICT (address) DO UPDATE SET
       last_seen_block = GREATEST(accounts.last_seen_block, EXCLUDED.last_seen_block),
       updated_at = NOW()`,
    [address, height]
  );
}

// ─── Validator Refresh ────────────────────────────────────────────────────────

async function refreshValidators(): Promise<void> {
  try {
    const r = await fetch(
      `${LCD_URL}/cosmos/staking/v1beta1/validators?pagination.limit=100&status=BOND_STATUS_BONDED`,
      { signal: AbortSignal.timeout(15_000) }
    );
    if (!r.ok) { console.warn(`[validators] LCD ${r.status}`); return; }

    const data = await r.json() as {
      validators?: Array<{
        operator_address: string;
        consensus_pubkey: unknown;
        description: { moniker: string; identity: string; website: string; security_contact: string; details: string };
        commission: { commission_rates: { rate: string; max_rate: string; max_change_rate: string } };
        min_self_delegation: string;
        tokens: string;
        delegator_shares: string;
        status: string;
        jailed: boolean;
      }>;
    };

    const statusCode: Record<string, number> = {
      BOND_STATUS_BONDED: 3,
      BOND_STATUS_UNBONDING: 2,
      BOND_STATUS_UNBONDED: 1,
    };

    for (const v of data.validators ?? []) {
      const d = v.description ?? {};
      const c = v.commission?.commission_rates ?? {};
      await pool.query(
        `INSERT INTO validators
           (operator_address, consensus_pubkey, moniker, identity, website,
            security_contact, details, commission_rate, commission_max_rate,
            commission_max_change, min_self_delegation, tokens, delegator_shares,
            status, jailed, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
         ON CONFLICT (operator_address) DO UPDATE SET
           tokens            = EXCLUDED.tokens,
           delegator_shares  = EXCLUDED.delegator_shares,
           status            = EXCLUDED.status,
           jailed            = EXCLUDED.jailed,
           moniker           = EXCLUDED.moniker,
           commission_rate   = EXCLUDED.commission_rate,
           updated_at        = NOW()`,
        [
          v.operator_address,
          JSON.stringify(v.consensus_pubkey),
          d.moniker ?? '', d.identity ?? '', d.website ?? '',
          d.security_contact ?? '', d.details ?? '',
          c.rate ?? '0', c.max_rate ?? '0', c.max_change_rate ?? '0',
          v.min_self_delegation ?? '0',
          v.tokens ?? '0', v.delegator_shares ?? '0',
          statusCode[v.status] ?? 1,
          v.jailed ?? false,
        ]
      );
    }
    console.log(`[validators] Refreshed ${data.validators?.length ?? 0} bonded validators`);
  } catch (err) {
    console.warn('[validators]', err instanceof Error ? err.message : String(err));
  }
}

// ─── Network Stats ────────────────────────────────────────────────────────────

async function recordNetworkStats(): Promise<void> {
  try {
    const [tx, acc, ct] = await Promise.all([
      pool.query<{ count: string }>('SELECT COUNT(*) count FROM transactions'),
      pool.query<{ count: string }>('SELECT COUNT(*) count FROM accounts'),
      pool.query<{ count: string }>('SELECT COUNT(*) count FROM contracts'),
    ]);
    await pool.query(
      `INSERT INTO network_stats (total_transactions, total_accounts, total_contracts)
       VALUES ($1, $2, $3)`,
      [parseInt(tx.rows[0].count), parseInt(acc.rows[0].count), parseInt(ct.rows[0].count)]
    );
  } catch (err) {
    console.warn('[stats]', err instanceof Error ? err.message : String(err));
  }
}

// ─── Main Loop ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`[indexer] RPC=${RPC_URL}  LCD=${LCD_URL}  EVM_RPC=${EVM_RPC_URL ?? '(disabled)'}  START=${START_BLOCK}  BATCH=${BATCH_SIZE}`);

  // Wait for PostgreSQL
  for (let i = 1; i <= 15; i++) {
    try { await pool.query('SELECT 1'); console.log('[indexer] DB connected'); break; }
    catch { console.log(`[indexer] Waiting for DB (${i}/15)…`); await new Promise(r => setTimeout(r, 3000)); }
  }

  // Health endpoint
  const app = express();
  app.get('/health', (_, res) =>
    res.json({ status: 'healthy', service: 'lithosphere-indexer', timestamp: new Date().toISOString() })
  );
  app.listen(process.env.INDEXER_PORT ?? 3001, () => console.log('[indexer] Health: :3001'));

  // Metrics endpoint
  const metricsApp = express();
  metricsApp.get('/metrics', async (_, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });
  metricsApp.listen(process.env.METRICS_PORT ?? 9090, () => console.log('[indexer] Metrics: :9090'));

  // Log database schema for diagnostics
  try {
    const tables = ['blocks', 'transactions', 'evm_transactions', 'accounts', 'indexer_state'];
    for (const t of tables) {
      const cols = await pool.query(
        `SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
        [t]
      );
      if (cols.rows.length > 0) {
        console.log(`[schema] ${t}: ${cols.rows.map((c: Record<string, unknown>) => `${c.column_name}(${c.data_type}${c.character_maximum_length ? ':' + c.character_maximum_length : ''})`).join(', ')}`);
      } else {
        console.warn(`[schema] Table '${t}' NOT FOUND in database`);
      }
    }
  } catch (err) {
    console.warn('[schema] Could not inspect schema:', err instanceof Error ? err.message : String(err));
  }

  // Ensure indexer_state table exists (RDS may have been created by another indexer)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS indexer_state (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  await pool.query(`
    INSERT INTO indexer_state (key, value) VALUES ('last_indexed_block', '0')
    ON CONFLICT (key) DO NOTHING
  `);

  // Force re-index: reset indexer_state so we re-process all blocks from START_BLOCK.
  // This is needed when another indexer (e.g. EVM-only) populated blocks with num_txs=0
  // and our CometBFT indexer needs to find the actual transactions.
  if (process.env.FORCE_REINDEX === '1' || process.env.FORCE_REINDEX === 'true') {
    console.log('[indexer] FORCE_REINDEX=1 — resetting last_indexed_block to 0');
    await pool.query(`
      INSERT INTO indexer_state (key, value, updated_at) VALUES ('last_indexed_block', '0', NOW())
      ON CONFLICT (key) DO UPDATE SET value = '0', updated_at = NOW()
    `);
  }

  // Auto-backfill EVM data: if there are Cosmos txs but no EVM txs, re-index to populate evm_transactions
  try {
    const txCount = await pool.query('SELECT COUNT(*) AS count FROM transactions');
    const evmCount = await pool.query('SELECT COUNT(*) AS count FROM evm_transactions');
    const txTotal = parseInt(txCount.rows[0]?.count ?? '0');
    const evmTotal = parseInt(evmCount.rows[0]?.count ?? '0');
    if (txTotal > 0 && evmTotal === 0) {
      console.log(`[indexer] EVM backfill needed: ${txTotal} cosmos txs but 0 evm txs — resetting to re-index`);
      await pool.query(`
        INSERT INTO indexer_state (key, value, updated_at) VALUES ('last_indexed_block', '0', NOW())
        ON CONFLICT (key) DO UPDATE SET value = '0', updated_at = NOW()
      `);
    }
  } catch (err) {
    console.warn('[indexer] EVM backfill check failed:', err instanceof Error ? err.message : String(err));
  }

  // Initial validator load
  await refreshValidators();

  let lastValidatorRefresh = Date.now();
  let lastStatsRefresh     = Date.now();

  while (true) {
    try {
      const status = await rpcGet<{ sync_info: { latest_block_height: string } }>('/status');
      const chainTip = parseInt(status.sync_info.latest_block_height);
      gChain.set(chainTip);

      let from = await getLastIndexedBlock();
      if (from < START_BLOCK - 1) from = START_BLOCK - 1;
      const to = Math.min(from + BATCH_SIZE, chainTip);

      if (from >= chainTip) {
        // Fully caught up — wait for next block
        await new Promise(r => setTimeout(r, POLL_MS));
        continue;
      }

      const lag = chainTip - from;
      console.log(`[indexer] Syncing ${from + 1}→${to}  (${lag} blocks behind)`);

      for (let h = from + 1; h <= to; h++) {
        await indexBlock(h);
        await setLastIndexedBlock(h);
      }

      // Periodic maintenance
      if (Date.now() - lastValidatorRefresh > 600_000) {
        await refreshValidators();
        lastValidatorRefresh = Date.now();
      }
      if (Date.now() - lastStatsRefresh > 300_000) {
        await recordNetworkStats();
        lastStatsRefresh = Date.now();
      }

      // Back off only when caught up; aggressively sync when behind
      const delay = to >= chainTip ? POLL_MS : CATCHUP_DELAY_MS;
      await new Promise(r => setTimeout(r, delay));

    } catch (err) {
      console.error('[indexer] Error:', err instanceof Error ? err.message : String(err));
      await new Promise(r => setTimeout(r, 10_000));
    }
  }
}

main().catch((err) => {
  console.error('[indexer] Fatal:', err);
  process.exit(1);
});
