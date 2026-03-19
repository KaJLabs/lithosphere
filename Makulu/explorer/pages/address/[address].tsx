import { useState, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useApi } from '@/lib/api';
import { EXPLORER_TITLE } from '@/lib/constants';
import { formatNumber, truncateHash, timeAgo, formatTimestamp } from '@/lib/format';
import type { ApiAddress, ApiTx } from '@/lib/types';

/* ── Tabs ─────────────────────────────────────────────────────────────── */

const TABS = [
  { key: 'transactions', label: 'Transactions' },
  { key: 'transfers', label: 'Transfers' },
  { key: 'tokens', label: 'Tokens' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

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
                  {tx.method}
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

/* ── Tokens tab placeholder ───────────────────────────────────────────── */

function TokensTab() {
  return (
    <div className="py-16 text-center text-white/40">
      <div className="text-base font-medium mb-1">No token balances found</div>
      <div className="text-sm">Token balance tracking is not yet available for this address.</div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────────── */

export default function AddressPage() {
  const router = useRouter();
  const { address, tab } = router.query;
  const addr = typeof address === 'string' ? address : '';
  const activeTab: TabKey =
    typeof tab === 'string' && TABS.some((t) => t.key === tab)
      ? (tab as TabKey)
      : 'transactions';

  const { data: account, loading: accountLoading, error: accountError } =
    useApi<ApiAddress>(addr ? `/address/${addr}` : null);

  const { data: txs, loading: txsLoading } =
    useApi<ApiTx[]>(addr ? `/address/${addr}/txs?limit=25` : null);

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

  /* ── Render ─────────────────────────────────────────────────────────── */

  return (
    <>
      <Head>
        <title>Address {truncateHash(account.address, 12, 6)} | {EXPLORER_TITLE}</title>
      </Head>

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
              <span className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                {account.txCount > 0 ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Overview cards ──────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-white/45 mb-1">Balance</div>
            <div className="text-xl font-semibold">
              {account.balance && account.balance !== '0' ? account.balance : '0 LITHO'}
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

        {/* ── Tab bar ─────────────────────────────────────────────────── */}
        <div className="border-b border-white/10">
          <nav className="flex gap-6 -mb-px" aria-label="Address tabs">
            {TABS.map((t) => {
              const isActive = activeTab === t.key;
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
          {activeTab === 'transactions' && (
            <TxTable
              txs={txs}
              loading={txsLoading}
              currentAddr={addr}
              emptyLabel="No transactions found"
            />
          )}

          {activeTab === 'transfers' && (
            <TxTable
              txs={txs}
              loading={txsLoading}
              currentAddr={addr}
              emptyLabel="No transfers found"
            />
          )}

          {activeTab === 'tokens' && <TokensTab />}
        </div>
      </div>
    </>
  );
}
