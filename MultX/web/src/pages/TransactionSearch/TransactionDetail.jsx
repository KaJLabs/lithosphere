import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CHAIN_CONFIG } from '../../config/api';
import { usePageMeta, defaultExplorerDescription } from '../../hooks/usePageMeta';
import { fetchTransactionDetailByHash, fetchDecodedLogsForTx } from '../../services/explorerDataService';
import { KAMET_KNOWN_CONTRACTS_BY_ADDRESS } from '../../data/kametRegistry';
import { DEX_CONFIG } from '../../data/dexConfig';
import {
  CopyableValue,
  EmptyState,
  ExplorerErrorState,
  LoadingSkeleton,
  PageHero,
  Panel,
  StatusBadge,
  TimestampValue
} from '../../components/explorer/ExplorerUI';
import { AddressWithName } from '../../components/explorer/AddressWithName';
import {
  classifyExplorerError,
  createNotFoundError,
  validateTransactionRouteParam
} from '../../helpers/explorerErrors';
import {
  extractFee,
  extractTxAmount,
  extractTxParticipants,
  formatCoinSmart,
  formatFeeCoin,
  formatGasPrice,
  formatNumber,
  formatTokenAmount,
  normalizeTxHash,
  parseHexNumber,
  toEvmHash
} from '../../helpers/explorer';
import '../../scss/pages/Explorer/explorerPage.scss';

// ERC-20 Transfer(address,address,uint256)
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
// Uniswap v3 Swap(address,address,int256,int256,uint160,uint128,int24)
const UNI_V3_SWAP_TOPIC = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67';

// Cosmos events and proto type URIs carry the upstream `ethermint`/`Ethereum`
// naming. Project policy is to surface Lithosphere terminology only.
const TYPE_URI_REWRITES = [
  [/^\/?ethermint\.evm\.v1\.MsgEthereumTx$/, 'LithosphereTx'],
  [/^\/?ethermint\.evm\.v1\./, ''],
  [/MsgEthereumTx/g, 'LithosphereTx'],
  [/\bethereum_tx\b/g, 'lithosphere_tx'],
  [/\bethereumTxHash\b/g, 'txHash'],
];

const scrubTypeUri = (value) => {
  if (value === null || value === undefined) return value;
  let out = String(value);
  for (const [pattern, replacement] of TYPE_URI_REWRITES) {
    out = out.replace(pattern, replacement);
  }
  return out;
};

const lookupTokenMeta = (address) => {
  if (!address) return null;
  const entry = KAMET_KNOWN_CONTRACTS_BY_ADDRESS.get(String(address).toLowerCase());
  if (!entry) return null;
  return {
    address: entry.address || address,
    symbol: entry.symbol || '',
    name: entry.name || '',
    decimals: entry.decimals ?? 18
  };
};

const topicToAddress = (topic) => {
  const hex = String(topic || '').toLowerCase();
  if (!hex.startsWith('0x') || hex.length < 42) return '';
  return '0x' + hex.slice(-40);
};

const parseInt256Hex = (slot) => {
  const big = BigInt(slot);
  const negThreshold = 1n << 255n;
  return big >= negThreshold ? big - (1n << 256n) : big;
};

