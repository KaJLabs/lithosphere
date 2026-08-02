import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CHAIN_CONFIG, CosmosAPI } from '../../config/api';
import { usePageMeta, defaultExplorerDescription } from '../../hooks/usePageMeta';
import { fetchValidatorPageData } from '../../services/explorerDataService';
import {
  CopyableValue,
  EmptyState,
  ExplorerErrorState,
  LoadingSkeleton,
  MetricCard,
  PageHero,
  Panel,
  StatusBadge,
  TimestampValue
} from '../../components/explorer/ExplorerUI';
import {
  classifyExplorerError,
  createNotFoundError,
  validateValidatorRouteParam
} from '../../helpers/explorerErrors';
import { getInteractiveRowProps } from '../../helpers/explorerInteraction';
import { formatNumber, formatTokenAmount } from '../../helpers/explorer';
import '../../scss/pages/Explorer/explorerPage.scss';

export const ValidatorDetail = () => {
  const { operator } = useParams();
  const navigate = useNavigate();
  const [validator, setValidator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  usePageMeta(validator ? validator.moniker : 'Validator Detail', defaultExplorerDescription);

  const loadValidator = useCallback(async () => {
    const validationError = validateValidatorRouteParam(operator);

    if (validationError) {
      setValidator(null);
      setError(validationError);
      setLoading(false);
      return;
    }

    try {
      const data = await fetchValidatorPageData(operator);
      setValidator(data);
      setError(
        data
          ? null
          : createNotFoundError(
              'Validator',
              'The requested operator address did not resolve from the public staking module.'
            )
      );
    } catch (loadError) {
      setValidator(null);
      setError(classifyExplorerError(loadError, { resourceLabel: 'validator' }));
    } finally {
      setLoading(false);
    }
  }, [operator]);

  useEffect(() => {
    setLoading(true);
    loadValidator();
  }, [loadValidator]);

  return (
    <div className="explorerPage">
      <PageHero
        eyebrow="Validator Detail"
        title={validator?.moniker || 'Validator'}
        description="Validator identity, voting power, commission, uptime, jailed state, and recent proposed blocks."
        actions={
          <>
            <button type="button" className="secondary-btn" onClick={() => navigate('/validators')}>
              Back to Validators
            </button>
            <button type="button" className="secondary-btn" onClick={() => loadValidator()}>
              Refresh
            </button>
            <a className="link-btn" href={CHAIN_CONFIG.validatorPortalUrl} target="_blank" rel="noreferrer">
              Validator Portal
            </a>
          </>
        }
      />

      {error && !validator ? <ExplorerErrorState error={error} onRetry={loadValidator} /> : null}

      {loading && !validator ? (
        <Panel title="Loading validator">
          <LoadingSkeleton rows={6} />
        </Panel>
      ) : !validator && !error ? (
        <EmptyState title="Validator not found" description="The requested operator address did not resolve from the public staking module." />
      ) : validator ? (
        <>
          <div className="explorerStats compact explorerStats-four">
            <MetricCard label="Voting Power" value={`${formatTokenAmount(String(validator.tokens || 0))} ${CHAIN_CONFIG.denom}`} subtext="Current bonded tokens" />
            <MetricCard label="Commission" value={validator.commissionLabel} subtext="Commission rate" />
            <MetricCard label="Uptime" value={validator.uptimeLabel} subtext="Derived from slashing info" />
            <MetricCard label="Status" value={validator.statusLabel} subtext={validator.jailed ? 'Jailed validator' : 'Active validator'} />
          </div>

          <div className="explorerGrid two-up">
            <Panel title="Identity">
              <div className="detailList">
                <div className="detailRow">
                  <span>Moniker</span>
                  <strong>{validator.moniker}</strong>
                </div>
                <div className="detailRow multiLine">
                  <span>Operator Address</span>
                  <CopyableValue value={validator.operator_address} preserve />
                </div>
                <div className="detailRow multiLine">
                  <span>Consensus Address</span>
                  <CopyableValue value={validator.consensusAddress || '--'} preserve />
                </div>
                <div className="detailRow">
                  <span>Status</span>
                  <StatusBadge tone={validator.jailed ? 'failed' : 'success'}>
                    {validator.statusLabel}
                  </StatusBadge>
                </div>
                {validator.description?.website ? (
                  <div className="detailRow">
                    <span>Website</span>
                    <a href={validator.description.website} target="_blank" rel="noreferrer">
                      {validator.description.website}
                    </a>
                  </div>
                ) : null}
                {validator.description?.security_contact ? (
                  <div className="detailRow">
                    <span>Security Contact</span>
                    <strong>{validator.description.security_contact}</strong>
                  </div>
                ) : null}
                {validator.description?.details ? (
                  <div className="detailRow">
                    <span>Details</span>
                    <span>{validator.description.details}</span>
                  </div>
                ) : null}
              </div>
            </Panel>

            <Panel title="Performance">
              <div className="detailList">
                <div className="detailRow">
                  <span>Voting Power</span>
                  <strong>{validator.votingPowerLabel} {CHAIN_CONFIG.denom}</strong>
                </div>
                <div className="detailRow">
                  <span>Commission</span>
                  <strong>{validator.commissionLabel}</strong>
                </div>
                <div className="detailRow">
                  <span>Uptime</span>
                  <strong>{validator.uptimeLabel}</strong>
                </div>
                <div className="detailRow">
                  <span>Missed Blocks</span>
                  <strong>{formatNumber(validator.missedBlocks || 0)}</strong>
                </div>
              </div>
            </Panel>
          </div>

          <Panel title="Validator Tooling" description="Public links for staking, commission, and validator operations.">
            <div className="detailList">
              <div className="detailRow">
                <span>Validator Portal</span>
                <a href={CHAIN_CONFIG.validatorPortalUrl} target="_blank" rel="noreferrer">
                  Open validator portal
                </a>
              </div>
              <div className="detailRow">
                <span>Staking API</span>
                <a
                  href={CosmosAPI.validatorByAddress(validator.operator_address)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open validator record
                </a>
              </div>
              <div className="detailRow">
                <span>Commission API</span>
                <a
                  href={CosmosAPI.validatorCommission(validator.operator_address)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open commission endpoint
                </a>
              </div>
              <div className="detailRow">
                <span>Status Page</span>
                <a href={CHAIN_CONFIG.statusPageUrl} target="_blank" rel="noreferrer">
                  Open network status
                </a>
              </div>
              {validator.consensusAddress ? (
                <div className="detailRow">
                  <span>Signing Info</span>
                  <a
                    href={CosmosAPI.signingInfoByAddress(validator.consensusAddress)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open slashing record
                  </a>
                </div>
              ) : null}
              <div className="detailRow">
                <span>Validator Set API</span>
                <a href={CosmosAPI.validatorSetLatest()} target="_blank" rel="noreferrer">
                  Open latest validator set
                </a>
              </div>
              <div className="detailRow">
                <span>Governance API</span>
                <a href={CosmosAPI.proposals()} target="_blank" rel="noreferrer">
                  Open governance proposals
                </a>
              </div>
              <div className="detailRow">
                <span>Docs</span>
                <a href={CHAIN_CONFIG.docsUrl} target="_blank" rel="noreferrer">
                  Open validator docs
                </a>
              </div>
              <div className="detailRow">
                <span>Setup Guide</span>
                <a href={CHAIN_CONFIG.setupGuideUrl} target="_blank" rel="noreferrer">
                  Open deployment guide
                </a>
              </div>
              <div className="detailRow">
                <span>Ecosystem</span>
                <a href={CHAIN_CONFIG.ecosystemUrl} target="_blank" rel="noreferrer">
                  Open ecosystem hub
                </a>
              </div>
            </div>
          </Panel>

          <Panel title="Recent Proposed Blocks" description="Recent blocks proposed by this validator in the current block window.">
            {!validator.recentBlocks?.length ? (
              <EmptyState title="No recent proposed blocks" description="No recent proposed blocks were found in the current public block window." />
            ) : (
              <div className="tableWrap">
                <table className="dataTable">
                  <thead>
                    <tr>
                      <th>Height</th>
                      <th>Hash</th>
                      <th>Transactions</th>
                      <th>Gas Used</th>
                      <th>Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validator.recentBlocks.map((block) => (
                      <tr
                        key={block.hash || block.height}
                        {...getInteractiveRowProps({
                          onActivate: () => navigate(`/block/${block.height}`),
                          label: `Open block ${block.height}`
                        })}
                      >
                        <td>{formatNumber(block.height)}</td>
                        <td>
                          <CopyableValue value={block.hash} />
                        </td>
                        <td>{formatNumber(block.txCount)}</td>
                        <td>{formatNumber(block.gasUsed)}</td>
                        <td>
                          <TimestampValue value={block.timestamp} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      ) : null}
    </div>
  );
};

export default ValidatorDetail;
