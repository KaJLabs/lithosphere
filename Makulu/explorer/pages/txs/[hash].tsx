import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useGraphQL } from '@/lib/graphql';
import { TRANSACTION_DETAIL } from '@/lib/queries';
import { EXPLORER_TITLE } from '@/lib/constants';
import { formatNumber, formatTimestamp, formatGas, truncateHash } from '@/lib/format';
import type { Transaction } from '@/lib/types';
import HashDisplay from '@/components/HashDisplay';
import AddressDisplay from '@/components/AddressDisplay';
import { TxStatusBadge } from '@/components/Badges';
import ErrorState from '@/components/ErrorState';
import Loading from '@/components/Loading';

export default function TransactionDetailPage() {
  const router = useRouter();
  const { hash } = router.query;
  const [showRawLog, setShowRawLog] = useState(false);

  const { data, loading, error, refetch } = useGraphQL<{ transaction: Transaction }>(
    TRANSACTION_DETAIL, { hash: hash as string }, { skip: !hash }
  );

  const tx = data?.transaction;

  if (loading) return <Loading lines={10} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!tx) return <ErrorState message="Transaction not found" />;

  return (
    <>
      <Head><title>Tx {truncateHash(tx.hash)} | {EXPLORER_TITLE}</title></Head>

      <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] mb-6">
        <Link href="/" className="hover:text-litho-400">Home</Link><span>/</span>
        <Link href="/txs" className="hover:text-litho-400">Transactions</Link><span>/</span>
        <span className="text-[var(--color-text-primary)] font-mono">{truncateHash(tx.hash)}</span>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Transaction Details</h1>
        <TxStatusBadge success={tx.success} />
      </div>

      <div className="card p-6">
        <div className="detail-row">
          <span className="detail-label">Transaction Hash</span>
          <span className="detail-value"><HashDisplay hash={tx.hash} full /></span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Block</span>
          <span className="detail-value">
            <Link href={`/blocks/${tx.blockHeight}`} className="font-mono">{formatNumber(tx.blockHeight)}</Link>
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Timestamp</span>
          <span className="detail-value">{formatTimestamp(tx.timestamp)}</span>
        </div>
        {tx.txIndex != null && (
          <div className="detail-row">
            <span className="detail-label">Index</span>
            <span className="detail-value">{tx.txIndex}</span>
          </div>
        )}
        <div className="detail-row">
          <span className="detail-label">Type</span>
          <span className="detail-value"><span className="badge-neutral">{tx.txType || '-'}</span></span>
        </div>
        <div className="detail-row">
          <span className="detail-label">From</span>
          <span className="detail-value"><AddressDisplay address={tx.sender} truncate={false} /></span>
        </div>
        <div className="detail-row">
          <span className="detail-label">To</span>
          <span className="detail-value"><AddressDisplay address={tx.receiver} truncate={false} /></span>
        </div>
        {tx.amount && (
          <div className="detail-row">
            <span className="detail-label">Amount</span>
            <span className="detail-value font-mono">{tx.amount} {tx.denom || ''}</span>
          </div>
        )}
        <div className="detail-row">
          <span className="detail-label">Gas Used / Wanted</span>
          <span className="detail-value font-mono">{formatGas(tx.gasUsed)} / {formatGas(tx.gasWanted)}</span>
        </div>
        {tx.fee && (
          <div className="detail-row">
            <span className="detail-label">Fee</span>
            <span className="detail-value font-mono">{tx.fee} {tx.feeDenom || ''}</span>
          </div>
        )}
        {tx.memo && (
          <div className="detail-row">
            <span className="detail-label">Memo</span>
            <span className="detail-value">{tx.memo}</span>
          </div>
        )}
        {tx.rawLog && (
          <div className="detail-row border-b-0">
            <span className="detail-label">Raw Log</span>
            <span className="detail-value">
              <button onClick={() => setShowRawLog(!showRawLog)} className="text-litho-400 text-sm mb-2">
                {showRawLog ? 'Hide' : 'Show'} raw log
              </button>
              {showRawLog && (
                <pre className="mt-2 p-3 rounded bg-[var(--color-bg-tertiary)] text-xs overflow-x-auto max-h-64 font-mono">
                  {tx.rawLog}
                </pre>
              )}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
