import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CHAIN_CONFIG } from '../../config/api';
import { usePageMeta, defaultExplorerDescription } from '../../hooks/usePageMeta';
import {
  EmptyState,
  ExplorerErrorState,
  LoadingSkeleton,
  MetricCard,
  PageHero,
  Panel,
  StatusBadge,
} from '../../components/explorer/ExplorerUI';
import { classifyExplorerError } from '../../helpers/explorerErrors';
import { getInteractiveRowProps } from '../../helpers/explorerInteraction';
import { fetchProposals, tallyPercent } from '../../services/governanceService';
import '../../scss/pages/Explorer/explorerPage.scss';
import '../../scss/pages/Governance/governancePage.scss';

const STATUS_FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'PROPOSAL_STATUS_VOTING_PERIOD', label: 'Voting' },
  { key: 'PROPOSAL_STATUS_PASSED', label: 'Passed' },
  { key: 'PROPOSAL_STATUS_REJECTED', label: 'Rejected' },
  { key: 'PROPOSAL_STATUS_DEPOSIT_PERIOD', label: 'Deposit' },
];

const STATUS_TONE = {
  voting: 'pending',
  passed: 'success',
  rejected: 'failed',
  failed: 'failed',
  deposit: 'warning',
  unknown: 'neutral',
};

const TallyBar = ({ tally }) => {
  const pct = tallyPercent(tally);
  return (
    <div className="governance-tally" title={`Yes ${pct.yes.toFixed(1)}% / No ${pct.no.toFixed(1)}% / Abstain ${pct.abstain.toFixed(1)}% / Veto ${pct.noWithVeto.toFixed(1)}%`}>
      <div className="governance-tally__yes" style={{ width: `${pct.yes}%` }} />
      <div className="governance-tally__no" style={{ width: `${pct.no}%` }} />
      <div className="governance-tally__abstain" style={{ width: `${pct.abstain}%` }} />
      <div className="governance-tally__veto" style={{ width: `${pct.noWithVeto}%` }} />
    </div>
  );
};

const formatDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
};

export const Governance = () => {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');

  usePageMeta('Governance', defaultExplorerDescription);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProposals(statusFilter);
      setProposals(data);
    } catch (err) {
      setProposals([]);
      setError(classifyExplorerError(err, { resourceLabel: 'governance proposals' }));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const voting = proposals.filter((p) => p.statusClass === 'voting').length;
  const passed = proposals.filter((p) => p.statusClass === 'passed').length;

  return (
    <div className="explorerPage">
      <PageHero
        eyebrow={CHAIN_CONFIG.networkLabel}
        title="Governance"
        description="On-chain governance proposals. Connect your wallet to vote on active proposals."
      />

      {error ? <ExplorerErrorState error={error} onRetry={load} /> : null}

      <div className="explorerStats compact explorerStats-three">
        <MetricCard label="Total Proposals" value={String(proposals.length)} subtext="All time" />
        <MetricCard label="Active Votes" value={String(voting)} subtext="Currently in voting period" />
        <MetricCard label="Passed" value={String(passed)} subtext="Proposals enacted" />
      </div>

      <Panel title="Proposals" description="Click a proposal to view details and cast your vote.">
        <div className="governance-filters">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`governance-filter-btn${statusFilter === f.key ? ' active' : ''}`}
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : proposals.length === 0 ? (
          <EmptyState title="No proposals found" description="No governance proposals match the selected filter." />
        ) : (
          <div className="governance-list">
            {proposals.map((p) => (
              <div
                key={p.id}
                className="governance-row"
                {...getInteractiveRowProps({
                  onActivate: () => navigate(`/governance/${p.id}`),
                  label: `Open proposal ${p.id}: ${p.title}`,
                })}
              >
                <div className="governance-row__id">#{p.id}</div>
                <div className="governance-row__main">
                  <div className="governance-row__title">{p.title}</div>
                  <div className="governance-row__meta">
                    <StatusBadge tone={STATUS_TONE[p.statusClass] || 'neutral'}>
                      {p.statusLabel}
                    </StatusBadge>
                    <span className="governance-row__date">
                      Voting ends {formatDate(p.votingEndTime)}
                    </span>
                  </div>
                  <TallyBar tally={p.tally} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
};

export default Governance;
