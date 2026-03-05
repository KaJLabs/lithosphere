import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useGraphQL } from '@/lib/graphql';
import { PROPOSAL_DETAIL } from '@/lib/queries';
import { EXPLORER_TITLE } from '@/lib/constants';
import { formatTimestamp, formatNumber } from '@/lib/format';
import type { Proposal } from '@/lib/types';
import { ProposalStatusBadge } from '@/components/Badges';
import AddressDisplay from '@/components/AddressDisplay';
import ErrorState from '@/components/ErrorState';
import Loading from '@/components/Loading';

export default function ProposalDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const { data, loading, error, refetch } = useGraphQL<{ proposal: Proposal }>(
    PROPOSAL_DETAIL, { id: id as string }, { skip: !id }
  );

  const p = data?.proposal;
  if (loading) return <Loading lines={10} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!p) return <ErrorState message="Proposal not found" />;

  const totalVotes = BigInt(p.yesVotes || '0') + BigInt(p.noVotes || '0') + BigInt(p.abstainVotes || '0') + BigInt(p.noWithVetoVotes || '0');
  const pct = (v: string) => totalVotes > 0 ? Number((BigInt(v || '0') * BigInt(10000)) / totalVotes) / 100 : 0;

  const voteCategories = [
    { label: 'Yes', value: p.yesVotes, pct: pct(p.yesVotes), color: 'bg-green-500', textColor: 'text-green-500' },
    { label: 'No', value: p.noVotes, pct: pct(p.noVotes), color: 'bg-red-500', textColor: 'text-red-500' },
    { label: 'Abstain', value: p.abstainVotes, pct: pct(p.abstainVotes), color: 'bg-gray-400', textColor: 'text-gray-400' },
    { label: 'No with Veto', value: p.noWithVetoVotes, pct: pct(p.noWithVetoVotes), color: 'bg-orange-500', textColor: 'text-orange-500' },
  ];

  return (
    <>
      <Head><title>Proposal #{p.id} | {EXPLORER_TITLE}</title></Head>

      <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] mb-6">
        <Link href="/" className="hover:text-litho-400">Home</Link><span>/</span>
        <Link href="/proposals" className="hover:text-litho-400">Proposals</Link><span>/</span>
        <span className="text-[var(--color-text-primary)]">#{p.id}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <span className="text-[var(--color-text-muted)] text-sm">Proposal #{p.id}</span>
          <h1 className="text-2xl font-bold">{p.title || 'Untitled Proposal'}</h1>
        </div>
        <ProposalStatusBadge status={p.status} />
      </div>

      {/* Info */}
      <div className="card p-6 mb-6">
        <div className="detail-row">
          <span className="detail-label">Type</span>
          <span className="detail-value">{p.proposalType || '-'}</span>
        </div>
        {p.proposer && (
          <div className="detail-row">
            <span className="detail-label">Proposer</span>
            <span className="detail-value"><AddressDisplay address={p.proposer} truncate={false} /></span>
          </div>
        )}
        {p.totalDeposit && (
          <div className="detail-row">
            <span className="detail-label">Total Deposit</span>
            <span className="detail-value font-mono">{formatNumber(p.totalDeposit)}</span>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Timeline</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-[var(--color-text-muted)] mb-1">Submit Time</div>
            <div>{p.submitTime ? formatTimestamp(p.submitTime) : '-'}</div>
          </div>
          <div>
            <div className="text-[var(--color-text-muted)] mb-1">Deposit End</div>
            <div>{p.depositEndTime ? formatTimestamp(p.depositEndTime) : '-'}</div>
          </div>
          <div>
            <div className="text-[var(--color-text-muted)] mb-1">Voting Start</div>
            <div>{p.votingStartTime ? formatTimestamp(p.votingStartTime) : '-'}</div>
          </div>
          <div>
            <div className="text-[var(--color-text-muted)] mb-1">Voting End</div>
            <div>{p.votingEndTime ? formatTimestamp(p.votingEndTime) : '-'}</div>
          </div>
        </div>
      </div>

      {/* Description */}
      {p.description && (
        <div className="card p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Description</h2>
          <div className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
            {p.description}
          </div>
        </div>
      )}

      {/* Vote Breakdown */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Vote Breakdown</h2>

        {/* Bar */}
        {totalVotes > 0 && (
          <div className="flex h-4 rounded-full overflow-hidden bg-[var(--color-bg-tertiary)] mb-6">
            {voteCategories.map((cat) => (
              cat.pct > 0 && <div key={cat.label} className={cat.color} style={{ width: `${cat.pct}%` }} />
            ))}
          </div>
        )}

        {/* Numbers */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {voteCategories.map((cat) => (
            <div key={cat.label} className="text-center">
              <div className={`text-2xl font-bold ${cat.textColor}`}>{cat.pct.toFixed(1)}%</div>
              <div className="text-sm text-[var(--color-text-muted)]">{cat.label}</div>
              <div className="text-xs font-mono text-[var(--color-text-secondary)]">{formatNumber(cat.value)}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
