import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useGraphQL } from '@/lib/graphql';
import { CONTRACTS } from '@/lib/queries';
import { EXPLORER_TITLE, PAGE_SIZE } from '@/lib/constants';
import { formatNumber } from '@/lib/format';
import type { ContractsResult, Contract } from '@/lib/types';
import DataTable, { type Column } from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import AddressDisplay from '@/components/AddressDisplay';
import TimeAgo from '@/components/TimeAgo';
import ErrorState from '@/components/ErrorState';

export default function ContractsPage() {
  const [offset, setOffset] = useState(0);
  const { data, loading, error, refetch } = useGraphQL<{ contracts: ContractsResult }>(
    CONTRACTS, { limit: PAGE_SIZE, offset }
  );

  const columns: Column<Contract>[] = [
    {
      key: 'address', header: 'Address',
      render: (c) => <Link href={`/contracts/${c.address}`} className="font-mono text-sm">{c.address.slice(0, 10)}...{c.address.slice(-6)}</Link>,
    },
    { key: 'name', header: 'Name', render: (c) => c.name || '-' },
    { key: 'symbol', header: 'Symbol', render: (c) => c.symbol || '-' },
    { key: 'type', header: 'Type', render: (c) => c.contractType ? <span className="badge-neutral">{c.contractType}</span> : '-' },
    { key: 'creator', header: 'Creator', render: (c) => <AddressDisplay address={c.creator} /> },
    {
      key: 'verified', header: 'Verified',
      render: (c) => c.verified ? <span className="badge-success">Verified</span> : <span className="badge-neutral">No</span>,
    },
    { key: 'created', header: 'Created', render: (c) => <TimeAgo timestamp={c.createdAt} /> },
  ];

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <>
      <Head><title>Contracts | {EXPLORER_TITLE}</title></Head>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Smart Contracts</h1>
        {data?.contracts?.pageInfo && (
          <span className="text-sm text-[var(--color-text-muted)]">Total: {formatNumber(data.contracts.pageInfo.total)}</span>
        )}
      </div>
      <DataTable columns={columns} data={data?.contracts?.items ?? []} loading={loading} rowKey={(c) => c.address} />
      {data?.contracts?.pageInfo && <Pagination pageInfo={data.contracts.pageInfo} onPageChange={setOffset} />}
    </>
  );
}
