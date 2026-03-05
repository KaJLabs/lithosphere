import Head from 'next/head';
import Link from 'next/link';
import { useApi } from '@/lib/api';
import { EXPLORER_TITLE, POLL_INTERVAL } from '@/lib/constants';
import { formatNumber } from '@/lib/format';
import type { ApiBlock } from '@/lib/types';
import DataTable, { type Column } from '@/components/DataTable';
import HashDisplay from '@/components/HashDisplay';
import TimeAgo from '@/components/TimeAgo';
import ErrorState from '@/components/ErrorState';

export default function BlocksPage() {
  const { data, loading, error, refetch } = useApi<ApiBlock[]>(
    '/blocks?limit=25', { pollInterval: POLL_INTERVAL }
  );

  const blocks = data ?? [];

  const columns: Column<ApiBlock>[] = [
    {
      key: 'height',
      header: 'Height',
      render: (b) => (
        <Link href={`/blocks/${b.height}`} className="font-mono font-medium text-litho-400">
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
      key: 'txns',
      header: 'Txns',
      render: (b) => formatNumber(b.txCount),
    },
    {
      key: 'time',
      header: 'Time',
      render: (b) => <TimeAgo timestamp={b.timestamp} />,
    },
  ];

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <>
      <Head><title>Blocks | {EXPLORER_TITLE}</title></Head>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Blocks</h1>
      </div>
      <DataTable
        columns={columns}
        data={blocks}
        loading={loading}
        rowKey={(b) => String(b.height)}
        emptyMessage="No blocks found"
      />
    </>
  );
}
