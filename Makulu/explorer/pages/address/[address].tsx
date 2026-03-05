import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useGraphQL } from '@/lib/graphql';
import { ACCOUNT_DETAIL, TRANSACTIONS_BY_ADDRESS, EVM_TRANSACTIONS_BY_ADDRESS } from '@/lib/queries';
import { EXPLORER_TITLE, PAGE_SIZE } from '@/lib/constants';
import { formatNumber, formatLitho, truncateAddress } from '@/lib/format';
import type { Account, TransactionsResult, EvmTransactionsResult, Transaction, EvmTransaction } from '@/lib/types';
import DataTable, { type Column } from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import HashDisplay from '@/components/HashDisplay';
import AddressDisplay from '@/components/AddressDisplay';
import CopyButton from '@/components/CopyButton';
import TimeAgo from '@/components/TimeAgo';
import { TxStatusBadge } from '@/components/Badges';
import ErrorState from '@/components/ErrorState';
import Loading from '@/components/Loading';

export default function AddressPage() {
  const router = useRouter();
  const { address } = router.query;
  const [activeTab, setActiveTab] = useState<'cosmos' | 'evm'>('cosmos');
  const [cosmosOffset, setCosmosOffset] = useState(0);
  const [evmOffset, setEvmOffset] = useState(0);

  const { data: accountData, loading: accountLoading, error: accountError, refetch } =
    useGraphQL<{ account: Account }>(ACCOUNT_DETAIL, { address: address as string }, { skip: !address });

  const { data: cosmosTxData, loading: cosmosTxLoading } =
    useGraphQL<{ transactionsByAddress: TransactionsResult }>(
      TRANSACTIONS_BY_ADDRESS, { address: address as string, limit: PAGE_SIZE, offset: cosmosOffset },
      { skip: !address || activeTab !== 'cosmos' }
    );

  const { data: evmTxData, loading: evmTxLoading } =
    useGraphQL<{ evmTransactionsByAddress: EvmTransactionsResult }>(
      EVM_TRANSACTIONS_BY_ADDRESS, { address: address as string, limit: PAGE_SIZE, offset: evmOffset },
      { skip: !address || activeTab !== 'evm' }
    );

  const account = accountData?.account;

  const cosmosCols: Column<Transaction>[] = [
    { key: 'hash', header: 'Tx Hash', render: (tx) => <Link href={`/txs/${tx.hash}`}><HashDisplay hash={tx.hash} /></Link> },
    { key: 'block', header: 'Block', render: (tx) => <Link href={`/blocks/${tx.blockHeight}`} className="font-mono">{formatNumber(tx.blockHeight)}</Link> },
    { key: 'type', header: 'Type', render: (tx) => <span className="badge-neutral">{tx.txType || '-'}</span> },
    { key: 'from', header: 'From', render: (tx) => <AddressDisplay address={tx.sender} /> },
    { key: 'to', header: 'To', render: (tx) => <AddressDisplay address={tx.receiver} /> },
    { key: 'status', header: 'Status', render: (tx) => <TxStatusBadge success={tx.success} /> },
    { key: 'time', header: 'Time', render: (tx) => <TimeAgo timestamp={tx.timestamp} /> },
  ];

  const evmCols: Column<EvmTransaction>[] = [
    { key: 'hash', header: 'Tx Hash', render: (tx) => <Link href={`/evm-txs/${tx.hash}`}><HashDisplay hash={tx.hash} /></Link> },
    { key: 'block', header: 'Block', render: (tx) => <Link href={`/blocks/${tx.blockHeight}`} className="font-mono">{formatNumber(tx.blockHeight)}</Link> },
    { key: 'from', header: 'From', render: (tx) => <AddressDisplay address={tx.fromAddress} /> },
    { key: 'to', header: 'To', render: (tx) => <AddressDisplay address={tx.toAddress} /> },
    { key: 'value', header: 'Value', render: (tx) => <span className="font-mono text-sm">{tx.value || '0'}</span> },
    { key: 'status', header: 'Status', render: (tx) => <TxStatusBadge success={tx.status} /> },
    { key: 'time', header: 'Time', render: (tx) => <TimeAgo timestamp={tx.timestamp} /> },
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

      {/* Account Info */}
      <div className="card p-6 mb-6">
        <div className="detail-row">
          <span className="detail-label">Cosmos Address</span>
          <span className="detail-value font-mono break-all">{account.address}<CopyButton text={account.address} /></span>
        </div>
        {account.evmAddress && (
          <div className="detail-row">
            <span className="detail-label">EVM Address</span>
            <span className="detail-value font-mono break-all">{account.evmAddress}<CopyButton text={account.evmAddress} /></span>
          </div>
        )}
        <div className="detail-row">
          <span className="detail-label">Balance</span>
          <span className="detail-value font-semibold">{formatLitho(account.balance)}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Transaction Count</span>
          <span className="detail-value">{formatNumber(account.txCount)}</span>
        </div>
        {account.accountType && (
          <div className="detail-row">
            <span className="detail-label">Account Type</span>
            <span className="detail-value">{account.accountType}</span>
          </div>
        )}
        {account.firstSeenBlock && (
          <div className="detail-row">
            <span className="detail-label">First Seen</span>
            <span className="detail-value">
              <Link href={`/blocks/${account.firstSeenBlock}`} className="font-mono">Block {formatNumber(account.firstSeenBlock)}</Link>
            </span>
          </div>
        )}
        {account.lastSeenBlock && (
          <div className="detail-row border-b-0">
            <span className="detail-label">Last Seen</span>
            <span className="detail-value">
              <Link href={`/blocks/${account.lastSeenBlock}`} className="font-mono">Block {formatNumber(account.lastSeenBlock)}</Link>
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)] mb-4">
        <button onClick={() => setActiveTab('cosmos')} className={activeTab === 'cosmos' ? 'tab-active' : 'tab'}>
          Cosmos Txs
        </button>
        {account.evmAddress && (
          <button onClick={() => setActiveTab('evm')} className={activeTab === 'evm' ? 'tab-active' : 'tab'}>
            EVM Txs
          </button>
        )}
      </div>

      {activeTab === 'cosmos' && (
        <>
          <DataTable columns={cosmosCols} data={cosmosTxData?.transactionsByAddress?.items ?? []} loading={cosmosTxLoading} rowKey={(tx) => tx.id} emptyMessage="No Cosmos transactions" />
          {cosmosTxData?.transactionsByAddress?.pageInfo && <Pagination pageInfo={cosmosTxData.transactionsByAddress.pageInfo} onPageChange={setCosmosOffset} />}
        </>
      )}

      {activeTab === 'evm' && (
        <>
          <DataTable columns={evmCols} data={evmTxData?.evmTransactionsByAddress?.items ?? []} loading={evmTxLoading} rowKey={(tx) => tx.id} emptyMessage="No EVM transactions" />
          {evmTxData?.evmTransactionsByAddress?.pageInfo && <Pagination pageInfo={evmTxData.evmTransactionsByAddress.pageInfo} onPageChange={setEvmOffset} />}
        </>
      )}
    </>
  );
}
