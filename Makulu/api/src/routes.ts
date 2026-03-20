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

interface EvmTxRow {
  hash: string;
  cosmos_tx_hash: string;
  block_height: string;
  tx_index: number | null;
  from_address: string | null;
  to_address: string | null;
  value: string | null;
  gas_price: string | null;
  gas_limit: number | null;
  gas_used: number | null;
  nonce: number | null;
  input_data: string | null;
  contract_address: string | null;
  status: boolean;
  timestamp: Date;
}

interface CountRow { count: string }

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Strip Ethereum branding from Cosmos SDK method names */
function cleanMethod(m: string | null | undefined): string | undefined {
  if (!m) return undefined;
  return m.replace(/MsgEthereumTx/g, 'MsgTx');
}

// ── Mappers → Explorer-expected shapes ──────────────────────────────────────

function mapBlock(r: BlockRow) {
  return {
    height: Number(r.height),
    hash: r.hash,
    timestamp: r.block_time instanceof Date ? r.block_time.toISOString() : String(r.block_time),
    txCount: r.num_txs ?? 0,
    gasUsed: r.total_gas ?? '0',
  };
}

function mapBlockDetail(r: BlockRow, txs: Array<TxRow & { evm_hash?: string | null }>) {
  return {
    ...mapBlock(r),
    parentHash: null,
    proposerAddress: r.proposer_address ?? null,
    gasUsed: r.total_gas ?? '0',
    txs: txs.map((t) => mapTx(t, t.evm_hash)),
  };
}

function mapTx(r: TxRow, evmHash?: string | null) {
  return {
    hash: r.hash,
    evmHash: evmHash ?? undefined,
    blockHeight: Number(r.block_height),
    fromAddr: r.sender ?? '',
    toAddr: r.receiver ?? '',
    value: r.amount ?? '0',
    denom: r.denom ?? 'ulitho',
    feePaid: r.fee ?? '0',
    gasUsed: r.gas_used ?? null,
    gasWanted: r.gas_wanted ?? null,
    success: r.success,
    method: cleanMethod(r.tx_type),
    memo: r.memo ?? undefined,
    timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
    rawLog: r.raw_log ?? undefined,
  };
}

function mapEvmTx(evm: EvmTxRow, cosmosTx?: TxRow) {
  return {
    hash: cosmosTx?.hash ?? evm.cosmos_tx_hash,
    evmHash: evm.hash,
    blockHeight: Number(evm.block_height),
    fromAddr: evm.from_address ?? cosmosTx?.sender ?? '',
    toAddr: evm.to_address ?? cosmosTx?.receiver ?? '',
    value: evm.value ?? cosmosTx?.amount ?? '0',
    denom: cosmosTx?.denom ?? 'ulitho',
    feePaid: cosmosTx?.fee ?? '0',
    gasUsed: evm.gas_used != null ? String(evm.gas_used) : cosmosTx?.gas_used ?? null,
    gasWanted: evm.gas_limit != null ? String(evm.gas_limit) : cosmosTx?.gas_wanted ?? null,
    success: evm.status,
    method: cleanMethod(cosmosTx?.tx_type) ?? 'MsgTx',
    memo: cosmosTx?.memo ?? undefined,
    timestamp: evm.timestamp instanceof Date ? evm.timestamp.toISOString() : String(evm.timestamp),
    contractAddress: evm.contract_address ?? undefined,
    nonce: evm.nonce ?? undefined,
    gasPrice: evm.gas_price ?? undefined,
    inputData: evm.input_data ?? undefined,
  };
}

