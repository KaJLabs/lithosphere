import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useGraphQL } from '@/lib/graphql';
import { TOKEN_TRANSFERS } from '@/lib/queries';
import { EXPLORER_TITLE, PAGE_SIZE } from '@/lib/constants';
import { formatNumber } from '@/lib/format';
import type { TokenTransfersResult, TokenTransfer } from '@/lib/types';
import DataTable, { type Column } from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import HashDisplay from '@/components/HashDisplay';
import AddressDisplay from '@/components/AddressDisplay';
import TimeAgo from '@/components/TimeAgo';

export default function TokensPage() {
  const [offset, setOffset] = useState(0);
  const { data, loading } = useGraphQL<{ tokenTransfers: TokenTransfersResult }>(
    TOKEN_TRANSFERS, { limit: PAGE_SIZE, offset }
  );

  const columns: Column<TokenTransfer>[] = [
    {
      key: 'txHash', header: 'Tx Hash',
      render: (t) => <Link href={`/txs/${t.txHash}`}><HashDisplay hash={t.txHash} /></Link>,
    },
    {
      key: 'contract', header: 'Contract',
      render: (t) => <Link href={`/contracts/${t.contractAddress}`} className="font-mono text-sm">{t.contractAddress.slice(0, 10)}...{t.contractAddress.slice(-4)}</Link>,
    },
    { key: 'from', header: 'From', render: (t) => <AddressDisplay address={t.fromAddress} /> },
    { key: 'to', header: 'To', render: (t) => <AddressDisplay address={t.toAddress} /> },
    { key: 'value', header: 'Value', render: (t) => <span className="font-mono text-sm">{t.value}</span> },
    { key: 'tokenId', header: 'Token ID', render: (t) => t.tokenId || '-' },
    {
      key: 'block', header: 'Block',
      render: (t) => <Link href={`/blocks/${t.blockHeight}`} className="font-mono">{formatNumber(t.blockHeight)}</Link>,
    },
    { key: 'time', header: 'Time', render: (t) => <TimeAgo timestamp={t.timestamp} /> },
  ];

  return (
    <>
      <Head><title>Token Transfers | {EXPLORER_TITLE}</title></Head>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Token Transfers</h1>
        {data?.tokenTransfers?.pageInfo && (
          <span className="text-sm text-[var(--color-text-muted)]">
            Total: {formatNumber(data.tokenTransfers.pageInfo.total)}
          </span>
        )}
      </div>
      <DataTable columns={columns} data={data?.tokenTransfers?.items ?? []} loading={loading} rowKey={(t) => t.id} emptyMessage="No token transfers found" />
      {data?.tokenTransfers?.pageInfo && <Pagination pageInfo={data.tokenTransfers.pageInfo} onPageChange={setOffset} />}
    </>
  );
}
