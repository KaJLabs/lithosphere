import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useGraphQL } from '@/lib/graphql';
import { EVM_TRANSACTION_DETAIL } from '@/lib/queries';
import { EXPLORER_TITLE } from '@/lib/constants';
import { formatNumber, formatTimestamp, truncateHash } from '@/lib/format';
import type { EvmTransaction } from '@/lib/types';
import HashDisplay from '@/components/HashDisplay';
import AddressDisplay from '@/components/AddressDisplay';
import { TxStatusBadge } from '@/components/Badges';
import ErrorState from '@/components/ErrorState';
import Loading from '@/components/Loading';

export default function EvmTransactionDetailPage() {
  const router = useRouter();
  const { hash } = router.query;
  const [showInput, setShowInput] = useState(false);

  const { data, loading, error, refetch } = useGraphQL<{ evmTransaction: EvmTransaction }>(
    EVM_TRANSACTION_DETAIL, { hash: hash as string }, { skip: !hash }
  );

  const tx = data?.evmTransaction;
  if (loading) return <Loading lines={10} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!tx) return <ErrorState message="EVM transaction not found" />;

  return (
    <>
      <Head><title>EVM Tx {truncateHash(tx.hash)} | {EXPLORER_TITLE}</title></Head>

      <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] mb-6">
        <Link href="/" className="hover:text-litho-400">Home</Link><span>/</span>
        <Link href="/evm-txs" className="hover:text-litho-400">EVM Transactions</Link><span>/</span>
        <span className="text-[var(--color-text-primary)] font-mono">{truncateHash(tx.hash)}</span>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">EVM Transaction Details</h1>
        <TxStatusBadge success={tx.status} />
      </div>

      <div className="card p-6">
        <div className="detail-row">
          <span className="detail-label">Transaction Hash</span>
          <span className="detail-value"><HashDisplay hash={tx.hash} full /></span>
        </div>
        {tx.cosmosTxHash && (
          <div className="detail-row">
            <span className="detail-label">Cosmos Tx Hash</span>
            <span className="detail-value">
              <Link href={`/txs/${tx.cosmosTxHash}`}><HashDisplay hash={tx.cosmosTxHash} /></Link>
            </span>
          </div>
        )}
        <div className="detail-row">
          <span className="detail-label">Block</span>
          <span className="detail-value">
            <Link href={`/blocks/${tx.blockHeight}`} className="font-mono">{formatNumber(tx.blockHeight)}</Link>
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Timestamp</span>
          <span className="detail-value">{formatTimestamp(tx.timestamp)}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">From</span>
          <span className="detail-value"><AddressDisplay address={tx.fromAddress} truncate={false} /></span>
        </div>
        <div className="detail-row">
          <span className="detail-label">To</span>
          <span className="detail-value"><AddressDisplay address={tx.toAddress} truncate={false} /></span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Value</span>
          <span className="detail-value font-mono">{tx.value || '0'}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Gas Price</span>
          <span className="detail-value font-mono">{tx.gasPrice || '-'}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Gas Limit / Used</span>
          <span className="detail-value font-mono">{tx.gasLimit || '-'} / {tx.gasUsed || '-'}</span>
        </div>
        {tx.nonce && (
          <div className="detail-row">
            <span className="detail-label">Nonce</span>
            <span className="detail-value font-mono">{tx.nonce}</span>
          </div>
        )}
        {tx.contractAddress && (
          <div className="detail-row">
            <span className="detail-label">Contract Created</span>
            <span className="detail-value">
              <Link href={`/contracts/${tx.contractAddress}`}><AddressDisplay address={tx.contractAddress} truncate={false} /></Link>
            </span>
          </div>
        )}
        {tx.inputData && tx.inputData !== '0x' && (
          <div className="detail-row border-b-0">
            <span className="detail-label">Input Data</span>
            <span className="detail-value">
              <button onClick={() => setShowInput(!showInput)} className="text-litho-400 text-sm mb-2">
                {showInput ? 'Hide' : 'Show'} input data ({tx.inputData.length} chars)
              </button>
              {showInput && (
                <pre className="mt-2 p-3 rounded bg-[var(--color-bg-tertiary)] text-xs overflow-x-auto max-h-64 font-mono break-all">
                  {tx.inputData}
                </pre>
              )}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
