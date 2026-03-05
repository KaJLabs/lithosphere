import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useGraphQL } from '@/lib/graphql';
import { TRANSACTIONS } from '@/lib/queries';
import { EXPLORER_TITLE, PAGE_SIZE } from '@/lib/constants';
import { formatNumber } from '@/lib/format';
import type { TransactionsResult, Transaction } from '@/lib/types';
import DataTable, { type Column } from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import HashDisplay from '@/components/HashDisplay';
import AddressDisplay from '@/components/AddressDisplay';
import TimeAgo from '@/components/TimeAgo';
import { TxStatusBadge } from '@/components/Badges';
import ErrorState from '@/components/ErrorState';

export default function TransactionsPage() {
  const [offset, setOffset] = useState(0);
  const { data, loading, error, refetch } = useGraphQL<{ transactions: TransactionsResult }>(
    TRANSACTIONS, { limit: PAGE_SIZE, offset }
  );

  const columns: Column<Transaction>[] = [
    {
      key: 'hash', header: 'Tx Hash',
      render: (tx) => <Link href={`/txs/${tx.hash}`}><HashDisplay hash={tx.hash} /></Link>,
    },
    {
      key: 'block', header: 'Block',
      render: (tx) => <Link href={`/blocks/${tx.blockHeight}`} className="font-mono">{formatNumber(tx.blockHeight)}</Link>,
    },
    { key: 'type', header: 'Type', render: (tx) => <span className="badge-neutral">{tx.txType || '-'}</span> },
    { key: 'from', header: 'From', render: (tx) => <AddressDisplay address={tx.sender} /> },
    { key: 'to', header: 'To', render: (tx) => <AddressDisplay address={tx.receiver} /> },
    { key: 'status', header: 'Status', render: (tx) => <TxStatusBadge success={tx.success} /> },
    { key: 'time', header: 'Time', render: (tx) => <TimeAgo timestamp={tx.timestamp} /> },
  ];

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <>
      <Head><title>Transactions | {EXPLORER_TITLE}</title></Head>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Transactions</h1>
        {data?.transactions?.pageInfo && (
          <span className="text-sm text-[var(--color-text-muted)]">Total: {formatNumber(data.transactions.pageInfo.total)}</span>
        )}
      </div>
      <DataTable columns={columns} data={data?.transactions?.items ?? []} loading={loading} rowKey={(tx) => tx.id} />
      {data?.transactions?.pageInfo && <Pagination pageInfo={data.transactions.pageInfo} onPageChange={setOffset} />}
    </>
  );
}
