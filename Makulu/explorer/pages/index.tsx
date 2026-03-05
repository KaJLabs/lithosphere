import Head from 'next/head';
import Link from 'next/link';
import { useApi } from '@/lib/api';
import { EXPLORER_TITLE, POLL_INTERVAL } from '@/lib/constants';
import { formatNumber, timeAgo } from '@/lib/format';
import type { StatsSummary, TokenConfig, ApiBlock } from '@/lib/types';
import StatCard from '@/components/StatCard';
import { CardSkeleton } from '@/components/Loading';
import ErrorState from '@/components/ErrorState';

export default function Home() {
  const { data: stats, loading: statsLoading, error: statsError, refetch: refetchStats } =
    useApi<StatsSummary>('/stats/summary', { pollInterval: POLL_INTERVAL });

  const { data: config } = useApi<TokenConfig>('/config');

  const { data: blocks, loading: blocksLoading } =
    useApi<ApiBlock[]>('/blocks?limit=10', { pollInterval: POLL_INTERVAL });

  return (
    <>
      <Head>
        <title>{EXPLORER_TITLE} - Lithosphere Mainnet Explorer</title>
        <meta name="description" content="Explore blocks, transactions, validators, and smart contracts on the Lithosphere blockchain." />
      </Head>

      {/* Chain Summary Stats */}
      {statsError ? (
        <ErrorState message={statsError} onRetry={refetchStats} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {statsLoading ? (
            Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)
          ) : (
            <>
              <StatCard
                label="Tip Height"
                value={`#${formatNumber(stats?.tipHeight ?? 0)}`}
                icon={<BlockIcon />}
              />
              <StatCard
                label="TPS (1m)"
                value={String(stats?.tps1m ?? 0)}
                icon={<TxIcon />}
              />
              <StatCard
                label="TPS (5m)"
                value={String(stats?.tps5m ?? 0)}
                icon={<ClockIcon />}
              />
              <StatCard
                label="Token"
                value={config?.token?.symbol ?? 'LITHO'}
                icon={<CoinIcon />}
              />
              {config?.fiat?.price != null && (
                <StatCard
                  label={`Price (${config.fiat.symbol})`}
                  value={`$${config.fiat.price.toFixed(4)}`}
                  icon={<PriceIcon />}
                />
              )}
            </>
          )}
        </div>
      )}

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
          ) : !blocks || blocks.length === 0 ? (
            <div className="p-8 text-center text-[var(--color-text-muted)]">No blocks yet</div>
          ) : (
            blocks.map((block) => (
              <div key={block.height} className="p-4 hover:bg-[var(--color-bg-tertiary)] transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <Link href={`/blocks/${block.height}`} className="font-mono text-sm font-medium text-litho-400">
                    #{formatNumber(block.height)}
                  </Link>
                  <span className="text-xs text-[var(--color-text-muted)]">{timeAgo(block.timestamp)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                  <span>
                    {block.txCount} txn{block.txCount !== 1 ? 's' : ''}
                  </span>
                  <span className="font-mono">{block.hash?.slice(0, 16)}...</span>
                </div>
              </div>
            ))
          )}
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

function ClockIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CoinIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75m16.5 3.75v3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75" />
    </svg>
  );
}

function PriceIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
