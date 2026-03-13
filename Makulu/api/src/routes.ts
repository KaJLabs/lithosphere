/**
 * REST API routes consumed by the Explorer frontend.
 *
 * The explorer calls /api/* paths (e.g. /api/blocks, /api/stats/summary).
 * These routes query the same PostgreSQL database that the indexer writes to.
 */
import { Router, type Request, type Response } from 'express';
import { query } from './db.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function clamp(val: unknown, def = DEFAULT_LIMIT): number {
  const n = Number(val);
  if (!n || n < 1) return def;
  return Math.min(n, MAX_LIMIT);
}

// ── Row types (mirror DB columns) ───────────────────────────────────────────

interface BlockRow {
  height: string;
  hash: string;
  proposer_address: string | null;
  num_txs: number;
  total_gas: string;
  block_time: Date;
}

interface TxRow {
  hash: string;
  block_height: string;
  tx_index: number | null;
  tx_type: string | null;
  sender: string | null;
  receiver: string | null;
  amount: string | null;
  denom: string | null;
  gas_used: string | null;
  gas_wanted: string | null;
  fee: string | null;
  fee_denom: string | null;
  success: boolean;
  memo: string | null;
  raw_log: string | null;
  timestamp: Date;
}

interface AccountRow {
  address: string;
  evm_address: string | null;
  balance: string;
  tx_count: string;
  last_seen_block: string | null;
  updated_at: Date;
}

interface ValidatorRow {
  operator_address: string;
  moniker: string | null;
  tokens: string;
  commission_rate: string | null;
  status: number;
  jailed: boolean;
}

interface CountRow { count: string }

// ── Mappers → Explorer-expected shapes ──────────────────────────────────────

function mapBlock(r: BlockRow) {
  return {
    height: Number(r.height),
    hash: r.hash,
    timestamp: r.block_time instanceof Date ? r.block_time.toISOString() : String(r.block_time),
    txCount: r.num_txs ?? 0,
  };
}

function mapBlockDetail(r: BlockRow, txs: TxRow[]) {
  return {
    ...mapBlock(r),
    parentHash: null,
    txs: txs.map(mapTx),
  };
}

function mapTx(r: TxRow) {
  return {
    hash: r.hash,
    blockHeight: Number(r.block_height),
    fromAddr: r.sender ?? '',
    toAddr: r.receiver ?? '',
    value: r.amount ?? '0',
    denom: r.denom ?? 'ulitho',
    feePaid: r.fee ?? '0',
    gasUsed: r.gas_used ?? null,
    gasWanted: r.gas_wanted ?? null,
    success: r.success,
    method: r.tx_type ?? undefined,
    memo: r.memo ?? undefined,
    timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
  };
}

