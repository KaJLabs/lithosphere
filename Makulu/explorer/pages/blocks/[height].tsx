import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useApi } from '@/lib/api';
import { EXPLORER_TITLE } from '@/lib/constants';
import { formatNumber, formatTimestamp } from '@/lib/format';
import type { ApiBlock, ApiTx } from '@/lib/types';
import HashDisplay from '@/components/HashDisplay';
import DataTable, { type Column } from '@/components/DataTable';
import { TxStatusBadge } from '@/components/Badges';
import ErrorState from '@/components/ErrorState';
import Loading from '@/components/Loading';

export default function BlockDetailPage() {
  const router = useRouter();
  const { height } = router.query;

  const { data: block, loading, error, refetch } = useApi<ApiBlock>(
    height ? `/blocks/${height}` : null
  );

  const txColumns: Column<ApiTx>[] = [
    {
      key: 'hash',
      header: 'Tx Hash',
      render: (tx) => (
        <Link href={`/txs/${tx.hash}`} className="font-mono text-litho-400">
          <HashDisplay hash={tx.hash} />
        </Link>
      ),
    },
    {
      key: 'from',
      header: 'From',
      render: (tx) => <span className="font-mono text-sm">{tx.fromAddr?.slice(0, 12)}...</span>,
    },
    {
      key: 'to',
      header: 'To',
      render: (tx) => <span className="font-mono text-sm">{tx.toAddr?.slice(0, 12)}...</span>,
    },
    {
      key: 'value',
      header: 'Value',
      render: (tx) => <span className="font-mono text-sm">{tx.value || '0'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (tx) => <TxStatusBadge success={tx.success} />,
    },
  ];

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (loading) return <Loading lines={8} />;
  if (!block) return <ErrorState message="Block not found" />;

  return (
    <>
      <Head><title>Block #{height} | {EXPLORER_TITLE}</title></Head>

      <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] mb-6">
        <Link href="/" className="hover:text-litho-400">Home</Link>
        <span>/</span>
        <Link href="/blocks" className="hover:text-litho-400">Blocks</Link>
        <span>/</span>
        <span className="text-[var(--color-text-primary)]">#{formatNumber(block.height)}</span>
      </div>

      <h1 className="text-2xl font-bold mb-6">Block #{formatNumber(block.height)}</h1>

      <div className="card p-6 mb-6">
        <div className="detail-row">
          <span className="detail-label">Height</span>
          <span className="detail-value font-mono">{formatNumber(block.height)}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Hash</span>
          <span className="detail-value"><HashDisplay hash={block.hash} full /></span>
        </div>
        {block.parentHash && (
          <div className="detail-row">
            <span className="detail-label">Parent Hash</span>
            <span className="detail-value"><HashDisplay hash={block.parentHash} full /></span>
          </div>
        )}
        <div className="detail-row">
          <span className="detail-label">Transactions</span>
          <span className="detail-value">{block.txCount}</span>
        </div>
        <div className="detail-row border-b-0">
          <span className="detail-label">Timestamp</span>
          <span className="detail-value">{formatTimestamp(block.timestamp)}</span>
        </div>
      </div>

      {block.transactions && block.transactions.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-4">Transactions ({block.transactions.length})</h2>
          <DataTable
            columns={txColumns}
            data={block.transactions}
            rowKey={(tx) => tx.hash}
          />
        </>
      )}
    </>
  );
}
