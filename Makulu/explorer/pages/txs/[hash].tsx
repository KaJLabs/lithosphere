import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useApi } from '@/lib/api';
import { EXPLORER_TITLE } from '@/lib/constants';
import { formatNumber, formatTimestamp, truncateHash } from '@/lib/format';
import type { ApiTx } from '@/lib/types';
import HashDisplay from '@/components/HashDisplay';
import { TxStatusBadge } from '@/components/Badges';
import ErrorState from '@/components/ErrorState';
import Loading from '@/components/Loading';

export default function TransactionDetailPage() {
  const router = useRouter();
  const { hash } = router.query;

  const { data: tx, loading, error, refetch } = useApi<ApiTx>(
    hash ? `/txs/${hash}` : null
  );

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
            <Link href={`/blocks/${tx.blockHeight}`} className="font-mono text-litho-400">{formatNumber(tx.blockHeight)}</Link>
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">From</span>
          <span className="detail-value font-mono break-all">{tx.fromAddr || '-'}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">To</span>
          <span className="detail-value font-mono break-all">{tx.toAddr || '-'}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Value</span>
          <span className="detail-value font-mono">{tx.value || '0'}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Fee Paid</span>
          <span className="detail-value font-mono">{tx.feePaid || '0'}</span>
        </div>
        {tx.method && (
          <div className="detail-row">
            <span className="detail-label">Method</span>
            <span className="detail-value"><span className="badge-neutral">{tx.method}</span></span>
          </div>
        )}
      </div>
    </>
  );
}
