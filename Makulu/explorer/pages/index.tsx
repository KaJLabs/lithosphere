import Head from 'next/head';
import Link from 'next/link';
import { useGraphQL } from '@/lib/graphql';
import { CHAIN_SUMMARY, LATEST_BLOCKS, LATEST_TRANSACTIONS } from '@/lib/queries';
import { EXPLORER_TITLE, POLL_INTERVAL, HOMEPAGE_ITEMS } from '@/lib/constants';
import { formatNumber, formatBlockTime, truncateHash, truncateAddress, timeAgo } from '@/lib/format';
import type { ChainSummary, BlocksResult, TransactionsResult } from '@/lib/types';
import StatCard from '@/components/StatCard';
import { TxStatusBadge } from '@/components/Badges';
import { CardSkeleton } from '@/components/Loading';
import ErrorState from '@/components/ErrorState';

export default function Home() {
  const { data: summaryData, loading: summaryLoading, error: summaryError, refetch: refetchSummary } =
    useGraphQL<{ chainSummary: ChainSummary }>(CHAIN_SUMMARY, undefined, { pollInterval: POLL_INTERVAL });

  const { data: blocksData, loading: blocksLoading } =
    useGraphQL<{ blocks: BlocksResult }>(LATEST_BLOCKS, { limit: HOMEPAGE_ITEMS }, { pollInterval: POLL_INTERVAL });

  const { data: txsData, loading: txsLoading } =
    useGraphQL<{ transactions: TransactionsResult }>(LATEST_TRANSACTIONS, { limit: HOMEPAGE_ITEMS }, { pollInterval: POLL_INTERVAL });

  const summary = summaryData?.chainSummary;
  const blocks = blocksData?.blocks?.items ?? [];
  const txs = txsData?.transactions?.items ?? [];

  return (
    <>
      <Head>
        <title>{EXPLORER_TITLE} - Lithosphere Mainnet Explorer</title>
        <meta name="description" content="Explore blocks, transactions, validators, and smart contracts on the Lithosphere blockchain." />
      </Head>

      {/* Chain Summary Stats */}
      {summaryError ? (
        <ErrorState message={summaryError} onRetry={refetchSummary} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {summaryLoading ? (
            Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
          ) : (
            <>
              <StatCard
                label="Latest Block"
                value={`#${formatNumber(summary?.latestBlock)}`}
                icon={<BlockIcon />}
              />
              <StatCard
                label="Transactions"
                value={formatNumber(summary?.totalTransactions)}
                icon={<TxIcon />}
              />
              <StatCard
                label="Accounts"
                value={formatNumber(summary?.totalAccounts)}
                icon={<AccountIcon />}
              />
              <StatCard
                label="Validators"
                value={String(summary?.totalValidators ?? 0)}
                icon={<ValidatorIcon />}
              />
              <StatCard
                label="Contracts"
                value={formatNumber(summary?.totalContracts)}
                icon={<ContractIcon />}
              />
              <StatCard
                label="Block Time"
                value={formatBlockTime(summary?.avgBlockTime)}
                icon={<ClockIcon />}
              />
            </>
          )}
        </div>
      )}

      {/* Latest Blocks + Latest Transactions side by side */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Latest Blocks */}
        <div className="card">
          <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
            <h2 className="font-semibold">Latest Blocks</h2>
            <Link href="/blocks" className="text-sm text-litho-400 hover:text-litho-300">
              View all &rarr;
            </Link>
          </div>
          <div className="divide-y divide-[var(--color-border-light)]">
            {blocksLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 animate-pulse">
                  <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-1/2 mb-2" />
                  <div className="h-3 bg-[var(--color-bg-tertiary)] rounded w-3/4" />
                </div>
              ))
            ) : blocks.length === 0 ? (
              <div className="p-8 text-center text-[var(--color-text-muted)]">No blocks yet</div>
            ) : (
              blocks.map((block) => (
                <div key={block.height} className="p-4 hover:bg-[var(--color-bg-tertiary)] transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <Link href={`/blocks/${block.height}`} className="font-mono text-sm font-medium text-litho-400">
                      #{formatNumber(block.height)}
                    </Link>
                    <span className="text-xs text-[var(--color-text-muted)]">{timeAgo(block.blockTime)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                    <span>
                      {block.numTxs} txn{block.numTxs !== 1 ? 's' : ''}
                    </span>
                    {block.proposerAddress && (
                      <span className="font-mono">{truncateAddress(block.proposerAddress, 8, 4)}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Latest Transactions */}
        <div className="card">
          <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
            <h2 className="font-semibold">Latest Transactions</h2>
            <Link href="/txs" className="text-sm text-litho-400 hover:text-litho-300">
              View all &rarr;
            </Link>
          </div>
          <div className="divide-y divide-[var(--color-border-light)]">
            {txsLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 animate-pulse">
                  <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-1/2 mb-2" />
                  <div className="h-3 bg-[var(--color-bg-tertiary)] rounded w-3/4" />
                </div>
              ))
            ) : txs.length === 0 ? (
              <div className="p-8 text-center text-[var(--color-text-muted)]">No transactions yet</div>
            ) : (
              txs.map((tx) => (
                <div key={tx.id} className="p-4 hover:bg-[var(--color-bg-tertiary)] transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <Link href={`/txs/${tx.hash}`} className="font-mono text-sm text-litho-400">
                      {truncateHash(tx.hash)}
                    </Link>
                    <span className="text-xs text-[var(--color-text-muted)]">{timeAgo(tx.timestamp)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                    <span>
                      {tx.sender ? truncateAddress(tx.sender, 8, 4) : '—'}{' '}
                      <span className="text-[var(--color-text-muted)]">&rarr;</span>{' '}
                      {tx.receiver ? truncateAddress(tx.receiver, 8, 4) : '—'}
                    </span>
                    <TxStatusBadge success={tx.success} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function BlockIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
  );
}

function TxIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function ValidatorIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function ContractIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
