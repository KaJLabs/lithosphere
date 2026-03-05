import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useGraphQL } from '@/lib/graphql';
import { CONTRACT_DETAIL, TOKEN_TRANSFERS } from '@/lib/queries';
import { EXPLORER_TITLE, PAGE_SIZE } from '@/lib/constants';
import { formatNumber, formatTimestamp, truncateHash } from '@/lib/format';
import type { Contract, TokenTransfersResult, TokenTransfer } from '@/lib/types';
import DataTable, { type Column } from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import HashDisplay from '@/components/HashDisplay';
import AddressDisplay from '@/components/AddressDisplay';
import CopyButton from '@/components/CopyButton';
import TimeAgo from '@/components/TimeAgo';
import ErrorState from '@/components/ErrorState';
import Loading from '@/components/Loading';

export default function ContractDetailPage() {
  const router = useRouter();
  const { address } = router.query;
  const [transferOffset, setTransferOffset] = useState(0);

  const { data, loading, error, refetch } = useGraphQL<{ contract: Contract }>(
    CONTRACT_DETAIL, { address: address as string }, { skip: !address }
  );

  const { data: transferData, loading: transferLoading } = useGraphQL<{ tokenTransfers: TokenTransfersResult }>(
    TOKEN_TRANSFERS, { contractAddress: address as string, limit: PAGE_SIZE, offset: transferOffset },
    { skip: !address }
  );

  const contract = data?.contract;

  const transferCols: Column<TokenTransfer>[] = [
    { key: 'hash', header: 'Tx Hash', render: (t) => <Link href={`/txs/${t.txHash}`}><HashDisplay hash={t.txHash} /></Link> },
    { key: 'from', header: 'From', render: (t) => <AddressDisplay address={t.fromAddress} /> },
    { key: 'to', header: 'To', render: (t) => <AddressDisplay address={t.toAddress} /> },
    { key: 'value', header: 'Value', render: (t) => <span className="font-mono text-sm">{t.value}</span> },
    { key: 'tokenId', header: 'Token ID', render: (t) => t.tokenId || '-' },
    { key: 'block', header: 'Block', render: (t) => <Link href={`/blocks/${t.blockHeight}`} className="font-mono">{formatNumber(t.blockHeight)}</Link> },
    { key: 'time', header: 'Time', render: (t) => <TimeAgo timestamp={t.timestamp} /> },
  ];

  if (loading) return <Loading lines={8} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!contract) return <ErrorState message="Contract not found" />;

  return (
    <>
      <Head><title>Contract {truncateHash(contract.address)} | {EXPLORER_TITLE}</title></Head>

      <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] mb-6">
        <Link href="/" className="hover:text-litho-400">Home</Link><span>/</span>
        <Link href="/contracts" className="hover:text-litho-400">Contracts</Link><span>/</span>
        <span className="text-[var(--color-text-primary)] font-mono">{truncateHash(contract.address)}</span>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">{contract.name || 'Contract'}</h1>
        {contract.verified && <span className="badge-success">Verified</span>}
      </div>

      <div className="card p-6 mb-6">
        <div className="detail-row">
          <span className="detail-label">Address</span>
          <span className="detail-value font-mono break-all">{contract.address}<CopyButton text={contract.address} /></span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Creator</span>
          <span className="detail-value"><AddressDisplay address={contract.creator} truncate={false} /></span>
        </div>
        {contract.creationTx && (
          <div className="detail-row">
            <span className="detail-label">Creation Tx</span>
            <span className="detail-value"><Link href={`/txs/${contract.creationTx}`}><HashDisplay hash={contract.creationTx} /></Link></span>
          </div>
        )}
        {contract.creationBlock && (
          <div className="detail-row">
            <span className="detail-label">Creation Block</span>
            <span className="detail-value"><Link href={`/blocks/${contract.creationBlock}`} className="font-mono">{formatNumber(contract.creationBlock)}</Link></span>
          </div>
        )}
        {contract.symbol && (
          <div className="detail-row">
            <span className="detail-label">Symbol</span>
            <span className="detail-value font-semibold">{contract.symbol}</span>
          </div>
        )}
        {contract.decimals != null && (
          <div className="detail-row">
            <span className="detail-label">Decimals</span>
            <span className="detail-value">{contract.decimals}</span>
          </div>
        )}
        {contract.totalSupply && (
          <div className="detail-row">
            <span className="detail-label">Total Supply</span>
            <span className="detail-value font-mono">{formatNumber(contract.totalSupply)}</span>
          </div>
        )}
        {contract.contractType && (
          <div className="detail-row">
            <span className="detail-label">Type</span>
            <span className="detail-value"><span className="badge-neutral">{contract.contractType}</span></span>
          </div>
        )}
        <div className="detail-row border-b-0">
          <span className="detail-label">Created At</span>
          <span className="detail-value">{formatTimestamp(contract.createdAt)}</span>
        </div>
      </div>

      {/* Token Transfers */}
      <h2 className="text-lg font-semibold mb-4">Token Transfers</h2>
      <DataTable columns={transferCols} data={transferData?.tokenTransfers?.items ?? []} loading={transferLoading} rowKey={(t) => t.id} emptyMessage="No token transfers" />
      {transferData?.tokenTransfers?.pageInfo && <Pagination pageInfo={transferData.tokenTransfers.pageInfo} onPageChange={setTransferOffset} />}
    </>
  );
}
