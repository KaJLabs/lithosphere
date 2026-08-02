import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CHAIN_CONFIG } from '../../config/api';
import { usePageMeta, defaultExplorerDescription } from '../../hooks/usePageMeta';
import { fetchValidatorsPage } from '../../services/explorerDataService';
import {
  CopyableValue,
  EmptyState,
  ExplorerErrorState,
  LoadingSkeleton,
  MetricCard,
  PageHero,
  Panel,
  StatusBadge,
  VirtualizedTable
} from '../../components/explorer/ExplorerUI';
import { classifyExplorerError } from '../../helpers/explorerErrors';
import { getInteractiveRowProps } from '../../helpers/explorerInteraction';
import { formatNumber, formatPercent, formatTokenAmount } from '../../helpers/explorer';
import '../../scss/pages/Explorer/explorerPage.scss';

export const ValidatorList = () => {
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  usePageMeta('Validators', defaultExplorerDescription);

  const loadValidators = useCallback(async () => {
    try {
      const data = await fetchValidatorsPage();
      setPayload(data);
      setError(null);
    } catch (loadError) {
      setPayload(null);
      setError(classifyExplorerError(loadError, { resourceLabel: 'validator set' }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadValidators();
  }, [loadValidators]);

  const validators = payload?.items || [];
  const activeValidators = validators.filter((validator) => !validator.jailed && validator.status === 'BOND_STATUS_BONDED');
  const totalVotingPower = activeValidators.reduce((sum, validator) => sum + Number(validator.tokens || 0), 0);

  return (
    <div className="explorerPage">
      <PageHero
        eyebrow={CHAIN_CONFIG.networkLabel}
        title="Validators"
        description="Validator rankings with operator addresses, voting power, commission, uptime, and jailed or active state."
        actions={
          <>
            <a className="link-btn" href={CHAIN_CONFIG.validatorPortalUrl} target="_blank" rel="noreferrer">
              Validator Portal
            </a>
            <a className="link-btn" href={CHAIN_CONFIG.statusPageUrl} target="_blank" rel="noreferrer">
              Status Page
            </a>
          </>
        }
      />

      {error ? <ExplorerErrorState error={error} onRetry={loadValidators} /> : null}

      <div className="explorerStats compact explorerStats-three">
        <MetricCard label="Total Validators" value={formatNumber(validators.length)} subtext="All validator records" />
        <MetricCard label="Active Validators" value={formatNumber(activeValidators.length)} subtext="Bonded and not jailed" />
        <MetricCard label="Bonded Voting Power" value={`${formatTokenAmount(String(totalVotingPower))} ${CHAIN_CONFIG.denom}`} subtext="Current active set" />
      </div>

      <Panel title="Validator Set" description="Recent validator state from staking and slashing modules.">
        {loading && !validators.length ? (
          <LoadingSkeleton rows={8} />
        ) : !validators.length ? (
          <EmptyState title="No validators found" description="Validator data is unavailable from the current Kamet public endpoints." />
        ) : (
          <VirtualizedTable
            ariaLabel="Validator set"
            columns={['Validator', 'Operator', 'Voting Power', 'Commission', 'Uptime', 'Status']}
            items={validators}
            rowHeight={92}
            maxHeight={620}
            renderRow={(validator) => (
              <tr
                key={validator.operator_address}
                {...getInteractiveRowProps({
                  onActivate: () => navigate(`/validator/${validator.operator_address}`),
                  label: `Open validator ${validator.moniker || validator.operator_address}`
                })}
              >
                <td data-label="Validator">
                  <div className="tableCellStack">
                    <strong>{validator.moniker}</strong>
                    <span>{validator.description?.details || 'Validator metadata'}</span>
                  </div>
                </td>
                <td data-label="Operator">
                  <CopyableValue value={validator.operator_address} />
                </td>
                <td data-label="Power">
                  {formatTokenAmount(String(validator.tokens || 0))} {CHAIN_CONFIG.denom}
                </td>
                <td data-label="Commission">{(Number(validator.commission?.commission_rates?.rate || 0) * 100).toFixed(2)}%</td>
                <td data-label="Uptime">{formatPercent(validator.uptime || 0)}</td>
                <td data-label="Status">
                  <StatusBadge tone={validator.jailed ? 'failed' : 'success'}>
                    {validator.statusLabel}
                  </StatusBadge>
                </td>
              </tr>
            )}
          />
        )}
      </Panel>
    </div>
  );
};

export default ValidatorList;
