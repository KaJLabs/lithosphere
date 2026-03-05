import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useApi } from '@/lib/api';
import { EXPLORER_TITLE } from '@/lib/constants';
import { formatNumber, truncateAddress } from '@/lib/format';
import type { ApiAddress, ApiTx } from '@/lib/types';
import DataTable, { type Column } from '@/components/DataTable';
import HashDisplay from '@/components/HashDisplay';
import CopyButton from '@/components/CopyButton';
import { TxStatusBadge } from '@/components/Badges';
import ErrorState from '@/components/ErrorState';
import Loading from '@/components/Loading';

export default function AddressPage() {
  const router = useRouter();
  const { address } = router.query;

  const { data: account, loading: accountLoading, error: accountError, refetch } =
    useApi<ApiAddress>(address ? `/address/${address}` : null);

  const { data: txs, loading: txsLoading } =
    useApi<ApiTx[]>(address ? `/address/${address}/txs?limit=25` : null);

  const txCols: Column<ApiTx>[] = [
    { key: 'hash', header: 'Tx Hash', render: (tx) => <Link href={`/txs/${tx.hash}`}><HashDisplay hash={tx.hash} /></Link> },
    { key: 'block', header: 'Block', render: (tx) => <Link href={`/blocks/${tx.blockHeight}`} className="font-mono text-litho-400">{formatNumber(tx.blockHeight)}</Link> },
    { key: 'from', header: 'From', render: (tx) => <span className="font-mono text-sm">{truncateAddress(tx.fromAddr)}</span> },
    { key: 'to', header: 'To', render: (tx) => <span className="font-mono text-sm">{truncateAddress(tx.toAddr)}</span> },
    { key: 'value', header: 'Value', render: (tx) => <span className="font-mono text-sm">{tx.value || '0'}</span> },
    { key: 'status', header: 'Status', render: (tx) => <TxStatusBadge success={tx.success} /> },
  ];

  if (accountLoading) return <Loading lines={8} />;
  if (accountError) return <ErrorState message={accountError} onRetry={refetch} />;
  if (!account) return <ErrorState message="Account not found" />;

  return (
    <>
      <Head><title>Address {truncateAddress(account.address)} | {EXPLORER_TITLE}</title></Head>

      <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] mb-6">
        <Link href="/" className="hover:text-litho-400">Home</Link><span>/</span>
        <span className="text-[var(--color-text-primary)]">Address</span>
      </div>

      <h1 className="text-2xl font-bold mb-6">Address</h1>

      <div className="card p-6 mb-6">
        <div className="detail-row">
          <span className="detail-label">Address</span>
          <span className="detail-value font-mono break-all">{account.address}<CopyButton text={account.address} /></span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Balance</span>
          <span className="detail-value font-semibold">{account.balance}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Transaction Count</span>
          <span className="detail-value">{formatNumber(account.txCount)}</span>
        </div>
        {account.lastSeen && (
          <div className="detail-row border-b-0">
            <span className="detail-label">Last Seen</span>
            <span className="detail-value">{account.lastSeen}</span>
          </div>
        )}
      </div>

      <h2 className="text-lg font-semibold mb-4">Transactions</h2>
      <DataTable
        columns={txCols}
        data={txs ?? []}
        loading={txsLoading}
        rowKey={(tx) => tx.hash}
        emptyMessage="No transactions found"
      />
    </>
  );
}
