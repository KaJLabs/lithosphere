import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useApi } from '@/lib/api';
import { EXPLORER_TITLE } from '@/lib/constants';
import { formatNumber, formatTimestamp, truncateHash, timeAgo } from '@/lib/format';
import type { ApiTx } from '@/lib/types';

function CopyBtn({ text }: { text: string }) {
  const copy = () => navigator.clipboard?.writeText(text).catch(() => {});
  return (
    <button
      onClick={copy}
      className="ml-2 rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/50 hover:text-white/80 transition"
      title="Copy"
    >
      copy
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-4 border-b border-white/5 last:border-0">
      <div className="sm:w-44 shrink-0 text-sm text-white/45">{label}</div>
      <div className="flex-1 text-sm text-white break-all">{children}</div>
    </div>
  );
}

export default function TransactionDetailPage() {
  const router = useRouter();
  const { hash } = router.query;

  const { data: tx, loading, error } = useApi<ApiTx>(
    hash ? `/txs/${hash}` : null
  );

  if (loading) {
    return (
      <div className="text-white animate-pulse space-y-4">
        <div className="h-8 rounded-2xl bg-white/10 w-1/3" />
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-4 rounded bg-white/10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !tx) {
    return (
      <div className="text-white">
        <div className="rounded-3xl border border-red-400/20 bg-red-400/5 p-8 text-center">
          <div className="text-lg font-medium text-red-300 mb-2">Transaction Not Found</div>
          <div className="text-sm text-white/50 mb-4">
            {error ?? 'No transaction found with this hash.'}
          </div>
          <Link href="/txs" className="text-sm text-emerald-300 hover:text-emerald-200">
            ← Back to Transactions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Tx {truncateHash(tx.hash)} | {EXPLORER_TITLE}</title>
      </Head>

      <div className="text-white">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
          <Link href="/" className="hover:text-white/70 transition">Home</Link>
          <span>/</span>
          <Link href="/txs" className="hover:text-white/70 transition">Transactions</Link>
          <span>/</span>
          <span className="text-white/70 font-mono">{truncateHash(tx.hash)}</span>
        </div>

        {/* Title row */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <h1 className="text-2xl font-semibold">Transaction Details</h1>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${
              tx.success
                ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                : 'border-red-400/20 bg-red-400/10 text-red-300'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${tx.success ? 'bg-emerald-400' : 'bg-red-400'}`} />
            {tx.success ? 'Success' : 'Failed'}
          </span>
        </div>

        {/* Detail card */}
        <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-2 mb-6">
          <Row label="Transaction Hash">
            <span className="font-mono">{tx.hash}</span>
            <CopyBtn text={tx.hash} />
          </Row>

          <Row label="Status">
            <span className={tx.success ? 'text-emerald-300' : 'text-red-300'}>
              {tx.success ? 'Success' : 'Failed'}
            </span>
          </Row>

          <Row label="Block">
            <Link
              href={`/blocks/${tx.blockHeight}`}
              className="font-mono text-emerald-300 hover:text-emerald-200 transition"
            >
              #{formatNumber(tx.blockHeight)}
            </Link>
          </Row>

          {tx.timestamp && (
            <Row label="Timestamp">
              <span>{formatTimestamp(tx.timestamp)}</span>
              <span className="ml-2 text-white/40">({timeAgo(tx.timestamp)})</span>
            </Row>
          )}

          <Row label="From">
            {tx.fromAddr ? (
              <Link
                href={`/address/${tx.fromAddr}`}
                className="font-mono text-emerald-300 hover:text-emerald-200 transition"
              >
                {tx.fromAddr}
              </Link>
            ) : (
              <span className="text-white/40">—</span>
            )}
          </Row>

          <Row label="To">
            {tx.toAddr ? (
              <Link
                href={`/address/${tx.toAddr}`}
                className="font-mono text-emerald-300 hover:text-emerald-200 transition"
              >
                {tx.toAddr}
              </Link>
            ) : (
              <span className="text-white/40">—</span>
            )}
          </Row>

          <Row label="Value">
            <span className="font-mono">
              {tx.value && tx.value !== '0'
                ? `${tx.value} ${tx.denom ?? 'ulitho'}`
                : '0'}
            </span>
          </Row>

          <Row label="Fee">
            <span className="font-mono">
              {tx.feePaid && tx.feePaid !== '0'
                ? `${tx.feePaid} ${tx.denom ?? 'ulitho'}`
                : '0'}
            </span>
          </Row>

          {(tx.gasUsed != null || tx.gasWanted != null) && (
            <Row label="Gas">
              <span className="font-mono">
                {tx.gasUsed ?? '—'} / {tx.gasWanted ?? '—'}
                <span className="ml-2 text-white/40 font-sans text-xs">(used / limit)</span>
              </span>
            </Row>
          )}

          {tx.method && (
            <Row label="Method">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-0.5 text-xs font-mono text-white/70">
                {tx.method}
              </span>
            </Row>
          )}

          {tx.memo && (
            <Row label="Memo">
              <span className="text-white/70">{tx.memo}</span>
            </Row>
          )}
        </div>
      </div>
    </>
  );
}
