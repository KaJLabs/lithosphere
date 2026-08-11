import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CHAIN_CONFIG } from '../../config/api';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useWallet } from '../../hooks/useWallet';
import {
  ExplorerErrorState,
  LoadingSkeleton,
  PageHero,
  Panel,
  StatusBadge,
} from '../../components/explorer/ExplorerUI';
import { classifyExplorerError } from '../../helpers/explorerErrors';
import { fetchProposalDetail, submitVote, tallyPercent, VOTE_OPTIONS } from '../../services/governanceService';
import '../../scss/pages/Explorer/explorerPage.scss';
import '../../scss/pages/Governance/governancePage.scss';

const STATUS_TONE = {
  voting: 'pending',
  passed: 'success',
  rejected: 'failed',
  failed: 'failed',
  deposit: 'warning',
  unknown: 'neutral',
};

const VOTE_LABELS = [
  { option: VOTE_OPTIONS.YES, label: 'Yes', cls: 'yes' },
  { option: VOTE_OPTIONS.NO, label: 'No', cls: 'no' },
  { option: VOTE_OPTIONS.ABSTAIN, label: 'Abstain', cls: 'abstain' },
  { option: VOTE_OPTIONS.NO_WITH_VETO, label: 'No with Veto', cls: 'veto' },
];

const formatDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const TallySection = ({ tally }) => {
  const pct = tallyPercent(tally);
  const bars = [
    { label: 'Yes', cls: 'yes', value: tally.yes, pct: pct.yes },
    { label: 'No', cls: 'no', value: tally.no, pct: pct.no },
    { label: 'Abstain', cls: 'abstain', value: tally.abstain, pct: pct.abstain },
    { label: 'No with Veto', cls: 'veto', value: tally.noWithVeto, pct: pct.noWithVeto },
  ];
  return (
    <div className="governance-tally-detail">
      {bars.map((b) => (
        <div key={b.cls} className="governance-tally-detail__row">
          <span className={`governance-tally-detail__label governance-tally-detail__label--${b.cls}`}>
            {b.label}
          </span>
          <div className="governance-tally-detail__bar-wrap">
            <div
              className={`governance-tally-detail__bar governance-tally-detail__bar--${b.cls}`}
              style={{ width: `${b.pct}%` }}
            />
          </div>
          <span className="governance-tally-detail__pct">{b.pct.toFixed(2)}%</span>
        </div>
      ))}
    </div>
  );
};

export const ProposalDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const wallet = useWallet();
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [voteState, setVoteState] = useState({ submitting: false, txHash: null, voteError: null });

  usePageMeta(proposal ? `Proposal #${id}: ${proposal.title}` : `Proposal #${id}`);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchProposalDetail(id);
      setProposal(data);
      setError(null);
    } catch (err) {
      setProposal(null);
      setError(classifyExplorerError(err, { resourceLabel: `proposal #${id}` }));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleVote = async (voteOption) => {
    setVoteState({ submitting: true, txHash: null, voteError: null });
    try {
      const txHash = await submitVote(wallet.signer, id, voteOption);
      setVoteState({ submitting: false, txHash, voteError: null });
    } catch (err) {
      setVoteState({ submitting: false, txHash: null, voteError: err.message || 'Vote failed' });
    }
  };

  const isVotingOpen = proposal?.statusClass === 'voting';
  const wrongChain = wallet.isConnected && wallet.chainId !== CHAIN_CONFIG.evmChainId;

  return (
    <div className="explorerPage">
      <button type="button" className="governance-back-btn" onClick={() => navigate('/governance')}>
        ← All Proposals
      </button>

      {loading && <LoadingSkeleton rows={8} />}
      {error && <ExplorerErrorState error={error} onRetry={load} />}

      {proposal && (
        <>
          <PageHero
            eyebrow={`Proposal #${proposal.id}`}
            title={proposal.title}
            description={
              <StatusBadge tone={STATUS_TONE[proposal.statusClass] || 'neutral'}>
                {proposal.statusLabel}
              </StatusBadge>
            }
          />

          <div className="governance-detail-grid">
            <Panel title="Tally" description="Current vote distribution">
              <TallySection tally={proposal.tally} />
            </Panel>

            <Panel title="Timeline">
              <div className="governance-meta">
                <div className="governance-meta__row">
                  <span>Submitted</span>
                  <span>{formatDate(proposal.submitTime)}</span>
                </div>
                <div className="governance-meta__row">
                  <span>Voting Opens</span>
                  <span>{formatDate(proposal.votingStartTime)}</span>
                </div>
                <div className="governance-meta__row">
                  <span>Voting Closes</span>
                  <span>{formatDate(proposal.votingEndTime)}</span>
                </div>
                <div className="governance-meta__row">
                  <span>Type</span>
                  <span className="governance-meta__type">{proposal.type.split('.').pop()}</span>
                </div>
              </div>
            </Panel>
          </div>

          {proposal.description && (
            <Panel title="Description">
              <div className="governance-description">{proposal.description}</div>
            </Panel>
          )}

          <Panel title="Cast Your Vote">
            {!isVotingOpen ? (
              <p className="governance-vote-closed">This proposal is no longer open for voting.</p>
            ) : voteState.txHash ? (
              <div className="governance-vote-success">
                <p>Vote submitted successfully.</p>
                <p className="governance-vote-txhash">TX: {voteState.txHash}</p>
              </div>
            ) : !wallet.isConnected ? (
              <div className="governance-vote-actions">
                <p>Connect your wallet to vote on this proposal.</p>
                <button type="button" className="btn-primary" onClick={() => wallet.connect()}>
                  Connect Wallet
                </button>
              </div>
            ) : wrongChain ? (
              <div className="governance-vote-actions">
                <p>Switch to {CHAIN_CONFIG.chainName} to vote.</p>
                <button type="button" className="btn-primary" onClick={() => wallet.switchToLithoChain()}>
                  Switch to Kamet
                </button>
              </div>
            ) : (
              <div className="governance-vote-actions">
                {voteState.voteError && (
                  <p className="governance-vote-error">{voteState.voteError}</p>
                )}
                {VOTE_LABELS.map(({ option, label, cls }) => (
                  <button
                    key={option}
                    type="button"
                    className={`governance-vote-btn governance-vote-btn--${cls}`}
                    disabled={voteState.submitting}
                    onClick={() => handleVote(option)}
                  >
                    {voteState.submitting ? '...' : label}
                  </button>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
};

export default ProposalDetail;