function mapAddress(r: AccountRow) {
  return {
    address: r.address,
    balance: r.balance ?? '0',
    txCount: Number(r.tx_count ?? 0),
    lastSeen: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

const STATUS_LABELS: Record<number, string> = { 1: 'Unbonded', 2: 'Unbonding', 3: 'Bonded' };

function mapValidator(r: ValidatorRow) {
  return {
    address: r.operator_address,
    moniker: r.moniker ?? r.operator_address.slice(0, 16) + '...',
    votingPower: r.tokens ?? '0',
    commission: r.commission_rate ?? '0',
    status: STATUS_LABELS[r.status] ?? 'Unknown',
  };
}

// ── Router ──────────────────────────────────────────────────────────────────

export function explorerRouter(): Router {
  const r = Router();

  // ── Stats summary (homepage) ────────────────────────────────────────────

  r.get('/stats/summary', async (_req: Request, res: Response) => {
    try {
      const [blockRow, tx1m, tx5m] = await Promise.all([
        query<{ height: string }>('SELECT height FROM blocks ORDER BY height DESC LIMIT 1'),
        query<CountRow>(
          `SELECT COUNT(*) AS count FROM transactions
           WHERE timestamp > NOW() - INTERVAL '1 minute'`
        ),
        query<CountRow>(
          `SELECT COUNT(*) AS count FROM transactions
           WHERE timestamp > NOW() - INTERVAL '5 minutes'`
        ),
      ]);
      const tipHeight = blockRow[0] ? Number(blockRow[0].height) : 0;
      const txs1m = parseInt(tx1m[0]?.count ?? '0');
      const txs5m = parseInt(tx5m[0]?.count ?? '0');
      res.json({
        tipHeight,
        tps1m: Math.round((txs1m / 60) * 100) / 100,
        tps5m: Math.round((txs5m / 300) * 100) / 100,
      });
    } catch (err) {
      console.error('[api] /stats/summary error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── Config (token info) ─────────────────────────────────────────────────

  r.get('/config', (_req: Request, res: Response) => {
    res.json({
      token: { symbol: 'LITHO', decimals: 18 },
      fiat: { symbol: 'USD', price: null, fetchedAt: null },
    });
  });

  // ── Blocks ──────────────────────────────────────────────────────────────

  r.get('/blocks', async (req: Request, res: Response) => {
    try {
      const limit = clamp(req.query.limit);
      const rows = await query<BlockRow>(
        'SELECT * FROM blocks ORDER BY height DESC LIMIT $1',
        [limit]
      );
      res.json(rows.map(mapBlock));
    } catch (err) {
      console.error('[api] /blocks error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  r.get('/blocks/:height', async (req: Request, res: Response) => {
    try {
      const { height } = req.params;
      const blocks = await query<BlockRow>(
        'SELECT * FROM blocks WHERE height = $1',
        [height]
      );
      if (!blocks[0]) {
        res.status(404).json({ message: 'Block not found' });
        return;
      }
      const txs = await query<TxRow>(
        'SELECT * FROM transactions WHERE block_height = $1 ORDER BY tx_index ASC',
        [height]
      );
      res.json(mapBlockDetail(blocks[0], txs));
    } catch (err) {
      console.error('[api] /blocks/:height error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── Transactions ────────────────────────────────────────────────────────

  r.get('/txs', async (req: Request, res: Response) => {
    try {
      const limit = clamp(req.query.limit);
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const [rows, countResult] = await Promise.all([
        query<TxRow>(
          'SELECT * FROM transactions ORDER BY timestamp DESC, block_height DESC LIMIT $1 OFFSET $2',
          [limit, offset]
        ),
        query<CountRow>('SELECT COUNT(*) AS count FROM transactions'),
      ]);
      res.json({
        txs: rows.map(mapTx),
        total: parseInt(countResult[0]?.count ?? '0'),
        limit,
        offset,
      });
    } catch (err) {
      console.error('[api] /txs error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  r.get('/txs/:hash', async (req: Request, res: Response) => {
    try {
      const { hash } = req.params;
      const rows = await query<TxRow>(
        'SELECT * FROM transactions WHERE hash = $1',
        [hash.toUpperCase()]
      );
      if (!rows[0]) {
        // Try case-insensitive / lowercase
        const rows2 = await query<TxRow>(
          'SELECT * FROM transactions WHERE LOWER(hash) = LOWER($1)',
          [hash]
        );
        if (!rows2[0]) {
          res.status(404).json({ message: 'Transaction not found' });
          return;
        }
        res.json(mapTx(rows2[0]));
        return;
      }
      res.json(mapTx(rows[0]));
    } catch (err) {
      console.error('[api] /txs/:hash error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── Address ─────────────────────────────────────────────────────────────

  r.get('/address/:address', async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      const rows = await query<AccountRow>(
        'SELECT * FROM accounts WHERE address = $1 OR evm_address = $1',
        [address]
      );
      if (!rows[0]) {
        res.status(404).json({ message: 'Account not found' });
        return;
      }
      res.json(mapAddress(rows[0]));
    } catch (err) {
      console.error('[api] /address/:address error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  r.get('/address/:address/txs', async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      const limit = clamp(req.query.limit, 25);
      const rows = await query<TxRow>(
        `SELECT * FROM transactions
         WHERE sender = $1 OR receiver = $1
         ORDER BY timestamp DESC LIMIT $2`,
        [address, limit]
      );
      res.json(rows.map(mapTx));
    } catch (err) {
      console.error('[api] /address/:address/txs error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── Validators ──────────────────────────────────────────────────────────

  r.get('/validators', async (_req: Request, res: Response) => {
    try {
      const rows = await query<ValidatorRow>(
        'SELECT * FROM validators ORDER BY tokens DESC LIMIT 100'
      );
      res.json(rows.map(mapValidator));
    } catch (err) {
      console.error('[api] /validators error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return r;
}
