import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ethers } from 'ethers5';
import { CHAIN_CONFIG } from '../../config/api';
import { usePageMeta, defaultExplorerDescription } from '../../hooks/usePageMeta';
import { useWallet } from '../../hooks/useWallet';
import { StatusBadge } from '../../components/explorer/ExplorerUI';
import {
  BRIDGE_TOKENS,
  BRIDGE_DESTINATION_CHAINS,
  BRIDGE_ADDRESS,
  tokenBySymbol,
} from '../../data/bridgeConfig';
import {
  getTokenBalance,
  getTokenAllowance,
  approveToken,
  lockTokens,
  getBridgeStatus,
  getBridgeHistory,
} from '../../services/bridgeService';
import '../../scss/pages/Explorer/explorerPage.scss';
import '../../scss/pages/Bridge/bridgePage.scss';

const POLL_MS = 4000;
const HISTORY_LIMIT = 10;

const formatBN = (bn, decimals = 18, frac = 4) => {
  if (!bn) return '0';
  try {
    return Number(ethers.utils.formatUnits(bn, decimals)).toFixed(frac);
  } catch {
    return '0';
  }
};

const friendlyError = (err) => {
  if (!err) return null;
  const code = err.code || err.error?.code || err.data?.code;
  if (code === 4001 || code === 'ACTION_REJECTED') return null;
  const reason = err.reason || err.error?.message || err.data?.message;
  if (reason) return reason;
  const msg = err.message || '';
  const truncated = msg.split(' (action=')[0].split(' [')[0].trim();
  return truncated.length > 200 ? truncated.slice(0, 200) + '…' : (truncated || 'Transaction failed.');
};

const statusBadgeClass = (s) => {
  if (s === 'completed') return '--completed';
  if (s === 'failed') return '--failed';
  if (s === 'signing' || s === 'signed') return '--signing';
  return '--pending';
};

const timeAgo = (ts) => {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
};

