import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useGraphQL } from '@/lib/graphql';
import { VALIDATORS } from '@/lib/queries';
import { EXPLORER_TITLE } from '@/lib/constants';
import { formatNumber } from '@/lib/format';
import type { Validator } from '@/lib/types';
import DataTable, { type Column } from '@/components/DataTable';
import { ValidatorStatusBadge } from '@/components/Badges';
import ErrorState from '@/components/ErrorState';

const FILTERS = [
  { label: 'All', value: undefined },
  { label: 'Active', value: 3 },
  { label: 'Inactive', value: 1 },
] as const;

type IndexedValidator = Validator & { _rank: number };

export default function ValidatorsPage() {
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined);

  const { data, loading, error, refetch } = useGraphQL<{ validators: Validator[] }>(
    VALIDATORS, { status: statusFilter, limit: 100 }
  );

  const validators: IndexedValidator[] = (data?.validators ?? []).map((v, i) => ({ ...v, _rank: i + 1 }));

  const columns: Column<IndexedValidator>[] = [
    {
      key: 'rank', header: '#',
      render: (v) => <span className="text-[var(--color-text-muted)]">{v._rank}</span>,
    },
    {
      key: 'moniker', header: 'Validator',
      render: (v) => (
        <Link href={`/validators/${v.operatorAddress}`} className="font-medium">
          {v.moniker || v.operatorAddress.slice(0, 16) + '...'}
        </Link>
      ),
    },
    {
      key: 'tokens', header: 'Voting Power',
      render: (v) => <span className="font-mono">{formatNumber(v.tokens)}</span>,
    },
    {
      key: 'commission', header: 'Commission',
      render: (v) => v.commissionRate ? `${(parseFloat(v.commissionRate) * 100).toFixed(1)}%` : '-',
    },
    {
      key: 'uptime', header: 'Uptime',
      render: (v) => v.uptimePercentage != null ? `${v.uptimePercentage.toFixed(1)}%` : '-',
    },
    {
      key: 'status', header: 'Status',
      render: (v) => <ValidatorStatusBadge status={v.status} jailed={v.jailed} />,
    },
  ];

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <>
      <Head><title>Validators | {EXPLORER_TITLE}</title></Head>
      <h1 className="text-2xl font-bold mb-6">Validators</h1>

      <div className="flex gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setStatusFilter(f.value)}
            className={statusFilter === f.value ? 'tab-active' : 'tab'}
          >
            {f.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={validators}
        loading={loading}
        rowKey={(v) => v.operatorAddress}
        emptyMessage="No validators found"
      />
    </>
  );
}
