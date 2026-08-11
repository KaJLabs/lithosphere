import { useCallback, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers5';
import { useNavigate, useParams } from 'react-router-dom';
import { CHAIN_CONFIG } from '../../config/api';
import { useWallet } from '../../hooks/useWallet';
import { usePageMeta, defaultExplorerDescription } from '../../hooks/usePageMeta';
import {
  fetchContractPageData,
  runReadContractFunction
} from '../../services/explorerDataService';
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
  validateContractRouteParam
} from '../../helpers/explorerErrors';
import { formatNumber } from '../../helpers/explorer';
import '../../scss/pages/Explorer/explorerPage.scss';

const formatFragmentSignature = (fragment) => {
  try {
    return fragment.format(ethers.utils.FormatTypes.minimal);
  } catch {
    return fragment?.name || 'function';
  }
};

const getFragmentIdentifier = (fragment) => {
  try {
    return fragment.format(ethers.utils.FormatTypes.sighash);
  } catch {
    return fragment?.name || '';
  }
};

const parseFunctionArgument = (value, input) => {
  const normalized = String(value ?? '').trim();

  if (input?.type?.endsWith('[]')) {
    const parsed = JSON.parse(normalized || '[]');
    if (!Array.isArray(parsed)) {
      throw new Error(`Expected a JSON array for ${input.name || input.type}.`);
    }
    return parsed;
  }

  if (input?.type === 'bool') {
    if (/^(true|1)$/i.test(normalized)) {
      return true;
    }

    if (/^(false|0)$/i.test(normalized)) {
      return false;
    }

    throw new Error(`Expected true or false for ${input.name || input.type}.`);
  }

  if (/^u?int/.test(input?.type || '')) {
    return normalized || '0';
  }

  if ((input?.type || '').startsWith('tuple')) {
    return JSON.parse(normalized || '{}');
  }

  return normalized;
};

const formatExecutionResult = (result) => {
  if (result === undefined || result === null || result === '') {
    return '';
  }

  if (typeof result === 'string') {
    return result;
  }

  return JSON.stringify(result, null, 2);
};

const ContractFunctionCard = ({ fragment, mode, execute, actionLabel }) => {
  const [values, setValues] = useState({});
  const [payableValue, setPayableValue] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const inputs = Array.isArray(fragment.inputs) ? fragment.inputs : [];

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setPending(true);
      setError('');
      const args = inputs.map((input, index) =>
        parseFunctionArgument(values[`${input.name || input.type}-${index}`], input)
      );
      const output = await execute(fragment, args, payableValue);
      setResult(formatExecutionResult(output));
    } catch (executionError) {
      setError(executionError?.message || `Unable to ${mode === 'read' ? 'run read call' : 'submit contract write'}.`);
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="contractFunctionCard" onSubmit={handleSubmit}>
      <div className="contractFunctionCard-top">
        <strong>{fragment.name}</strong>
        <StatusBadge tone={mode === 'read' ? 'success' : 'info'}>{fragment.stateMutability || mode}</StatusBadge>
      </div>
      <code className="contractFunctionSignature">{formatFragmentSignature(fragment)}</code>

      {inputs.length ? (
        <div className="contractFunctionInputs">
          {inputs.map((input, index) => {
            const key = `${input.name || input.type}-${index}`;
            return (
              <label key={key} className="contractFunctionField">
                <span>{input.name || `arg${index + 1}`} ({input.type})</span>
                <input
                  type="text"
                  className="explorerSearchInput"
                  value={values[key] || ''}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [key]: event.target.value
                    }))
                  }
                  placeholder={input.type.endsWith('[]') ? '["value"]' : input.type === 'bool' ? 'true / false' : input.type}
                />
              </label>
            );
          })}
        </div>
      ) : (
        <div className="contractFunctionHint">No function arguments required.</div>
      )}

      {fragment.stateMutability === 'payable' ? (
        <label className="contractFunctionField">
          <span>Value (decimal LITHO)</span>
          <input
            type="text"
            className="explorerSearchInput"
            value={payableValue}
            onChange={(event) => setPayableValue(event.target.value)}
            placeholder="0"
          />
        </label>
      ) : null}

      <div className="contractFunctionActions">
        <button type="submit" className="secondary-btn" disabled={pending}>
          {pending ? 'Running...' : actionLabel}
        </button>
      </div>

      {error ? <div className="contractFunctionFeedback error">{error}</div> : null}
      {result ? <pre className="jsonPreview">{result}</pre> : null}
    </form>
  );
};

