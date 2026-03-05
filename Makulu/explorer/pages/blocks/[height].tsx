import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useGraphQL } from '@/lib/graphql';
import { BLOCK_DETAIL } from '@/lib/queries';
import { EXPLORER_TITLE } from '@/lib/constants';
import { formatNumber, formatTimestamp, formatGas } from '@/lib/format';
import type { Block, Transaction } from '@/lib/types';
import HashDisplay from '@/components/HashDisplay';
import AddressDisplay from '@/components/AddressDisplay';
import DataTable, { type Column } from '@/components/DataTable';
import { TxStatusBadge } from '@/components/Badges';
import TimeAgo from '@/components/TimeAgo';
import ErrorState from '@/components/ErrorState';
import Loading from '@/components/Loading';

export default function BlockDetailPage() {
  const router = useRouter();
  const { height } = router.query;

  const { data, loading, error, refetch } = useGraphQL<{ block: Block }>(
    BLOCK_DETAIL, { height: height as string }, { skip: !height }
  );

  const block = data?.block;

  const txColumns: Column<Transaction>[] = [
    {
      key: 'hash',
      header: 'Tx Hash',
      render: (tx) => (
        <Link href={`/txs/${tx.hash}`} className="font-mono text-litho-400">
          <HashDisplay hash={tx.hash} />
        </Link>
      ),
    },
    { key: 'type', header: 'Type', render: (tx) => tx.txType || '-' },
    { key: 'from', header: 'From', render: (tx) => <AddressDisplay address={tx.sender} /> },
    { key: 'to', header: 'To', render: (tx) => <AddressDisplay address={tx.receiver} /> },
    { key: 'amount', header: 'Amount', render: (tx) => tx.amount ? `${tx.amount} ${tx.denom || ''}` : '-' },
    { key: 'status', header: 'Status', render: (tx) => <TxStatusBadge success={tx.success} /> },
    { key: 'time', header: 'Time', render: (tx) => <TimeAgo timestamp={tx.timestamp} /> },
  ];

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (loading) return <Loading lines={8} />;
  if (!block) return <ErrorState message="Block not found" />;

  return (
    <>
      <Head><title>Block #{height} | {EXPLORER_TITLE}</title></Head>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] mb-6">
        <Link href="/" className="hover:text-litho-400">Home</Link>
        <span>/</span>
        <Link href="/blocks" className="hover:text-litho-400">Blocks</Link>
        <span>/</span>
        <span className="text-[var(--color-text-primary)]">#{formatNumber(block.height)}</span>
      </div>

      <h1 className="text-2xl font-bold mb-6">Block #{formatNumber(block.height)}</h1>

      {/* Block Info */}
      <div className="card p-6 mb-6">
        <div className="detail-row">
          <span className="detail-label">Height</span>
          <span className="detail-value font-mono">{formatNumber(block.height)}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Hash</span>
          <span className="detail-value"><HashDisplay hash={block.hash} full /></span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Proposer</span>
          <span className="detail-value"><AddressDisplay address={block.proposerAddress} truncate={false} /></span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Transactions</span>
          <span className="detail-value">{block.numTxs}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Total Gas</span>
          <span className="detail-value">{formatGas(block.totalGas)}</span>
        </div>
        <div className="detail-row border-b-0">
          <span className="detail-label">Block Time</span>
          <span className="detail-value">{formatTimestamp(block.blockTime)}</span>
        </div>
      </div>

      {/* Transactions */}
      {block.transactions && block.transactions.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-4">Transactions ({block.transactions.length})</h2>
          <DataTable
            columns={txColumns}
            data={block.transactions}
            rowKey={(tx) => tx.id}
          />
        </>
      )}
    </>
  );
}