const decodeReceiptLog = (log) => {
  const topics = Array.isArray(log?.topics) ? log.topics : [];
  if (!topics.length) return null;
  const topic0 = String(topics[0] || '').toLowerCase();
  const emitter = String(log?.address || '').toLowerCase();

  if (topic0 === TRANSFER_TOPIC && topics.length >= 3) {
    const meta = lookupTokenMeta(emitter);
    const from = topicToAddress(topics[1]);
    const to = topicToAddress(topics[2]);
    let valueRaw;
    try { valueRaw = BigInt(log.data || '0x0').toString(); } catch { valueRaw = '0'; }
    return {
      kind: 'transfer',
      name: meta?.symbol ? `Transfer (${meta.symbol})` : 'Transfer',
      emitter,
      tokenMeta: meta,
      values: {
        token: meta ? `${meta.symbol} — ${emitter}` : emitter,
        from,
        to,
        value: meta
          ? formatTokenValue(valueRaw, meta.decimals, meta.symbol)
          : `${valueRaw} (raw — decimals unknown)`
      }
    };
  }

  if (topic0 === UNI_V3_SWAP_TOPIC && topics.length >= 3) {
    const data = String(log.data || '0x').replace(/^0x/, '');
    if (data.length < 64 * 5) return null;
    const slot = (i) => '0x' + data.slice(i * 64, (i + 1) * 64);
    let amount0, amount1, sqrtPriceX96, liquidity, tick;
    try {
      amount0 = parseInt256Hex(slot(0));
      amount1 = parseInt256Hex(slot(1));
      sqrtPriceX96 = BigInt(slot(2));
      liquidity = BigInt(slot(3));
      tick = parseInt256Hex(slot(4));
    } catch { return null; }
    return {
      kind: 'swap',
      name: 'Swap (Uniswap v3)',
      emitter,
      values: {
        pool: emitter,
        sender: topicToAddress(topics[1]),
        recipient: topicToAddress(topics[2]),
        amount0: amount0.toString(),
        amount1: amount1.toString(),
        sqrtPriceX96: sqrtPriceX96.toString(),
        liquidity: liquidity.toString(),
        tick: tick.toString()
      }
    };
  }

  return null;
};

const buildSwapSummary = (decodedReceiptLogs, txFromAddress) => {
  const swap = decodedReceiptLogs.find((entry) => entry.kind === 'swap');
  if (!swap) return null;
  const transfers = decodedReceiptLogs.filter((entry) => entry.kind === 'transfer' && entry.tokenMeta);
  const sender = String(txFromAddress || '').toLowerCase();
  const sentTransfer = transfers.find((t) => String(t.values.from || '').toLowerCase() === sender);
  const receivedTransfer = transfers.find((t) => String(t.values.to || '').toLowerCase() === sender);
  if (!sentTransfer || !receivedTransfer) return null;
  return {
    pool: swap.emitter,
    sentSymbol: sentTransfer.tokenMeta?.symbol || '',
    sentAmount: sentTransfer.values.value,
    receivedSymbol: receivedTransfer.tokenMeta?.symbol || '',
    receivedAmount: receivedTransfer.values.value
  };
};

const formatEvmValue = (value) => {
  try {
    const normalizedValue = value === undefined || value === null ? '0' : String(value);
    const decimalValue = normalizedValue.startsWith('0x')
      ? BigInt(normalizedValue).toString()
      : normalizedValue;

    return `${formatTokenAmount(decimalValue)} ${CHAIN_CONFIG.denom}`;
  } catch {
    return `0 ${CHAIN_CONFIG.denom}`;
  }
};

const computeFee = (gasUsed, gasPrice) => {
  try {
    return formatGasPrice((BigInt(gasUsed || '0x0') * BigInt(gasPrice || '0x0')).toString(), 'strat');
  } catch {
    return '--';
  }
};

