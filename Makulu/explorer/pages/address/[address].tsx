import { useState, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useApi } from '@/lib/api';
import { EXPLORER_TITLE } from '@/lib/constants';
import { formatNumber, truncateHash, timeAgo, formatTimestamp, formatLitho, cleanMethod } from '@/lib/format';
import type { ApiAddress, ApiTx, ApiTokenDetail } from '@/lib/types';

/* ── Tabs ─────────────────────────────────────────────────────────────── */

const WALLET_TABS = [
  { key: 'transactions', label: 'Transactions' },
  { key: 'transfers', label: 'Transfers' },
  { key: 'tokens', label: 'Tokens' },
] as const;

const TOKEN_TABS = [
  { key: 'transfers', label: 'Transfers' },
  { key: 'holders', label: 'Holders' },
  { key: 'contract', label: 'Contract' },
] as const;

type WalletTabKey = (typeof WALLET_TABS)[number]['key'];
type TokenTabKey = (typeof TOKEN_TABS)[number]['key'];
type TabKey = WalletTabKey | TokenTabKey;

/* ── Address type detection ──────────────────────────────────────────── */

function detectIsContract(account: ApiAddress): boolean {
  if (account.isContract) return true;
  return false;
}

/* ── Small helpers ────────────────────────────────────────────────────── */

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }, [text]);

  return (
    <button
      onClick={copy}
      className="ml-2 rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/50 hover:text-white/80 transition"
      title="Copy to clipboard"
    >
      {copied ? 'copied!' : 'copy'}
    </button>
  );
}

function StatusDot({ success }: { success: boolean }) {
  return (
    <span
      className={`inline-flex h-2 w-2 rounded-full shrink-0 ${success ? 'bg-emerald-400' : 'bg-red-400'}`}
      title={success ? 'Success' : 'Failed'}
    />
  );
}

/* ── Skeleton loaders ─────────────────────────────────────────────────── */

function PageSkeleton() {
  return (
    <div className="text-white animate-pulse space-y-6">
      {/* Header skeleton */}
      <div className="space-y-3">
        <div className="h-5 rounded bg-white/10 w-24" />
        <div className="h-8 rounded-xl bg-white/10 w-2/3" />
      </div>
      {/* Cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
            <div className="h-3 rounded bg-white/10 w-20" />
            <div className="h-6 rounded bg-white/10 w-28" />
          </div>
        ))}
      </div>
      {/* Holdings skeleton */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
        <div className="h-4 rounded bg-white/10 w-24" />
        <div className="h-10 rounded bg-white/10 w-full" />
      </div>
      {/* Tab bar skeleton */}
      <div className="flex gap-6 border-b border-white/10 pb-0">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-4 rounded bg-white/10 w-24 mb-3" />
        ))}
      </div>
      {/* Table skeleton */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-4 rounded bg-white/10 w-1/3" />
            <div className="h-4 rounded bg-white/10 w-1/4" />
            <div className="h-4 rounded bg-white/10 w-1/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-5 py-4 border-b border-white/5 animate-pulse">
          <div className="h-4 rounded bg-white/10 w-1/3" />
          <div className="h-4 rounded bg-white/10 w-1/6" />
          <div className="h-4 rounded bg-white/10 w-1/4" />
          <div className="h-4 rounded bg-white/10 w-1/4" />
        </div>
      ))}
    </div>
  );
}

/* ── Transaction table (shared between Transactions & Transfers tabs) ── */

