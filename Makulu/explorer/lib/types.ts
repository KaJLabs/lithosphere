// ── REST API response types (Fastify API on port 8080) ──────────────

export interface StatsSummary {
  tipHeight: number;
  tps1m: number;
  tps5m: number;
}

export interface TokenConfig {
  token: { symbol: string; decimals: number };
  fiat: { symbol: string; price: number | null; fetchedAt: string | null };
}

export interface ApiBlock {
  height: number;
  hash: string;
  parentHash?: string;
  timestamp: string;
  txCount: number;
  txs?: ApiTx[];
}

export interface ApiTx {
  hash: string;
  blockHeight: number;
  fromAddr: string;
  toAddr: string;
  value: string;
  feePaid: string;
  success: boolean;
  method?: string;
}

export interface ApiAddress {
  address: string;
  balance: string;
  txCount: number;
  lastSeen: string;
}

export interface ApiValidator {
  address: string;
  moniker: string;
  votingPower: string;
  commission: string;
  status: string;
}

export interface SearchResult {
  type: 'block' | 'tx' | 'address' | 'unknown';
}

export interface PriceData {
  price: number;
  symbol: string;
}

export interface TimeseriesBucket {
  t: string;
  tps: number;
  avgFee: number;
}

// ── Pagination helpers (kept for DataTable/Pagination components) ────

export interface PageInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
