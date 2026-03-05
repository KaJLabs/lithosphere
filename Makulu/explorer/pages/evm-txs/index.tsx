import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useGraphQL } from '@/lib/graphql';
import { EVM_TRANSACTIONS } from '@/lib/queries';
import { EXPLORER_TITLE, PAGE_SIZE } from '@/lib/constants';
import { formatNumber } from '@/lib/format';
import type { EvmTransactionsResult, EvmTransaction } from '@/lib/types';
import DataTable, { type Column } from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import HashDisplay from '@/components/HashDisplay';
import AddressDisplay from '@/components/AddressDisplay';
import TimeAgo from '@/components/TimeAgo';
import { TxStatusBadge } from '@/components/Badges';
import ErrorState from '@/components/ErrorState';

export default function EvmTransactionsPage() {
  const [offset, setOffset] = useState(0);
  const { data, loading, error, refetch } = useGraphQL<{ evmTransactions: EvmTransactionsResult }>(
    EVM_TRANSACTIONS, { limit: PAGE_SIZE, offset }
  );

  const columns: Column<EvmTransaction>[] = [
    { key: 'hash', header: 'Tx Hash', render: (tx) => <Link href={`/evm-txs/${tx.hash}`}><HashDisplay hash={tx.hash} /></Link> },
    { key: 'block', header: 'Block', render: (tx) => <Link href={`/blocks/${tx.blockHeight}`} className="font-mono">{formatNumber(tx.blockHeight)}</Link> },
    { key: 'from', header: 'From', render: (tx) => <AddressDisplay address={tx.fromAddress} /> },
    { key: 'to', header: 'To', render: (tx) => <AddressDisplay address={tx.toAddress} /> },
    { key: 'value', header: 'Value', render: (tx) => <span className="font-mono text-sm">{tx.value || '0'}</span> },
    { key: 'gas', header: 'Gas Used', render: (tx) => formatNumber(tx.gasUsed) },
    { key: 'status', header: 'Status', render: (tx) => <TxStatusBadge success={tx.status} /> },
    { key: 'time', header: 'Time', render: (tx) => <TimeAgo timestamp={tx.timestamp} /> },
  ];

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <>
      <Head><title>EVM Transactions | {EXPLORER_TITLE}</title></Head>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">EVM Transactions</h1>
        {data?.evmTransactions?.pageInfo && (
          <span className="text-sm text-[var(--color-text-muted)]">Total: {formatNumber(data.evmTransactions.pageInfo.total)}</span>
        )}
      </div>
      <DataTable columns={columns} data={data?.evmTransactions?.items ?? []} loading={loading} rowKey={(tx) => tx.id} />
      {data?.evmTransactions?.pageInfo && <Pagination pageInfo={data.evmTransactions.pageInfo} onPageChange={setOffset} />}
    </>
  );
}