function TxTable({
  txs,
  loading,
  currentAddr,
  emptyLabel,
}: {
  txs: ApiTx[] | null;
  loading: boolean;
  currentAddr: string;
  emptyLabel: string;
}) {
  if (loading) {
    return <TableSkeleton />;
  }

  if (!txs || txs.length === 0) {
    return (
      <div className="py-16 text-center text-white/40">
        <div className="text-base font-medium mb-1">{emptyLabel}</div>
        <div className="text-sm">This address has no indexed activity yet.</div>
      </div>
    );
  }

  return (
    <>
      {/* Desktop header */}
      <div className="hidden md:grid grid-cols-[1.8fr_0.8fr_1.4fr_1.4fr_1fr_0.7fr_0.8fr] gap-4 px-5 py-3 border-b border-white/10 text-xs font-medium text-white/40 uppercase tracking-wide">
        <div>Tx Hash</div>
        <div>Block</div>
        <div>From</div>
        <div>To</div>
        <div>Value</div>
        <div>Method</div>
        <div>Age</div>
      </div>

      {/* Rows */}
      <div>
        {txs.map((tx) => (
          <div
            key={tx.hash}
            className="grid grid-cols-1 md:grid-cols-[1.8fr_0.8fr_1.4fr_1.4fr_1fr_0.7fr_0.8fr] gap-3 md:gap-4 px-5 py-4 border-b border-white/5 hover:bg-white/[0.03] transition"
          >
            {/* Hash */}
            <div className="flex items-center gap-2">
              <StatusDot success={tx.success} />
              <Link
                href={`/txs/${tx.evmHash || tx.hash}`}
                className="font-mono text-sm text-emerald-300 hover:text-emerald-200 transition truncate"
              >
                {truncateHash(tx.evmHash || tx.hash)}
              </Link>
            </div>

            {/* Block */}
            <div className="flex items-center md:block">
              <span className="md:hidden text-xs text-white/40 mr-2 w-16 shrink-0">Block</span>
              <Link
                href={`/blocks/${tx.blockHeight}`}
                className="font-mono text-sm text-white/80 hover:text-white transition"
              >
                #{formatNumber(tx.blockHeight)}
              </Link>
            </div>

            {/* From */}
            <div className="flex items-center md:block">
              <span className="md:hidden text-xs text-white/40 mr-2 w-16 shrink-0">From</span>
              <Link
                href={`/address/${tx.fromAddr}`}
                className={`font-mono text-sm transition truncate ${
                  tx.fromAddr === currentAddr
                    ? 'text-white/50'
                    : 'text-emerald-300 hover:text-emerald-200'
                }`}
              >
                {truncateHash(tx.fromAddr, 10, 6)}
              </Link>
            </div>

            {/* To */}
            <div className="flex items-center md:block">
              <span className="md:hidden text-xs text-white/40 mr-2 w-16 shrink-0">To</span>
              {tx.toAddr ? (
                <Link
                  href={`/address/${tx.toAddr}`}
                  className={`font-mono text-sm transition truncate ${
                    tx.toAddr === currentAddr
                      ? 'text-white/50'
                      : 'text-emerald-300 hover:text-emerald-200'
                  }`}
                >
                  {truncateHash(tx.toAddr, 10, 6)}
                </Link>
              ) : (
                <span className="text-sm text-white/30">&mdash;</span>
              )}
            </div>

            {/* Value */}
            <div className="flex items-center md:block">
              <span className="md:hidden text-xs text-white/40 mr-2 w-16 shrink-0">Value</span>
              <span className="text-sm font-mono text-white/80">
                {tx.value && tx.value !== '0' ? `${tx.value} ${tx.denom ?? 'ulitho'}` : '0'}
              </span>
            </div>

            {/* Method */}
            <div className="flex items-center md:block">
              <span className="md:hidden text-xs text-white/40 mr-2 w-16 shrink-0">Method</span>
              {tx.method ? (
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/70">
                  {cleanMethod(tx.method)}
                </span>
              ) : (
                <span className="text-sm text-white/30">&mdash;</span>
              )}
            </div>

            {/* Age */}
            <div className="flex items-center md:block">
              <span className="md:hidden text-xs text-white/40 mr-2 w-16 shrink-0">Age</span>
              <span className="text-sm text-white/50">
                {tx.timestamp ? timeAgo(tx.timestamp) : '—'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Holdings table ──────────────────────────────────────────────────── */

function HoldingsSection({ balance }: { balance: string }) {
  const hasBalance = balance && balance !== '0';

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10">
        <h2 className="text-sm font-medium text-white/70 uppercase tracking-wide">Holdings</h2>
      </div>

      {hasBalance ? (
        <>
          {/* Table header */}
          <div className="grid grid-cols-3 gap-4 px-5 py-3 border-b border-white/10 text-xs font-medium text-white/40 uppercase tracking-wide">
            <div>Name</div>
            <div>Ticker</div>
            <div className="text-right">Amount</div>
          </div>
          {/* LITHO row */}
          <div className="grid grid-cols-3 gap-4 px-5 py-4 hover:bg-white/[0.03] transition">
            <div className="text-sm text-white">Lithosphere</div>
            <div className="text-sm text-white/70 font-mono">LITHO</div>
            <div className="text-sm text-white/80 font-mono text-right">
              {formatLitho(balance)}
            </div>
          </div>
        </>
      ) : (
        <div className="py-10 text-center text-white/40">
          <div className="text-sm">No holdings found</div>
        </div>
      )}
    </div>
  );
}

/* ── Tokens tab placeholder ──────────────────────────────────────────── */

function TokensTab() {
  return (
    <div className="py-16 text-center text-white/40">
      <div className="text-base font-medium mb-1">No token balances found</div>
      <div className="text-sm">Token balance tracking is not yet available for this address.</div>
    </div>
  );
}

/* ── Token contract layout ───────────────────────────────────────────── */

function TokenContractLayout({
  account,
  tokenDetail,
  txs,
  txsLoading,
  addr,
  activeTab,
  setTab,
}: {
  account: ApiAddress;
  tokenDetail: ApiTokenDetail | null;
  txs: ApiTx[] | null;
  txsLoading: boolean;
  addr: string;
  activeTab: TabKey;
  setTab: (key: TabKey) => void;
}) {
  const resolvedTab = TOKEN_TABS.some((t) => t.key === activeTab) ? activeTab : 'transfers';
  const tokenName = tokenDetail?.name ?? account.tokenName ?? 'Unknown Token';
  const tokenSymbol = tokenDetail?.symbol ?? account.tokenSymbol ?? '???';
  const isToken = account.isToken || !!tokenDetail;

  return (
    <div className="text-white space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 text-sm text-white/40 mb-4">
          <Link href="/" className="hover:text-white/70 transition">Home</Link>
          <span>/</span>
          {isToken && (
            <>
              <Link href="/tokens" className="hover:text-white/70 transition">Tokens</Link>
              <span>/</span>
            </>
          )}
          <span className="text-white/70">{isToken ? 'Token' : 'Contract'}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
          {isToken && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-violet-500 flex items-center justify-center text-lg font-bold text-white">
                {tokenSymbol.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-semibold">{tokenName}</h1>
                <span className="text-sm text-white/50">{tokenSymbol}</span>
              </div>
            </div>
          )}
          {!isToken && (
            <h1 className="text-2xl font-semibold break-all">
              <span className="font-mono">{account.address}</span>
            </h1>
          )}
          <div className="flex items-center gap-2 shrink-0">
            <CopyBtn text={account.address} />
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              isToken
                ? 'border-violet-400/30 bg-violet-400/10 text-violet-300'
                : 'border-blue-400/30 bg-blue-400/10 text-blue-300'
            }`}>
              {isToken ? 'LEP-100 Token' : 'Contract'}
            </span>
          </div>
        </div>

        {isToken && (
          <div className="font-mono text-sm text-white/40 break-all">{account.address}</div>
        )}
      </div>

      {/* ── Token overview cards ─────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/45 mb-1">Total Supply</div>
          <div className="text-xl font-semibold font-mono">
            {tokenDetail?.totalSupply ?? account.totalSupply ?? '—'}
          </div>
          {isToken && <div className="text-xs text-white/30 mt-1">{tokenSymbol}</div>}
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/45 mb-1">Holders</div>
          <div className="text-xl font-semibold">
            {tokenDetail?.holders != null ? formatNumber(tokenDetail.holders) : '—'}
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/45 mb-1">Transfers</div>
          <div className="text-xl font-semibold">
            {tokenDetail?.transfers != null ? formatNumber(tokenDetail.transfers) : formatNumber(account.txCount)}
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/45 mb-1">Decimals</div>
          <div className="text-xl font-semibold">
            {tokenDetail?.decimals ?? account.tokenDecimals ?? 18}
          </div>
        </div>
      </div>

      {/* ── Contract info card ───────────────────────────────────────── */}
      <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-2">
        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-4 border-b border-white/5">
          <div className="sm:w-40 shrink-0 text-sm text-white/45">Contract Address</div>
          <div className="flex-1 text-sm text-white font-mono break-all">
            {account.address}
            <CopyBtn text={account.address} />
          </div>
        </div>
        {tokenDetail?.creator && (
          <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-4 border-b border-white/5">
            <div className="sm:w-40 shrink-0 text-sm text-white/45">Creator</div>
            <div className="flex-1 text-sm">
              <Link href={`/address/${tokenDetail.creator}`} className="font-mono text-emerald-300 hover:text-emerald-200 transition">
                {truncateHash(tokenDetail.creator)}
              </Link>
            </div>
          </div>
        )}
        {tokenDetail?.createdAt && (
          <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-4">
            <div className="sm:w-40 shrink-0 text-sm text-white/45">Created</div>
            <div className="flex-1 text-sm text-white/70">
              {formatTimestamp(tokenDetail.createdAt)}
              <span className="ml-2 text-white/40">({timeAgo(tokenDetail.createdAt)})</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────── */}
      <div className="border-b border-white/10">
        <nav className="flex gap-6 -mb-px" aria-label="Token contract tabs">
          {TOKEN_TABS.map((t) => {
            const active = resolvedTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`pb-3 text-sm font-medium transition border-b-2 ${
                  active
                    ? 'border-emerald-400 text-white'
                    : 'border-transparent text-white/50 hover:text-white/70'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
        {resolvedTab === 'transfers' && (
          <TxTable
            txs={txs}
            loading={txsLoading}
            currentAddr={addr}
            emptyLabel="No transfers found"
          />
        )}

        {resolvedTab === 'holders' && (
          <div className="py-16 text-center text-white/40">
            <div className="text-base font-medium mb-1">No holder data available</div>
            <div className="text-sm">Token holder tracking is not yet available.</div>
          </div>
        )}

        {resolvedTab === 'contract' && (
          <div className="py-16 text-center text-white/40">
            <div className="text-base font-medium mb-1">Contract details unavailable</div>
            <div className="text-sm">Contract source and ABI are not indexed yet.</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Wallet address layout ───────────────────────────────────────────── */

function WalletLayout({
  account,
  txs,
  txsLoading,
  addr,
  activeTab,
  setTab,
}: {
  account: ApiAddress;
  txs: ApiTx[] | null;
  txsLoading: boolean;
  addr: string;
  activeTab: TabKey;
  setTab: (key: TabKey) => void;
}) {
  const resolvedTab = WALLET_TABS.some((t) => t.key === activeTab) ? activeTab : 'transactions';

  // Show alternate address format if available
  const altAddress = account.evmAddress && account.evmAddress !== account.address
    ? account.evmAddress
    : account.cosmosAddress && account.cosmosAddress !== account.address
      ? account.cosmosAddress
      : null;

  return (
    <div className="text-white space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 text-sm text-white/40 mb-4">
          <Link href="/" className="hover:text-white/70 transition">Home</Link>
          <span>/</span>
          <span className="text-white/70">Address</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <h1 className="text-2xl font-semibold break-all">
            <span className="font-mono">{account.address}</span>
          </h1>
          <div className="flex items-center gap-2 shrink-0">
            <CopyBtn text={account.address} />
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                account.txCount > 0
                  ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                  : 'border-white/20 bg-white/5 text-white/50'
              }`}
            >
              {account.txCount > 0 ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Show alternate address format */}
        {altAddress && (
          <div className="mt-2 flex items-center gap-2 text-sm text-white/40">
            <span>{altAddress.startsWith('0x') ? 'EVM' : 'Cosmos'}:</span>
            <span className="font-mono text-white/55">{altAddress}</span>
            <CopyBtn text={altAddress} />
          </div>
        )}
      </div>

      {/* ── Overview cards ──────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/45 mb-1">Balance</div>
          <div className="text-xl font-semibold">
            {account.balance && account.balance !== '0' ? formatLitho(account.balance) : '0 LITHO'}
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/45 mb-1">Transactions</div>
          <div className="text-xl font-semibold">{formatNumber(account.txCount)}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/45 mb-1">Last Active</div>
          <div className="text-xl font-semibold">
            {account.lastSeen ? timeAgo(account.lastSeen) : '—'}
          </div>
        </div>
      </div>

      {/* ── Holdings ────────────────────────────────────────────────── */}
      <HoldingsSection balance={account.balance} />

      {/* ── Tab bar ─────────────────────────────────────────────────── */}
      <div className="border-b border-white/10">
        <nav className="flex gap-6 -mb-px" aria-label="Address tabs">
          {WALLET_TABS.map((t) => {
            const isActive = resolvedTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`pb-3 text-sm font-medium transition border-b-2 ${
                  isActive
                    ? 'border-emerald-400 text-white'
                    : 'border-transparent text-white/50 hover:text-white/70'
                }`}
              >
                {t.label}
                {t.key === 'transactions' && account.txCount > 0 && (
                  <span className="ml-1.5 text-xs text-white/35">
                    ({formatNumber(account.txCount)})
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
        {resolvedTab === 'transactions' && (
          <TxTable
            txs={txs}
            loading={txsLoading}
            currentAddr={addr}
            emptyLabel="No transactions found"
          />
        )}

        {resolvedTab === 'transfers' && (
          <TxTable
            txs={txs}
            loading={txsLoading}
            currentAddr={addr}
            emptyLabel="No transfers found"
          />
        )}

        {resolvedTab === 'tokens' && <TokensTab />}
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────────── */

export default function AddressPage() {
  const router = useRouter();
  const { address, tab } = router.query;
  const addr = typeof address === 'string' ? address : '';
  const activeTab: TabKey =
    typeof tab === 'string' ? (tab as TabKey) : 'transactions';

  const { data: account, loading: accountLoading, error: accountError } =
    useApi<ApiAddress>(addr ? `/address/${addr}` : null);

  const { data: txs, loading: txsLoading } =
    useApi<ApiTx[]>(addr ? `/address/${addr}/txs?limit=25` : null);

  // Fetch token detail if this is a token contract
  const isContract = account ? detectIsContract(account) : false;
  const isToken = account?.isToken ?? false;
  const { data: tokenDetail } =
    useApi<ApiTokenDetail>((isContract || isToken) && addr ? `/tokens/${addr}` : null);

  const setTab = useCallback(
    (key: TabKey) => {
      router.push(
        { pathname: router.pathname, query: { address: addr, tab: key } },
        undefined,
        { shallow: true },
      );
    },
    [router, addr],
  );

  /* ── Loading state ─────────────────────────────────────────────────── */

  if (accountLoading) {
    return <PageSkeleton />;
  }

  /* ── Error / not found ─────────────────────────────────────────────── */

  if (accountError || !account) {
    return (
      <div className="text-white">
        <div className="rounded-3xl border border-red-400/20 bg-red-400/5 p-8 text-center">
          <div className="text-lg font-medium text-red-300 mb-2">Address Not Found</div>
          <div className="text-sm text-white/50 mb-4">
            {accountError ?? 'This address has no indexed activity yet.'}
          </div>
          <Link href="/" className="text-sm text-emerald-300 hover:text-emerald-200">
            &larr; Back to Explorer
          </Link>
        </div>
      </div>
    );
  }

  /* ── Detect address type and render appropriate layout ──────────── */

  return (
    <>
      <Head>
        <title>
          {isContract ? 'Contract' : 'Address'} {truncateHash(account.address, 12, 6)} | {EXPLORER_TITLE}
        </title>
      </Head>

      {isContract ? (
        <TokenContractLayout
          account={account}
          tokenDetail={tokenDetail}
          txs={txs}
          txsLoading={txsLoading}
          addr={addr}
          activeTab={activeTab}
          setTab={setTab}
        />
      ) : (
        <WalletLayout
          account={account}
          txs={txs}
          txsLoading={txsLoading}
          addr={addr}
          activeTab={activeTab}
          setTab={setTab}
        />
      )}
    </>
  );
}
