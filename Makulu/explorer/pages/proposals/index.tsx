import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useGraphQL } from '@/lib/graphql';
import { PROPOSALS } from '@/lib/queries';
import { EXPLORER_TITLE } from '@/lib/constants';
import { formatNumber, timeAgo } from '@/lib/format';
import type { Proposal } from '@/lib/types';
import { ProposalStatusBadge } from '@/components/Badges';
import Loading from '@/components/Loading';
import ErrorState from '@/components/ErrorState';

const STATUS_TABS = [
  { label: 'All', value: undefined },
  { label: 'Voting', value: 'voting_period' },
  { label: 'Passed', value: 'passed' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Deposit', value: 'deposit_period' },
];

export default function ProposalsPage() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const { data, loading, error, refetch } = useGraphQL<{ proposals: Proposal[] }>(
    PROPOSALS, { status: statusFilter, limit: 50 }
  );

  const proposals = data?.proposals ?? [];

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <>
      <Head><title>Governance Proposals | {EXPLORER_TITLE}</title></Head>
      <h1 className="text-2xl font-bold mb-6">Governance Proposals</h1>

      {/* Status filter tabs */}
      <div className="flex border-b border-[var(--color-border)] mb-6">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => setStatusFilter(tab.value)}
            className={statusFilter === tab.value ? 'tab-active' : 'tab'}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading lines={6} />
      ) : proposals.length === 0 ? (
        <div className="card p-8 text-center text-[var(--color-text-muted)]">No proposals found</div>
      ) : (
        <div className="space-y-4">
          {proposals.map((p) => {
            const totalVotes = BigInt(p.yesVotes || '0') + BigInt(p.noVotes || '0') + BigInt(p.abstainVotes || '0') + BigInt(p.noWithVetoVotes || '0');
            const pct = (v: string) => totalVotes > 0 ? Number((BigInt(v || '0') * BigInt(10000)) / totalVotes) / 100 : 0;

            return (
              <Link key={p.id} href={`/proposals/${p.id}`} className="block">
                <div className="card p-5 hover:border-litho-400/40 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="text-[var(--color-text-muted)] text-sm">#{p.id}</span>
                      <h3 className="font-semibold text-lg">{p.title || 'Untitled Proposal'}</h3>
                    </div>
                    <ProposalStatusBadge status={p.status} />
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-[var(--color-text-secondary)] mb-3">
                    {p.proposalType && <span>Type: {p.proposalType}</span>}
                    {p.submitTime && <span>Submitted: {timeAgo(p.submitTime)}</span>}
                    {p.votingEndTime && <span>Voting ends: {timeAgo(p.votingEndTime)}</span>}
                  </div>

                  {/* Vote bar */}
                  {totalVotes > 0 && (
                    <div className="flex h-2 rounded-full overflow-hidden bg-[var(--color-bg-tertiary)]">
                      <div className="bg-green-500" style={{ width: `${pct(p.yesVotes)}%` }} title={`Yes: ${pct(p.yesVotes).toFixed(1)}%`} />
                      <div className="bg-red-500" style={{ width: `${pct(p.noVotes)}%` }} title={`No: ${pct(p.noVotes).toFixed(1)}%`} />
                      <div className="bg-gray-400" style={{ width: `${pct(p.abstainVotes)}%` }} title={`Abstain: ${pct(p.abstainVotes).toFixed(1)}%`} />
                      <div className="bg-orange-500" style={{ width: `${pct(p.noWithVetoVotes)}%` }} title={`Veto: ${pct(p.noWithVetoVotes).toFixed(1)}%`} />
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