function mapAddress(r: AccountRow, queriedAddr?: string) {
  // If user queried by EVM address, show that as primary
  const isEvmQuery = queriedAddr?.startsWith('0x');
  const evmAddr = r.evm_address ?? (r.address.startsWith('0x') ? r.address : undefined);
  return {
    address: isEvmQuery && evmAddr ? evmAddr : r.address,
    evmAddress: evmAddr ?? undefined,
    cosmosAddress: r.address.startsWith('litho') ? r.address : undefined,
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
      const [blockRow, tx1m, tx5m, totalTxs, walletCount, avgBlockTime] = await Promise.all([
        query<{ height: string }>('SELECT height FROM blocks ORDER BY height DESC LIMIT 1'),
        query<CountRow>(
          `SELECT COUNT(*) AS count FROM transactions
           WHERE timestamp > NOW() - INTERVAL '1 minute'`
        ),
        query<CountRow>(
          `SELECT COUNT(*) AS count FROM transactions
           WHERE timestamp > NOW() - INTERVAL '5 minutes'`
        ),
        query<CountRow>('SELECT COUNT(*) AS count FROM transactions'),
        query<CountRow>('SELECT COUNT(*) AS count FROM accounts'),
        query<{ avg_seconds: string }>(
          `SELECT COALESCE(EXTRACT(EPOCH FROM AVG(diff)), 0) AS avg_seconds FROM (
             SELECT block_time - LAG(block_time) OVER (ORDER BY height) AS diff
             FROM blocks ORDER BY height DESC LIMIT 100
           ) sub WHERE diff IS NOT NULL`
        ).catch(() => [{ avg_seconds: '0' }]),
      ]);
      const tipHeight = blockRow[0] ? Number(blockRow[0].height) : 0;
      const txs1m = parseInt(tx1m[0]?.count ?? '0');
      const txs5m = parseInt(tx5m[0]?.count ?? '0');
      res.json({
        tipHeight,
        tps1m: Math.round((txs1m / 60) * 100) / 100,
        tps5m: Math.round((txs5m / 300) * 100) / 100,
        totalTransactions: parseInt(totalTxs[0]?.count ?? '0'),
        walletAddresses: parseInt(walletCount[0]?.count ?? '0'),
        avgBlockTime: Math.round(parseFloat(avgBlockTime[0]?.avg_seconds ?? '0') * 10) / 10,
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
      const txs = await query<TxRow & { evm_hash: string | null }>(
        `SELECT t.*, e.hash AS evm_hash
         FROM transactions t
         LEFT JOIN evm_transactions e ON e.cosmos_tx_hash = t.hash
         WHERE t.block_height = $1
         ORDER BY t.tx_index ASC`,
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
        query<TxRow & { evm_hash: string | null }>(
          `SELECT t.*, e.hash AS evm_hash
           FROM transactions t
           LEFT JOIN evm_transactions e ON e.cosmos_tx_hash = t.hash
           ORDER BY t.timestamp DESC, t.block_height DESC
           LIMIT $1 OFFSET $2`,
          [limit, offset]
        ),
        query<CountRow>('SELECT COUNT(*) AS count FROM transactions'),
      ]);
      res.json({
        txs: rows.map((r) => mapTx(r, r.evm_hash)),
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

      // 1. Try exact match in transactions table (Cosmos SHA256 hash)
      const rows = await query<TxRow & { evm_hash: string | null }>(
        `SELECT t.*, e.hash AS evm_hash
         FROM transactions t
         LEFT JOIN evm_transactions e ON e.cosmos_tx_hash = t.hash
         WHERE t.hash = $1`,
        [hash.toUpperCase()]
      );
      if (rows[0]) {
        res.json(mapTx(rows[0], rows[0].evm_hash));
        return;
      }

      // 2. Try case-insensitive match in transactions
      const rows2 = await query<TxRow & { evm_hash: string | null }>(
        `SELECT t.*, e.hash AS evm_hash
         FROM transactions t
         LEFT JOIN evm_transactions e ON e.cosmos_tx_hash = t.hash
         WHERE LOWER(t.hash) = LOWER($1)`,
        [hash]
      );
      if (rows2[0]) {
        res.json(mapTx(rows2[0], rows2[0].evm_hash));
        return;
      }

      // 3. Try EVM tx hash lookup (0x-prefixed hashes)
      const evmRows = await query<EvmTxRow>(
        'SELECT * FROM evm_transactions WHERE LOWER(hash) = LOWER($1)',
        [hash]
      );
      if (evmRows[0]) {
        // Get the linked Cosmos tx for full details
        const cosmosTx = await query<TxRow>(
          'SELECT * FROM transactions WHERE hash = $1',
          [evmRows[0].cosmos_tx_hash]
        );
        res.json(mapEvmTx(evmRows[0], cosmosTx[0]));
        return;
      }

      res.status(404).json({ message: 'Transaction not found' });
    } catch (err) {
      console.error('[api] /txs/:hash error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── Address ─────────────────────────────────────────────────────────────

  r.get('/address/:address', async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      const addrLower = address.toLowerCase();

      // 1. Try accounts table (both cosmos and evm address columns)
      const rows = await query<AccountRow>(
        'SELECT * FROM accounts WHERE address = $1 OR evm_address = $1 OR LOWER(address) = $2 OR LOWER(evm_address) = $2',
        [address, addrLower]
      );
      if (rows[0]) {
        // Check if this address is a token contract
        const tokenInfo = await query<{
          name: string | null; symbol: string | null; decimals: number | null;
          total_supply: string | null; contract_type: string | null;
        }>(
          'SELECT name, symbol, decimals, total_supply, contract_type FROM contracts WHERE LOWER(address) = $1',
          [addrLower]
        ).catch(() => []);

        const result: Record<string, unknown> = mapAddress(rows[0], address);
        if (tokenInfo[0]) {
          result.isContract = true;
          result.isToken = !!(tokenInfo[0].symbol || tokenInfo[0].contract_type === 'token');
          result.tokenName = tokenInfo[0].name;
          result.tokenSymbol = tokenInfo[0].symbol;
          result.tokenDecimals = tokenInfo[0].decimals;
          result.totalSupply = tokenInfo[0].total_supply;
        }
        res.json(result);
        return;
      }

      // 2. Check if it's a known contract address
      const contractRows = await query<{
        address: string; name: string | null; symbol: string | null;
        decimals: number | null; total_supply: string | null; contract_type: string | null;
      }>(
        'SELECT address, name, symbol, decimals, total_supply, contract_type FROM contracts WHERE LOWER(address) = $1',
        [addrLower]
      ).catch(() => []);

      if (contractRows[0]) {
        const c = contractRows[0];
        res.json({
          address: c.address,
          balance: '0',
          txCount: 0,
          lastSeen: new Date().toISOString(),
          isContract: true,
          isToken: !!(c.symbol || c.contract_type === 'token'),
          tokenName: c.name,
          tokenSymbol: c.symbol,
          tokenDecimals: c.decimals,
          totalSupply: c.total_supply,
        });
        return;
      }

      // 3. Build synthetic account from transactions (EVM addresses not yet in accounts table)
      const txCount = await query<CountRow>(
        `SELECT COUNT(*) AS count FROM (
           SELECT hash FROM transactions WHERE LOWER(sender) = $1 OR LOWER(receiver) = $1
           UNION
           SELECT cosmos_tx_hash FROM evm_transactions WHERE LOWER(from_address) = $1 OR LOWER(to_address) = $1
         ) combined`,
        [addrLower]
      );

      const count = parseInt(txCount[0]?.count ?? '0');
      if (count > 0) {
        const lastTx = await query<{ timestamp: Date }>(
          `SELECT timestamp FROM transactions
           WHERE LOWER(sender) = $1 OR LOWER(receiver) = $1
           ORDER BY timestamp DESC LIMIT 1`,
          [addrLower]
        );
        res.json({
          address,
          balance: '0',
          txCount: count,
          lastSeen: lastTx[0]?.timestamp instanceof Date ? lastTx[0].timestamp.toISOString() : new Date().toISOString(),
        });
        return;
      }

      res.status(404).json({ message: 'Account not found' });
    } catch (err) {
      console.error('[api] /address/:address error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  r.get('/address/:address/txs', async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      const limit = clamp(req.query.limit, 25);
      const addrLower = address.toLowerCase();

      // Resolve linked addresses: if querying by 0x, also search by litho1... and vice versa
      const linkedAddrs = await query<AccountRow>(
        'SELECT * FROM accounts WHERE address = $1 OR evm_address = $1 OR LOWER(address) = $2 OR LOWER(evm_address) = $2',
        [address, addrLower]
      ).catch(() => []);
      const cosmosAddr = linkedAddrs[0]?.address?.toLowerCase() ?? null;
      const evmAddr = linkedAddrs[0]?.evm_address?.toLowerCase() ?? null;

      // Build array of all address forms to search
      const searchAddrs = new Set([addrLower]);
      if (cosmosAddr) searchAddrs.add(cosmosAddr);
      if (evmAddr) searchAddrs.add(evmAddr);
      const addrs = [...searchAddrs];

      // Search both Cosmos transactions (sender/receiver) and EVM transactions (from/to)
      const rows = await query<TxRow & { evm_hash: string | null }>(
        `SELECT DISTINCT ON (t.hash) t.*, e.hash AS evm_hash
         FROM transactions t
         LEFT JOIN evm_transactions e ON e.cosmos_tx_hash = t.hash
         WHERE LOWER(t.sender) = ANY($1) OR LOWER(t.receiver) = ANY($1)
            OR LOWER(e.from_address) = ANY($1) OR LOWER(e.to_address) = ANY($1)
         ORDER BY t.hash, t.timestamp DESC
         LIMIT $2`,
        [addrs, limit]
      );
      res.json(rows.map((r) => mapTx(r, r.evm_hash)));
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

  // ── Tokens ─────────────────────────────────────────────────────────

  r.get('/tokens', async (_req: Request, res: Response) => {
    try {
      // Query contracts table for deployed tokens, fall back to known tokens
      const contractTokens = await query<{
        address: string;
        name: string | null;
        symbol: string | null;
        decimals: number | null;
        total_supply: string | null;
        creator: string | null;
        created_at: Date;
      }>(
        `SELECT address, name, symbol, decimals, total_supply, creator, created_at
         FROM contracts WHERE contract_type = 'token' OR symbol IS NOT NULL ORDER BY created_at DESC LIMIT 100`
      ).catch(() => []);

      // Get holder count for native LITHO
      const holderCount = await query<CountRow>(
        'SELECT COUNT(*) AS count FROM accounts WHERE balance != \'0\''
      ).catch(() => [{ count: '0' }]);

      const tokens = [
        {
          symbol: 'LITHO',
          name: 'Lithosphere',
          decimals: 18,
          totalSupply: '1000000000',
          type: 'native',
          holders: parseInt(holderCount[0]?.count ?? '0'),
          contractAddress: null,
        },
        ...contractTokens.map((c) => ({
          symbol: c.symbol ?? 'Unknown',
          name: c.name ?? 'Unknown Token',
          decimals: c.decimals ?? 18,
          totalSupply: c.total_supply,
          type: 'LEP100' as const,
          holders: null,
          contractAddress: c.address,
        })),
      ];

      res.json(tokens);
    } catch (err) {
      console.error('[api] /tokens error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── Token detail by contract address ─────────────────────────────────

  r.get('/tokens/:address', async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      const addrLower = address.toLowerCase();

      const rows = await query<{
        address: string; name: string | null; symbol: string | null;
        decimals: number | null; total_supply: string | null;
        contract_type: string | null; creator: string | null; created_at: Date;
      }>(
        `SELECT address, name, symbol, decimals, total_supply, contract_type, creator, created_at
         FROM contracts WHERE LOWER(address) = $1`,
        [addrLower]
      );

      if (!rows[0]) {
        res.status(404).json({ message: 'Token contract not found' });
        return;
      }

      const c = rows[0];

      // Get holder count and transfer count
      const [holderCount, transferCount] = await Promise.all([
        query<CountRow>(
          `SELECT COUNT(*) AS count FROM (
             SELECT DISTINCT sender AS addr FROM transactions WHERE LOWER(receiver) = $1
             UNION
             SELECT DISTINCT receiver AS addr FROM transactions WHERE LOWER(sender) = $1
           ) holders`,
          [addrLower]
        ).catch(() => [{ count: '0' }]),
        query<CountRow>(
          `SELECT COUNT(*) AS count FROM transactions WHERE LOWER(sender) = $1 OR LOWER(receiver) = $1`,
          [addrLower]
        ).catch(() => [{ count: '0' }]),
      ]);

      res.json({
        address: c.address,
        name: c.name ?? 'Unknown Token',
        symbol: c.symbol ?? 'Unknown',
        decimals: c.decimals ?? 18,
        totalSupply: c.total_supply,
        type: (c.symbol || c.contract_type === 'token') ? 'LEP100' : 'contract',
        creator: c.creator,
        createdAt: c.created_at instanceof Date ? c.created_at.toISOString() : String(c.created_at),
        holders: parseInt(holderCount[0]?.count ?? '0'),
        transfers: parseInt(transferCount[0]?.count ?? '0'),
      });
    } catch (err) {
      console.error('[api] /tokens/:address error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── Debug / Diagnostics ─────────────────────────────────────────────

  r.get('/debug', async (_req: Request, res: Response) => {
    try {
      const [
        indexerState,
        blockCount,
        txCount,
        evmTxCount,
        minBlock,
        maxBlock,
        sampleBlock,
        tableColumns,
      ] = await Promise.all([
        query<{ key: string; value: string }>('SELECT * FROM indexer_state').catch(() => []),
        query<CountRow>('SELECT COUNT(*) AS count FROM blocks').catch(() => [{ count: '?' }]),
        query<CountRow>('SELECT COUNT(*) AS count FROM transactions').catch(() => [{ count: '?' }]),
        query<CountRow>('SELECT COUNT(*) AS count FROM evm_transactions').catch(() => [{ count: '?' }]),
        query<{ height: string }>('SELECT MIN(height) AS height FROM blocks').catch(() => []),
        query<{ height: string }>('SELECT MAX(height) AS height FROM blocks').catch(() => []),
        query<Record<string, unknown>>('SELECT * FROM blocks ORDER BY height ASC LIMIT 1').catch(() => []),
        query<{ column_name: string; data_type: string; character_maximum_length: number | null }>(
          `SELECT column_name, data_type, character_maximum_length
           FROM information_schema.columns WHERE table_name = 'blocks' ORDER BY ordinal_position`
        ).catch(() => []),
      ]);

      res.json({
        indexerState,
        counts: {
          blocks: blockCount[0]?.count,
          transactions: txCount[0]?.count,
          evmTransactions: evmTxCount[0]?.count,
        },
        blockRange: {
          min: minBlock[0]?.height,
          max: maxBlock[0]?.height,
        },
        sampleBlock: sampleBlock[0] ?? null,
        blocksSchema: tableColumns,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── Faucet proxy (forwards to faucet service on :8081) ─────────────

  r.post('/faucet/claim', async (req: Request, res: Response) => {
    try {
      const { address, amount } = req.body ?? {};

      if (!address) {
        res.status(400).json({ ok: false, message: 'Wallet address is required.' });
        return;
      }

      const faucetUrl = process.env.FAUCET_INTERNAL_URL || 'http://faucet:8081';
      const upstream = await fetch(`${faucetUrl}/drip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, amount }),
      });

      const data = await upstream.json() as Record<string, unknown>;

      if (!upstream.ok) {
        res.status(upstream.status).json({
          ok: false,
          message: (data.message as string) || 'Faucet request failed.',
          cooldownSeconds: data.retryAfterSeconds ?? null,
        });
        return;
      }

      res.json({
        ok: true,
        txHash: data.txHash ?? null,
        message: `Sent ${data.amount ?? amount} to ${address}`,
        cooldownSeconds: ((data.cooldownHours as number) ?? 24) * 3600,
      });
    } catch (err) {
      console.error('[api] /faucet/claim error:', err);
      res.status(502).json({
        ok: false,
        message: 'Faucet service is unavailable. Please try again later.',
      });
    }
  });

  return r;
}