export const Bridge = () => {
  usePageMeta('Bridge', defaultExplorerDescription);
  const wallet = useWallet();

  const [tokenSym, setTokenSym] = useState('wLITHO');
  const [destChainId, setDestChainId] = useState(BRIDGE_DESTINATION_CHAINS[0]?.chainId ?? 11155111);
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState(null);
  const [allowance, setAllowance] = useState(null);

  const [step, setStep] = useState('idle'); // idle | approving | locking | waiting | completed | error
  const [txHash, setTxHash] = useState('');
  const [statusData, setStatusData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyCursor, setHistoryCursor] = useState(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);

  const pollRef = useRef(null);
  const token = tokenBySymbol(tokenSym);
  const wrongChain = wallet.isConnected && wallet.chainId !== CHAIN_CONFIG.evmChainId;

  const parsedAmount = useMemo(() => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return null;
    try { return ethers.utils.parseUnits(amount, token?.decimals ?? 18); }
    catch { return null; }
  }, [amount, token]);

  const needsApproval = useMemo(() => {
    if (!parsedAmount || !allowance) return true;
    return allowance.lt(parsedAmount);
  }, [parsedAmount, allowance]);

  // Refresh balance + allowance
  const refreshOwner = useCallback(async () => {
    if (!wallet.isConnected || !wallet.account || wrongChain || !token) {
      setBalance(null); setAllowance(null); return;
    }
    try {
      const [bal, alw] = await Promise.all([
        getTokenBalance(token.address, wallet.account),
        getTokenAllowance(token.address, wallet.account),
      ]);
      setBalance(bal);
      setAllowance(alw);
    } catch {
      setBalance(null); setAllowance(null);
    }
  }, [wallet.isConnected, wallet.account, wrongChain, token]);

  useEffect(() => { refreshOwner(); }, [refreshOwner]);

  // Poll bridge status after lock
  useEffect(() => {
    if (!txHash || step === 'completed' || step === 'error' || step === 'idle') return;
    const poll = async () => {
      try {
        const data = await getBridgeStatus(txHash);
        setStatusData(data);
        if (data.status === 'completed') setStep('completed');
        if (data.status === 'failed') { setStep('error'); setErrorMsg('Bridge transaction failed.'); }
      } catch { /* keep polling */ }
    };
    poll();
    pollRef.current = setInterval(poll, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [txHash, step]);

  // Load history when wallet connects
  const loadHistory = useCallback(async (cursor = null) => {
    if (!wallet.account) return;
    setHistoryLoading(true);
    try {
      const data = await getBridgeHistory(wallet.account, HISTORY_LIMIT, cursor);
      const rows = data.transactions ?? data.data ?? [];
      setHistory((prev) => cursor ? [...prev, ...rows] : rows);
      setHistoryCursor(data.nextCursor ?? null);
      setHistoryHasMore(!!data.nextCursor);
    } catch {
      // history not critical
    } finally {
      setHistoryLoading(false);
    }
  }, [wallet.account]);

  useEffect(() => {
    if (wallet.account) { setHistory([]); setHistoryCursor(null); loadHistory(); }
  }, [wallet.account, loadHistory]);

  const bridge = async () => {
    if (!wallet.signer || !parsedAmount) return;
    setSubmitting(true);
    setErrorMsg('');
    setTxHash('');
    setStatusData(null);
    try {
      if (needsApproval) {
        setStep('approving');
        await approveToken(wallet.signer, token.address, ethers.constants.MaxUint256);
        await refreshOwner();
      }
      setStep('locking');
      const { txHash: hash } = await lockTokens(wallet.signer, token.address, parsedAmount, destChainId);
      setTxHash(hash);
      setStep('waiting');
      setAmount('');
      await refreshOwner();
      loadHistory();
    } catch (err) {
      const msg = friendlyError(err);
      if (msg === null) { setStep('idle'); }
      else { setErrorMsg(msg); setStep('error'); }
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep('idle');
    setTxHash('');
    setStatusData(null);
    setErrorMsg('');
  };

  const sigCount = statusData?.signatures_collected ?? 0;
  const sigRequired = statusData?.signatures_required ?? 2;
  const sigPct = sigRequired > 0 ? Math.min((sigCount / sigRequired) * 100, 100) : 0;

  const buttonState = (() => {
    if (!wallet.isConnected) return { label: 'Connect Wallet', onClick: () => wallet.connect(), disabled: false };
    if (wrongChain) return { label: 'Switch to Kamet', onClick: () => wallet.switchToLithoChain(), disabled: false };
    if (!parsedAmount) return { label: 'Enter an amount', onClick: null, disabled: true };
    if (balance && parsedAmount.gt(balance)) return { label: 'Insufficient balance', onClick: null, disabled: true };
    if (submitting && step === 'approving') return { label: 'Approving…', onClick: null, disabled: true };
    if (submitting && step === 'locking') return { label: 'Locking tokens…', onClick: null, disabled: true };
    if (needsApproval) return { label: `Approve ${tokenSym}`, onClick: bridge, disabled: false };
    return { label: `Bridge ${tokenSym}`, onClick: bridge, disabled: false };
  })();

  return (
    <div className="bridge-page">
      <header className="bridge-page__header">
        <span className="bridge-page__eyebrow">{CHAIN_CONFIG.networkLabel}</span>
        <h1 className="bridge-page__title">Bridge — Outbound</h1>
        <p className="bridge-page__subtitle">
          Lock LEP100 tokens on Kamet for cross-chain transfer. Validators attest the lock and release wrapped tokens on the destination chain.
        </p>
        <div style={{ marginTop: 12, display: 'inline-flex', gap: 6, padding: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 999 }}>
          <span style={{ padding: '6px 14px', borderRadius: 999, background: 'rgba(11,133,255,0.15)', color: '#0b85ff', fontSize: 13, fontWeight: 600 }}>
            Outbound (Kamet → dest)
          </span>
          <a
            href="/bridge/inbound"
            style={{ padding: '6px 14px', borderRadius: 999, color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}
          >
            Inbound (dest → Kamet)
          </a>
        </div>
      </header>

      <div className="bridge-card">
        {/* Token + amount */}
        <div className="bridge-card__row">
          <div className="bridge-card__row-head">
            <span className="bridge-card__label">Token</span>
            {balance !== null && (
              <span className="bridge-card__balance">
                Balance {formatBN(balance, token?.decimals, 4)}
                <button
                  type="button"
                  className="bridge-card__max"
                  onClick={() => setAmount(ethers.utils.formatUnits(balance, token?.decimals ?? 18))}
                >MAX</button>
              </span>
            )}
          </div>
          <div className="bridge-card__field">
            <input
              type="number"
              placeholder="0.0"
              className="bridge-card__amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.000001"
              disabled={step === 'waiting' || step === 'completed'}
            />
            <select
              className="bridge-card__select"
              value={tokenSym}
              onChange={(e) => { setTokenSym(e.target.value); setAmount(''); }}
              disabled={step === 'waiting' || step === 'completed'}
            >
              {BRIDGE_TOKENS.map((t) => (
                <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Destination chain */}
        <div className="bridge-card__row">
          <div className="bridge-card__row-head">
            <span className="bridge-card__label">Destination</span>
          </div>
          <div className="bridge-card__field">
            <select
              className="bridge-card__select"
              style={{ flex: 1, borderRadius: 12 }}
              value={destChainId}
              onChange={(e) => setDestChainId(Number(e.target.value))}
              disabled={step === 'waiting' || step === 'completed'}
            >
              {BRIDGE_DESTINATION_CHAINS.map((c) => (
                <option key={c.chainId} value={c.chainId}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Status panel (waiting / completed / error) */}
        {(step === 'waiting' || step === 'completed' || (step === 'error' && txHash)) && (
          <div className={`bridge-card__status${step === 'completed' ? ' bridge-card__status--success' : step === 'error' ? ' bridge-card__status--error' : ''}`}>
            <div className="bridge-card__status-row">
              <span>Tx Hash</span>
              <a
                className="bridge-card__tx-link"
                href={`${CHAIN_CONFIG.explorerUrl}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                {txHash.slice(0, 10)}…{txHash.slice(-8)} ↗
              </a>
            </div>
            {statusData && (
              <>
                <div className="bridge-card__status-row">
                  <span>Signatures</span>
                  <span>{sigCount} / {sigRequired}</span>
                </div>
                <div className="bridge-card__sig-bar">
                  <div className="bridge-card__sig-bar-fill" style={{ width: `${sigPct}%` }} />
                </div>
                <div className="bridge-card__status-row">
                  <span>Status</span>
                  <StatusBadge tone={step === 'completed' ? 'success' : 'default'}>
                    {statusData.status}
                  </StatusBadge>
                </div>
              </>
            )}
            {step === 'waiting' && !statusData && (
              <div className="bridge-card__status-row">
                <span>Status</span>
                <span>Waiting for validators…</span>
              </div>
            )}
          </div>
        )}

        {step === 'error' && errorMsg && (
          <p className="bridge-card__error-msg">{errorMsg}</p>
        )}

        {/* CTA */}
        {step !== 'waiting' && step !== 'completed' ? (
          <button
            type="button"
            className="bridge-card__cta"
            onClick={buttonState.onClick}
            disabled={buttonState.disabled || !buttonState.onClick}
          >
            {buttonState.label}
          </button>
        ) : step === 'completed' ? (
          <button type="button" className="bridge-card__cta" onClick={reset}>
            Bridge Another
          </button>
        ) : null}

        {/* Contract address note */}
        {BRIDGE_ADDRESS && (
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-primary)', textAlign: 'center' }}>
            Bridge contract: <code style={{ fontSize: 10 }}>{BRIDGE_ADDRESS.slice(0, 10)}…</code>
          </p>
        )}
      </div>

      {/* Transaction history */}
      {wallet.isConnected && !wrongChain && (
        <div className="bridge-history">
          <h2 className="bridge-history__title">My Transactions</h2>
          {historyLoading && history.length === 0 ? (
            <div className="bridge-history__empty">Loading…</div>
          ) : history.length === 0 ? (
            <div className="bridge-history__empty">No bridge transactions yet.</div>
          ) : (
            <>
              <table className="bridge-history__table">
                <thead>
                  <tr>
                    <th>Tx Hash</th>
                    <th>Token</th>
                    <th>Amount</th>
                    <th>Destination</th>
                    <th>Status</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => {
                    const tk = BRIDGE_TOKENS.find(
                      (t) => t.address.toLowerCase() === (row.token_address || '').toLowerCase()
                    );
                    const destC = BRIDGE_DESTINATION_CHAINS.find((c) => c.chainId === Number(row.target_chain));
                    return (
                      <tr key={row.tx_hash}>
                        <td>
                          <a
                            className="bridge-history__hash"
                            href={`${CHAIN_CONFIG.explorerUrl}/tx/${row.tx_hash}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {row.tx_hash.slice(0, 8)}…{row.tx_hash.slice(-6)}
                          </a>
                        </td>
                        <td>{tk?.symbol ?? '—'}</td>
                        <td>
                          {tk ? formatBN(ethers.BigNumber.from(row.amount || '0'), tk.decimals, 4) : row.amount}
                        </td>
                        <td>{destC?.name ?? row.target_chain}</td>
                        <td>
                          <span className={`bridge-history__badge bridge-history__badge${statusBadgeClass(row.status)}`}>
                            {row.status}
                          </span>
                        </td>
                        <td>{row.timestamp ? timeAgo(row.timestamp) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {historyHasMore && (
                <button
                  type="button"
                  className="bridge-history__load-more"
                  onClick={() => loadHistory(historyCursor)}
                  disabled={historyLoading}
                >
                  {historyLoading ? 'Loading…' : 'Load more'}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Bridge;