const ContractDetail = () => {
  const { address } = useParams();
  const navigate = useNavigate();
  const wallet = useWallet();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const networkReady = wallet.isConnected && Number(wallet.chainId) === Number(CHAIN_CONFIG.evmChainId);
  const prefetchWallet = () => {
    void wallet.prefetch?.();
  };

  usePageMeta(payload ? payload.name : 'Contract Detail', defaultExplorerDescription);

  const loadContract = useCallback(async () => {
    const validationError = validateContractRouteParam(address);

    if (validationError) {
      setPayload(null);
      setError(validationError);
      setLoading(false);
      return;
    }

    try {
      const data = await fetchContractPageData(address);
      setPayload(data);
      setError(
        data
          ? null
          : createNotFoundError(
              'Contract',
              'The requested contract does not currently expose bytecode on the public Kamet RPC.'
            )
      );
    } catch (loadError) {
      setPayload(null);
      setError(classifyExplorerError(loadError, { resourceLabel: 'contract' }));
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    setLoading(true);
    loadContract();
  }, [loadContract]);

  const eventSignatures = useMemo(
    () =>
      Array.isArray(payload?.events)
        ? payload.events.map((eventFragment) => {
            try {
              return eventFragment.format(ethers.utils.FormatTypes.minimal);
            } catch {
              return eventFragment?.name || 'event';
            }
          })
        : [],
    [payload]
  );

  const executeRead = useCallback(
    async (fragment, args) =>
      runReadContractFunction(payload.address, payload.abi, getFragmentIdentifier(fragment), args),
    [payload]
  );

  const executeWrite = useCallback(
    async (fragment, args, payableValue) => {
      if (!payload?.address || !payload?.abi?.length) {
        throw new Error('Contract ABI unavailable.');
      }

      if (!wallet.signer) {
        throw new Error('Connect a wallet on Kamet to submit write transactions.');
      }

      const contract = new ethers.Contract(payload.address, payload.abi, wallet.signer);
      const callArgs = [...args];

      if (fragment.stateMutability === 'payable' && payableValue) {
        callArgs.push({
          value: ethers.utils.parseEther(payableValue)
        });
      }

      const tx = await contract[getFragmentIdentifier(fragment)](...callArgs);
      return `Submitted transaction ${tx.hash}`;
    },
    [payload, wallet.signer]
  );

  return (
    <div className="explorerPage">
      <PageHero
        eyebrow="Contract Detail"
        title={payload?.name || 'Contract'}
        description="Verified-source status, ABI, creator, deployment transaction, read functions, write-function gating, and recent event logs."
        actions={
          <>
            <button type="button" className="secondary-btn" onClick={() => navigate('/contracts')}>
              Back to Contracts
            </button>
            <button type="button" className="secondary-btn" onClick={() => loadContract()}>
              Refresh
            </button>
            {payload?.knownContract?.symbol ? (
              <button
                type="button"
                className="secondary-btn"
                onClick={() => navigate(`/token/${payload.address}`)}
              >
                Open Token Page
              </button>
            ) : null}
          </>
        }
      />

      {error && !payload ? <ExplorerErrorState error={error} onRetry={loadContract} /> : null}

      {loading && !payload ? (
        <Panel title="Loading contract">
          <LoadingSkeleton rows={6} />
        </Panel>
      ) : !payload && !error ? (
        <EmptyState
          title="Contract not found"
          description="The requested contract does not currently expose bytecode on the public Kamet RPC."
        />
      ) : payload ? (
        <>
          <div className="explorerStats compact explorerStats-four">
            <MetricCard label="Verification" value={payload.verified ? 'Verified' : 'Unverified'} subtext={`Source: ${payload.verificationSource}`} tone={payload.verified ? 'success' : 'info'} />
            <MetricCard label="Read Functions" value={formatNumber(payload.readFunctions.length)} subtext="View and pure ABI methods" />
            <MetricCard label="Write Functions" value={formatNumber(payload.writeFunctions.length)} subtext="Wallet-gated state-changing methods" />
            <MetricCard label="Recent Events" value={formatNumber(payload.recentEvents.length)} subtext={`${formatNumber(eventSignatures.length)} known event signatures`} />
          </div>

          <div className="explorerGrid two-up">
            <Panel title="Identity">
              <div className="detailList">
                <div className="detailRow">
                  <span>Name</span>
                  <strong>{payload.name}</strong>
                </div>
                {payload.symbol ? (
                  <div className="detailRow">
                    <span>Symbol</span>
                    <strong>{payload.symbol}</strong>
                  </div>
                ) : null}
                <div className="detailRow">
                  <span>Type</span>
                  <StatusBadge tone={payload.verified ? 'success' : 'neutral'}>{payload.type}</StatusBadge>
                </div>
                <div className="detailRow multiLine">
                  <span>Contract Address</span>
                  <CopyableValue value={payload.address} preserve />
                </div>
                {payload.creator ? (
                  <div className="detailRow multiLine">
                    <span>Creator</span>
                    <CopyableValue value={payload.creator} preserve href={`/address/${payload.creator}`} />
                  </div>
                ) : null}
              </div>
            </Panel>

            <Panel title="Deployment">
              <div className="detailList">
                <div className="detailRow">
                  <span>Verified Source</span>
                  <StatusBadge tone={payload.verified ? 'success' : 'failed'}>
                    {payload.verified ? 'Verified' : 'Unverified'}
                  </StatusBadge>
                </div>
                <div className="detailRow">
                  <span>Verification Source</span>
                  <strong>{payload.verificationSource}</strong>
                </div>
                <div className="detailRow">
                  <span>Deployment Tx</span>
                  {payload.deploymentTx ? (
                    <button type="button" className="inlineLink" onClick={() => navigate(`/tx/${payload.deploymentTx}`)}>
                      View transaction
                    </button>
                  ) : (
                    <span>Unavailable</span>
                  )}
                </div>
                <div className="detailRow">
                  <span>Deployment Time</span>
                  {payload.deploymentTimestamp ? <TimestampValue value={payload.deploymentTimestamp} /> : <span>Unavailable</span>}
                </div>
                <div className="detailRow">
                  <span>Source Path</span>
                  <span>{payload.sourcePath || 'No source path published'}</span>
                </div>
              </div>
            </Panel>
          </div>

          <Panel title="Read Functions" description="Read-only calls execute against the public Kamet RPC.">
            {!payload.readFunctions.length ? (
              <EmptyState title="No read functions" description="No view or pure methods are available in the current ABI." />
            ) : (
              <div className="contractFunctionGrid">
                {payload.readFunctions.map((fragment) => (
                  <ContractFunctionCard
                    key={`read-${formatFragmentSignature(fragment)}`}
                    fragment={fragment}
                    mode="read"
                    execute={executeRead}
                    actionLabel="Run Read"
                  />
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Write Functions" description="Write interactions remain hidden until a wallet is connected on Kamet.">
            {!networkReady ? (
              <EmptyState
                title="Write UI locked"
                description="Connect a wallet and switch it to the Kamet network to enable production write-interaction controls."
                action={
                  <div className="inlineActionGroup">
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => wallet.connect().catch(() => null)}
                      onMouseEnter={prefetchWallet}
                      onFocus={prefetchWallet}
                      disabled={wallet.loading}
                    >
                      {wallet.loading ? 'Loading Wallet...' : 'Connect Wallet'}
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => wallet.switchToLithoChain().catch(() => null)}
                      onMouseEnter={prefetchWallet}
                      onFocus={prefetchWallet}
                      disabled={wallet.loading}
                    >
                      {wallet.loading ? 'Loading Wallet...' : 'Switch Network'}
                    </button>
                  </div>
                }
              />
            ) : !payload.writeFunctions.length ? (
              <EmptyState title="No write functions" description="No non-view methods are available in the current ABI." />
            ) : (
              <div className="contractFunctionGrid">
                {payload.writeFunctions.map((fragment) => (
                  <ContractFunctionCard
                    key={`write-${formatFragmentSignature(fragment)}`}
                    fragment={fragment}
                    mode="write"
                    execute={executeWrite}
                    actionLabel="Submit Write"
                  />
                ))}
              </div>
            )}
          </Panel>

          <div className="explorerGrid two-up">
            <Panel title="Recent Events" description="Recent decoded events for this contract on public Kamet logs.">
              {!payload.recentEvents.length ? (
                <EmptyState
                  title="No recent events"
                  description="No recent events were returned from the public log window."
                />
              ) : (
                <div className="eventList">
                  {payload.recentEvents.map((event) => (
                    <div key={`${event.txHash}-${event.blockHeight}`} className="eventCard">
                      <div className="eventHeader">{event.parsed?.name || 'Event'}</div>
                      <div className="eventBody">
                        <div className="eventAttribute">
                          <span>Transaction</span>
                          <code>{event.txHash}</code>
                        </div>
                        <div className="eventAttribute">
                          <span>Timestamp</span>
                          <code>{event.timestamp || '--'}</code>
                        </div>
                        {Object.entries(event.parsed?.values || {}).map(([key, value]) => (
                          <div key={key} className="eventAttribute">
                            <span>{key}</span>
                            <code>{String(value)}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="ABI & Source" description="Large payloads stay collapsed by default.">
              <details className="rawResponseDisclosure">
                <summary>ABI ({formatNumber(payload.abi.length)} entries)</summary>
                <pre className="jsonPreview">{JSON.stringify(payload.abi, null, 2)}</pre>
              </details>

              <details className="rawResponseDisclosure">
                <summary>Event Signatures ({formatNumber(eventSignatures.length)})</summary>
                {eventSignatures.length ? (
                  <div className="signatureList">
                    {eventSignatures.map((signature) => (
                      <code key={signature}>{signature}</code>
                    ))}
                  </div>
                ) : (
                  <div className="contractFunctionHint">No ABI event signatures available.</div>
                )}
              </details>

              <details className="rawResponseDisclosure">
                <summary>Source Code</summary>
                {payload.sourceCode ? (
                  <pre className="jsonPreview">{payload.sourceCode}</pre>
                ) : (
                  <div className="contractFunctionHint">No source code is published on the current public endpoints.</div>
                )}
              </details>
            </Panel>
          </div>
        </>
      ) : null}
    </div>
  );
};

export { ContractDetail };
export default ContractDetail;
