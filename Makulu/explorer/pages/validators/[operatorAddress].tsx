import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useGraphQL } from '@/lib/graphql';
import { VALIDATOR_DETAIL } from '@/lib/queries';
import { EXPLORER_TITLE } from '@/lib/constants';
import { formatNumber, formatTimestamp } from '@/lib/format';
import type { Validator } from '@/lib/types';
import CopyButton from '@/components/CopyButton';
import { ValidatorStatusBadge } from '@/components/Badges';
import ErrorState from '@/components/ErrorState';
import Loading from '@/components/Loading';

export default function ValidatorDetailPage() {
  const router = useRouter();
  const { operatorAddress } = router.query;

  const { data, loading, error, refetch } = useGraphQL<{ validator: Validator }>(
    VALIDATOR_DETAIL, { operatorAddress: operatorAddress as string }, { skip: !operatorAddress }
  );

  const v = data?.validator;
  if (loading) return <Loading lines={10} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!v) return <ErrorState message="Validator not found" />;

  return (
    <>
      <Head><title>{v.moniker || 'Validator'} | {EXPLORER_TITLE}</title></Head>

      <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] mb-6">
        <Link href="/" className="hover:text-litho-400">Home</Link><span>/</span>
        <Link href="/validators" className="hover:text-litho-400">Validators</Link><span>/</span>
        <span className="text-[var(--color-text-primary)]">{v.moniker || 'Validator'}</span>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">{v.moniker || 'Unknown Validator'}</h1>
        <ValidatorStatusBadge status={v.status} jailed={v.jailed} />
      </div>

      {/* Info */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Validator Info</h2>
        <div className="detail-row">
          <span className="detail-label">Operator Address</span>
          <span className="detail-value font-mono break-all">{v.operatorAddress}<CopyButton text={v.operatorAddress} /></span>
        </div>
        {v.consensusAddress && (
          <div className="detail-row">
            <span className="detail-label">Consensus Address</span>
            <span className="detail-value font-mono break-all">{v.consensusAddress}<CopyButton text={v.consensusAddress} /></span>
          </div>
        )}
        {v.website && (
          <div className="detail-row">
            <span className="detail-label">Website</span>
            <span className="detail-value">
              <a href={v.website} target="_blank" rel="noopener noreferrer">{v.website}</a>
            </span>
          </div>
        )}
        {v.details && (
          <div className="detail-row border-b-0">
            <span className="detail-label">Details</span>
            <span className="detail-value">{v.details}</span>
          </div>
        )}
      </div>

      {/* Staking */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Staking</h2>
          <div className="detail-row">
            <span className="detail-label">Voting Power</span>
            <span className="detail-value font-mono font-semibold">{formatNumber(v.tokens)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Delegator Shares</span>
            <span className="detail-value font-mono">{formatNumber(v.delegatorShares)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Commission</span>
            <span className="detail-value">{v.commissionRate ? `${(parseFloat(v.commissionRate) * 100).toFixed(2)}%` : '-'}</span>
          </div>
          <div className="detail-row border-b-0">
            <span className="detail-label">Max Commission</span>
            <span className="detail-value">{v.commissionMaxRate ? `${(parseFloat(v.commissionMaxRate) * 100).toFixed(2)}%` : '-'}</span>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Performance</h2>
          <div className="detail-row">
            <span className="detail-label">Uptime</span>
            <span className="detail-value">
              {v.uptimePercentage != null ? (
                <span className={v.uptimePercentage > 95 ? 'text-green-500' : v.uptimePercentage > 80 ? 'text-yellow-500' : 'text-red-500'}>
                  {v.uptimePercentage.toFixed(2)}%
                </span>
              ) : '-'}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Missed Blocks</span>
            <span className="detail-value font-mono">{formatNumber(v.missedBlocksCounter)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Jailed</span>
            <span className="detail-value">{v.jailed ? <span className="text-red-500">Yes</span> : 'No'}</span>
          </div>
          <div className="detail-row border-b-0">
            <span className="detail-label">Last Updated</span>
            <span className="detail-value">{formatTimestamp(v.updatedAt)}</span>
          </div>
        </div>
      </div>
    </>
  );
}
