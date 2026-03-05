import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useGraphQL } from '@/lib/graphql';
import { BLOCKS } from '@/lib/queries';
import { EXPLORER_TITLE, PAGE_SIZE } from '@/lib/constants';
import { formatNumber, timeAgo } from '@/lib/format';
import type { BlocksResult } from '@/lib/types';
import DataTable, { type Column } from '@/components/DataTable';
import type { Block } from '@/lib/types';
import Pagination from '@/components/Pagination';
import HashDisplay from '@/components/HashDisplay';
import AddressDisplay from '@/components/AddressDisplay';
import TimeAgo from '@/components/TimeAgo';
import ErrorState from '@/components/ErrorState';

export default function BlocksPage() {
  const [offset, setOffset] = useState(0);
  const { data, loading, error, refetch } = useGraphQL<{ blocks: BlocksResult }>(
    BLOCKS, { limit: PAGE_SIZE, offset }
  );

  const columns: Column<Block>[] = [
    {
      key: 'height',
      header: 'Height',
      render: (b) => (
        <Link href={`/blocks/${b.height}`} className="font-mono font-medium">
          {formatNumber(b.height)}
        </Link>
      ),
    },
    {
      key: 'hash',
      header: 'Hash',
      render: (b) => <HashDisplay hash={b.hash} />,
    },
    {
      key: 'proposer',
      header: 'Proposer',
      render: (b) => <AddressDisplay address={b.proposerAddress} />,
    },
    {
      key: 'txns',
      header: 'Txns',
      render: (b) => formatNumber(b.numTxs),
    },
    {
      key: 'gas',
      header: 'Gas',
      render: (b) => formatNumber(b.totalGas),
    },
    {
      key: 'time',
      header: 'Time',
      render: (b) => <TimeAgo timestamp={b.blockTime} />,
    },
  ];

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <>
      <Head><title>Blocks | {EXPLORER_TITLE}</title></Head>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Blocks</h1>
        {data?.blocks?.pageInfo && (
          <span className="text-sm text-[var(--color-text-muted)]">
            Total: {formatNumber(data.blocks.pageInfo.total)}
          </span>
        )}
      </div>
      <DataTable
        columns={columns}
        data={data?.blocks?.items ?? []}
        loading={loading}
        rowKey={(b) => b.height}
        emptyMessage="No blocks found"
      />
      {data?.blocks?.pageInfo && (
        <Pagination pageInfo={data.blocks.pageInfo} onPageChange={setOffset} />
      )}
    </>
  );
}