const DecodedInputPanel = ({ decodedInput, rawInput }) => {
  if (decodedInput) {
    return (
      <div className="eventList">
        <div className="eventCard">
          <div className="eventHeader">{decodedInput.name}</div>
          <div className="eventBody">
            <div className="eventAttribute">
              <span>Signature</span>
              <code>{decodedInput.signature}</code>
            </div>
            {Object.entries(decodedInput.args || {}).map(([key, value]) => (
              <div key={key} className="eventAttribute">
                <span>{key}</span>
                <code>{String(value)}</code>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!rawInput || rawInput === '0x') {
    return <EmptyState title="No input data" description="This looks like a native transfer or a message without calldata." />;
  }

  return <pre className="jsonPreview">{rawInput}</pre>;
};

const formatTokenValue = (rawValue, decimals = 18, symbol = '') => {
  try {
    const d = Number(decimals) || 18;
    const divisor = BigInt(10) ** BigInt(d);
    const big = BigInt(rawValue);
    const whole = big / divisor;
    const frac = big % divisor;
    const fracStr = frac.toString().padStart(d, '0').replace(/0+$/, '');
    const display = fracStr ? `${whole}.${fracStr.slice(0, 6)}` : whole.toString();
    return symbol ? `${display} ${symbol}` : display;
  } catch {
    return String(rawValue);
  }
};

const RenderEventList = ({ isEvm, txResponse, decodedLogs, knownToken }) => {
  if (isEvm) {
    // Per-log decode against the actual emitter address — required for swaps
    // and any tx that touches multiple ERC-20s. Falls back to raw display when
    // the topic isn't one we know how to decode.
    const rawLogs = Array.isArray(txResponse?.logs) ? txResponse.logs : [];
    const receiptDecoded = rawLogs.map((log, index) => ({
      log,
      index,
      decoded: decodeReceiptLog(log)
    }));

    if (decodedLogs?.length) {
      return (
        <div className="eventList">
          {decodedLogs.map((event) => (
            <div key={`${event.txHash}-${event.blockHeight}`} className="eventCard">
              <div className="eventHeader">{event.parsed?.name || 'Event'}</div>
              <div className="eventBody">
                {Object.entries(event.parsed?.values || {}).map(([key, value]) => {
                  const isTransferValue = event.parsed?.name === 'Transfer' && key === 'value' && knownToken;
                  const display = isTransferValue
                    ? formatTokenValue(value, knownToken.decimals ?? 18, knownToken.symbol || '')
                    : String(value);
                  return (
                    <div key={key} className="eventAttribute">
                      <span>{key}</span>
                      <code>{display}</code>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (!rawLogs.length) {
      return (
        <EmptyState
          title="No logs"
          description="No logs were emitted for this transaction or no ABI is known for decoding."
        />
      );
    }

    return (
      <div className="eventList">
        {receiptDecoded.map(({ log, index, decoded }) => {
          const logKey = `${log.transactionHash || log.logIndex || index}-${index}`;
          const logIdx = parseHexNumber(log.logIndex);
          const header = decoded
            ? `Log #${logIdx ?? index} — ${decoded.name}`
            : `Log #${logIdx ?? index}`;
          return (
            <div key={logKey} className="eventCard">
              <div className="eventHeader">{header}</div>
              <div className="eventBody">
                <div className="eventAttribute">
                  <span>Address</span>
                  <code>{log.address || '--'}</code>
                </div>
                {decoded
                  ? Object.entries(decoded.values).map(([key, value]) => (
                      <div key={key} className="eventAttribute">
                        <span>{key}</span>
                        <code>{String(value)}</code>
                      </div>
                    ))
                  : (
                      <>
                        <div className="eventAttribute">
                          <span>Topics</span>
                          <code>{Array.isArray(log.topics) ? log.topics.join(', ') : '--'}</code>
                        </div>
                        <div className="eventAttribute">
                          <span>Data</span>
                          <code>{log.data || '0x'}</code>
                        </div>
                      </>
                    )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const events = txResponse?.events || [];

  if (!events.length) {
    return <EmptyState title="No events" description="No events were indexed for this transaction." />;
  }

  const EVENT_ATTR_LABELS = {
    ethereumTxHash: 'txHash',
  };

  return (
    <div className="eventList">
      {events.map((event, index) => (
        <div key={`${event.type}-${index}`} className="eventCard">
          <div className="eventHeader">{scrubTypeUri(event.type)}</div>
          <div className="eventBody">
            {(event.attributes || []).map((attribute, attributeIndex) => {
              const rawValue = attribute.value || '';
              // Only the explicit `fee` attribute renders in Strat (matches the Fee row above).
              // `amount` keys render as LITHO via formatCoinSmart so user transfers display
              // their natural unit (e.g. "50 LITHO"), not as huge Strat numbers.
              const display = attribute.key === 'fee'
                ? formatFeeCoin(rawValue)
                : attribute.key === 'amount'
                  ? formatCoinSmart(rawValue)
                  : scrubTypeUri(rawValue);
              const label = EVENT_ATTR_LABELS[attribute.key] || attribute.key;
              return (
                <div key={`${attribute.key}-${attributeIndex}`} className="eventAttribute">
                  <span>{label}</span>
                  <code>{display}</code>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export const TransactionDetail = () => {
  const { hash } = useParams();
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('cosmos');

  const txResponse = payload?.txResponse || null;
  const isEvm = payload?.isEvm;
  const normalizedHash = useMemo(() => normalizeTxHash(hash || ''), [hash]);
  const evmHash = useMemo(() => toEvmHash(hash || ''), [hash]);

  const hasBothViews = isEvm && !!payload?.cosmosTxResponse;
  const displayIsEvm = hasBothViews ? activeTab === 'evm' : isEvm;
  const displayTx = hasBothViews && activeTab === 'cosmos' ? payload.cosmosTxResponse : txResponse;
  const participants = useMemo(() => extractTxParticipants(displayTx), [displayTx]);

  const decodedReceiptLogs = useMemo(() => {
    if (!isEvm) return [];
    const logs = Array.isArray(txResponse?.logs) ? txResponse.logs : [];
    return logs.map((log) => decodeReceiptLog(log)).filter(Boolean);
  }, [isEvm, txResponse]);

  const swapSummary = useMemo(
    () => buildSwapSummary(decodedReceiptLogs, txResponse?.from),
    [decodedReceiptLogs, txResponse]
  );

  const isSwapRouterTx = useMemo(() => {
    const to = String(txResponse?.to || '').toLowerCase();
    const router = String(DEX_CONFIG?.swapRouter || '').toLowerCase();
    return Boolean(isEvm && to && router && to === router);
  }, [isEvm, txResponse]);

  const heroTitle = hasBothViews
    ? activeTab === 'cosmos'
      ? 'Transaction'
      : (swapSummary && 'Swap') || payload?.decodedInput?.name || payload?.knownContract?.name || (isSwapRouterTx ? 'Swap' : 'Lithosphere Tx')
    : (swapSummary && 'Swap') || payload?.decodedInput?.name || payload?.knownContract?.name || (isSwapRouterTx ? 'Swap' : (isEvm ? 'Lithosphere Tx' : 'Transaction'));

  usePageMeta(
    hash ? `Tx ${shortenHash(hash)}` : 'Transaction Detail',
    defaultExplorerDescription
  );

  const loadTransaction = useCallback(async () => {
    const validationError = validateTransactionRouteParam(hash);

    if (validationError) {
      setPayload(null);
      setError(validationError);
      setLoading(false);
      return;
    }

    try {
      const data = await fetchTransactionDetailByHash(hash);
      setPayload(data);
      setError(
        data
          ? null
          : createNotFoundError(
              'Transaction',
              'The requested transaction hash did not resolve on the current public endpoints.'
            )
      );

      // Lazy-load the enriched contract-events panel after first paint. The
      // receipt logs already render via RenderEventList's fallback path, so
      // this only adds cross-tx context (timestamps, parsed signatures). A
      // failure here must not surface as a page-level error.
      if (data?.decodedLogsPending && data?.txResponse?.to) {
        fetchDecodedLogsForTx(hash, data.txResponse.to)
          .then((decodedLogs) => {
            setPayload((current) =>
              current ? { ...current, decodedLogs, decodedLogsPending: false } : current
            );
          })
          .catch(() => {
            setPayload((current) =>
              current ? { ...current, decodedLogsPending: false } : current
            );
          });
      }
    } catch (loadError) {
      setPayload(null);
      setError(classifyExplorerError(loadError, { resourceLabel: 'transaction' }));
    } finally {
      setLoading(false);
    }
  }, [hash]);

  useEffect(() => {
    setActiveTab('cosmos');
  }, [hash]);

  useEffect(() => {
    setLoading(true);
    loadTransaction();
  }, [loadTransaction]);

  return (
    <div className="explorerPage">
      <PageHero
        eyebrow="Transaction Detail"
        title={heroTitle}
        description="Review status, block inclusion, participants, gas usage, logs, raw input, and decoded calldata when an ABI is known."
        actions={
          <>
            <button type="button" className="secondary-btn" onClick={() => navigate('/transactions')}>
              Back to Transactions
            </button>
            <button type="button" className="secondary-btn" onClick={() => loadTransaction()}>
              Refresh
            </button>
          </>
        }
      />

      {error && !payload ? <ExplorerErrorState error={error} onRetry={loadTransaction} /> : null}

      {loading && !payload ? (
        <Panel title="Loading transaction">
          <LoadingSkeleton rows={6} />
        </Panel>
      ) : !payload && !error ? (
        <EmptyState title="Transaction not found" description="The requested transaction hash did not resolve on the current public endpoints." />
      ) : payload && txResponse ? (
        <>
          {hasBothViews && (
            <div className="tabStrip">
              <button
                type="button"
                className={`tabButton${activeTab === 'cosmos' ? ' active' : ''}`}
                onClick={() => setActiveTab('cosmos')}
              >
                Cosmos View
              </button>
              <button
                type="button"
                className={`tabButton${activeTab === 'evm' ? ' active' : ''}`}
                onClick={() => setActiveTab('evm')}
              >
                Lithosphere Tx
              </button>
            </div>
          )}

          <div className="explorerGrid two-up">
            <Panel title="Overview">
              <div className="detailList">
                <div className="detailRow multiLine">
                  <span>Hash</span>
                  <CopyableValue value={displayIsEvm ? evmHash : normalizedHash} preserve />
                </div>
                {hasBothViews ? (
                  <div className="detailRow multiLine">
                    <span>{displayIsEvm ? 'Cosmos Tx Hash' : 'Lithosphere Tx Hash'}</span>
                    <CopyableValue value={displayIsEvm ? normalizedHash : evmHash} preserve />
                  </div>
                ) : null}
                <div className="detailRow">
                  <span>Status</span>
                  <StatusBadge tone={displayIsEvm ? (displayTx.code === 0 ? 'success' : 'failed') : (Number(displayTx.code || 0) === 0 ? 'success' : 'failed')}>
                    {displayIsEvm
                      ? displayTx.code === 0
                        ? 'Success'
                        : 'Failed'
                      : Number(displayTx.code || 0) === 0
                        ? 'Success'
                        : `Failed (${displayTx.code})`}
                  </StatusBadge>
                </div>
                <div className="detailRow">
                  <span>Block Number</span>
                  {payload.blockHeight ? (
                    <button type="button" className="inlineLink" onClick={() => navigate(`/block/${payload.blockHeight}`)}>
                      {formatNumber(payload.blockHeight)}
                    </button>
                  ) : (
                    <span>Pending</span>
                  )}
                </div>
                <div className="detailRow">
                  <span>Confirmations</span>
                  <strong>{formatNumber(payload.confirmations)}</strong>
                </div>
                <div className="detailRow">
                  <span>Timestamp</span>
                  <TimestampValue value={displayTx.timestamp} />
                </div>
                <div className="detailRow">
                  <span>Finality</span>
                  <StatusBadge tone="success">{payload.blockHeight ? 'Committed' : 'Pending'}</StatusBadge>
                </div>
                {!displayIsEvm && displayTx?.tx?.body?.messages?.[0]?.['@type'] ? (
                  <div className="detailRow">
                    <span>Message Type</span>
                    <strong>{(displayTx.tx.body.messages[0]['@type'].split('.').pop() || '').replace('MsgEthereumTx', 'LithosphereTx')}</strong>
                  </div>
                ) : null}
                {!displayIsEvm && displayTx?.tx?.body?.memo ? (
                  <div className="detailRow">
                    <span>Memo</span>
                    <span>{displayTx.tx.body.memo}</span>
                  </div>
                ) : null}
              </div>
            </Panel>

            <Panel title="Participants & Gas">
              <div className="detailList">
                <div className="detailRow multiLine">
                  <span>Sender</span>
                  {displayIsEvm ? (
                    <AddressWithName address={displayTx.from} />
                  ) : participants.from ? (
                    <AddressWithName address={participants.from} />
                  ) : (
                    <span>--</span>
                  )}
                </div>
                <div className="detailRow multiLine">
                  <span>Recipient</span>
                  {(() => {
                    const token = payload.knownContract;
                    const decoded = payload.decodedInput;
                    const transferTo = decoded?.name === 'transfer'
                      ? decoded?.args?.to || decoded?.args?.recipient || decoded?.args?._to
                      : null;
                    if (token && transferTo) {
                      return <AddressWithName address={transferTo} />;
                    }
                    if (displayIsEvm) {
                      return <AddressWithName address={displayTx.to} />;
                    }
                    return participants.to ? <AddressWithName address={participants.to} /> : <span>--</span>;
                  })()}
                </div>
                <div className="detailRow">
                  <span>Amount</span>
                  <strong>
                    {(() => {
                      if (displayIsEvm && swapSummary) {
                        return `${swapSummary.sentAmount} → ${swapSummary.receivedAmount}`;
                      }
                      const token = payload.knownContract;
                      const decoded = payload.decodedInput;
                      const transferAmount = decoded?.name === 'transfer'
                        ? decoded?.args?.amount || decoded?.args?.value || decoded?.args?._value
                        : null;
                      if (token && transferAmount) {
                        return formatTokenValue(transferAmount, token.decimals ?? 18, token.symbol || '');
                      }
                      if (!displayIsEvm) return extractTxAmount(displayTx);
                      return formatEvmValue(displayTx.value);
                    })()}
                  </strong>
                </div>
                {displayIsEvm && swapSummary ? (
                  <div className="detailRow">
                    <span>Pool</span>
                    <CopyableValue value={swapSummary.pool} preserve />
                  </div>
                ) : null}
                <div className="detailRow">
                  <span>Fee</span>
                  <strong>
                    {isEvm
                      ? computeFee(txResponse.rawReceipt?.gasUsed, txResponse.effectiveGasPrice || txResponse.gasPrice)
                      : extractFee(displayTx)}
                  </strong>
                </div>
                <div className="detailRow">
                  <span>Gas Used</span>
                  <strong>{formatNumber(displayTx.gas_used || displayTx.gasUsed || 0)}</strong>
                </div>
                <div className="detailRow">
                  <span>{displayIsEvm ? 'Gas Price' : 'Gas Wanted'}</span>
                  <strong>
                    {displayIsEvm
                      ? formatGasPrice(displayTx.effectiveGasPrice || displayTx.gasPrice || '0x0', 'strat')
                      : formatNumber(displayTx.gas_wanted || 0)}
                  </strong>
                </div>
                {payload.knownContract && displayIsEvm && payload.decodedInput?.name === 'transfer' ? (
                  <div className="detailRow">
                    <span>Token</span>
                    <button
                      type="button"
                      className="inlineLink"
                      onClick={() => navigate(`/token/${payload.knownContract.address || payload.knownContract.contractAddress}`)}>
                      {payload.knownContract.name || payload.knownContract.symbol}
                    </button>
                  </div>
                ) : null}
                {payload.knownContract && displayIsEvm ? (
                  <div className="detailRow">
                    <span>Decoded Against</span>
                    <button
                      type="button"
                      className="inlineLink"
                      onClick={() => navigate(`/contract/${payload.knownContract.address || payload.knownContract.contractAddress}`)}
                    >
                      {payload.knownContract.name}
                    </button>
                  </div>
                ) : null}
              </div>
            </Panel>
          </div>

          {displayIsEvm && (
            <Panel title="Decoded Input / Raw Input">
              <DecodedInputPanel decodedInput={payload.decodedInput} rawInput={displayTx.input} />
            </Panel>
          )}

          <Panel title="Logs / Events">
            <RenderEventList isEvm={displayIsEvm} txResponse={displayTx} decodedLogs={payload.decodedLogs} knownToken={payload.knownContract} />
          </Panel>

          <Panel title="Raw Response">
            <details className="rawResponseDisclosure">
              <summary>Open raw transaction payload</summary>
              <pre className="jsonPreview">{JSON.stringify(displayTx, null, 2)}</pre>
            </details>
          </Panel>
        </>
      ) : null}
    </div>
  );
};

const shortenHash = (value = '') => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }

  return `${normalized.slice(0, 10)}...${normalized.slice(-6)}`;
};

export default TransactionDetail;
