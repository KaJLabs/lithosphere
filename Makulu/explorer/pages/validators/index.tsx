import Head from 'next/head';
import { useApi } from '@/lib/api';
import { EXPLORER_TITLE } from '@/lib/constants';
import type { ApiValidator } from '@/lib/types';
import DataTable, { type Column } from '@/components/DataTable';
import ErrorState from '@/components/ErrorState';

type IndexedValidator = ApiValidator & { _rank: number };

export default function ValidatorsPage() {
  const { data, loading, error, refetch } = useApi<ApiValidator[]>('/validators');

  const validators: IndexedValidator[] = (data ?? []).map((v, i) => ({ ...v, _rank: i + 1 }));

  const columns: Column<IndexedValidator>[] = [
    {
      key: 'rank', header: '#',
      render: (v) => <span className="text-[var(--color-text-muted)]">{v._rank}</span>,
    },
    {
      key: 'moniker', header: 'Validator',
      render: (v) => <span className="font-medium">{v.moniker || v.address?.slice(0, 16) + '...'}</span>,
    },
    {
      key: 'votingPower', header: 'Voting Power',
      render: (v) => <span className="font-mono">{v.votingPower}</span>,
    },
    {
      key: 'commission', header: 'Commission',
      render: (v) => v.commission || '-',
    },
    {
      key: 'status', header: 'Status',
      render: (v) => (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          v.status === 'active' || v.status === 'BOND_STATUS_BONDED'
            ? 'badge-success'
            : 'badge-neutral'
        }`}>
          {v.status}
        </span>
      ),
    },
  ];

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <>
      <Head><title>Validators | {EXPLORER_TITLE}</title></Head>
      <h1 className="text-2xl font-bold mb-6">Validators</h1>
      <DataTable
        columns={columns}
        data={validators}
        loading={loading}
        rowKey={(v) => v.address}
        emptyMessage="Validator data is not yet available. The indexer is still syncing validator information."
      />
    </>
  );
}
