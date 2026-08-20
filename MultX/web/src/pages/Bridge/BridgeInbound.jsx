import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ethers } from 'ethers5';
import { CHAIN_CONFIG } from '../../config/api';
import { usePageMeta, defaultExplorerDescription } from '../../hooks/usePageMeta';
import { useWallet } from '../../hooks/useWallet';
import { StatusBadge } from '../../components/explorer/ExplorerUI';
import {
  BRIDGE_ADDRESS,
  BRIDGE_ABI_MINIMAL,
  DEST_CHAIN_DEPLOYMENTS,
} from '../../data/bridgeConfig';
import {
  getDestTokenBalance,
  getDestTokenAllowance,
  approveOnDest,
  lockOnDest,
  getBridgeStatus,
  getBridgeSignatures,
} from '../../services/bridgeService';
import { formatBN } from '../../helpers/formatBN';
import { friendlyError } from '../../helpers/friendlyError';
import { sortReleaseSignatures } from '../../services/releaseMessage';
import '../../scss/pages/Explorer/explorerPage.scss';
import '../../scss/pages/Bridge/bridgePage.scss';

const POLL_MS = 4000;
const KAMET_CHAIN_ID = 900523;
const DEST_CHAINS = Object.entries(DEST_CHAIN_DEPLOYMENTS).map(([id, dep]) => ({
  chainId: Number(id),
  name: dep.name,
  bridge: dep.bridge,
  tokens: dep.wrappedTokens,
}));

export const BridgeInbound = () => {
  usePageMeta('Bridge — Inbound', defaultExplorerDescription);
  const wallet = useWallet();

  const [srcChainId, setSrcChainId] = useState(DEST_CHAINS[0]?.chainId ?? 11155111);
  const [tokenAddr, setTokenAddr]   = useState(DEST_CHAINS[0]?.tokens[1][0] ?? ''); // default wLITHO
  const [amount,    setAmount]      = useState('');
  const [balance,   setBalance]     = useState(null);
  const [allowance, setAllowance]   = useState(null);

  const [step,      setStep]      = useState('idle'); // idle | approving | burning | waiting | ready_to_release | releasing | completed | error
  const [submitting,setSubmitting]= useState(false);
  const [destTxHash,setDestTxHash]= useState('');
  const [releaseTx, setReleaseTx] = useState('');
  const [statusData,setStatusData]= useState(null);
  const [errorMsg,  setErrorMsg]  = useState('');

  const pollRef = useRef(null);

  const srcChain = DEST_CHAINS.find((c) => c.chainId === srcChainId);
  const tokenEntry = srcChain?.tokens.find(([addr]) => addr.toLowerCase() === tokenAddr.toLowerCase());
  const kametOriginToken = tokenEntry ? tokenEntry[1] : null;
  const onSrcChain = wallet.isConnected && wallet.chainId === srcChainId;
  const onKamet    = wallet.isConnected && wallet.chainId === KAMET_CHAIN_ID;

  const parsedAmount = useMemo(() => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return null;
    try { return ethers.utils.parseUnits(amount, 18); } catch { return null; }
  }, [amount]);

  const needsApproval = useMemo(() => {
    if (!parsedAmount || !allowance) return parsedAmount !== null;
    return allowance.lt(parsedAmount);
  }, [parsedAmount, allowance]);

  // Refresh balance + allowance on the source chain
  const refresh = useCallback(async () => {
    if (!wallet.isConnected || !wallet.account || !tokenAddr || !srcChain) {
      setBalance(null); setAllowance(null); return;
    }
    try {
      const [b, a] = await Promise.all([
        getDestTokenBalance(srcChainId, tokenAddr, wallet.account),
        getDestTokenAllowance(srcChainId, tokenAddr, wallet.account),
      ]);
      setBalance(b); setAllowance(a);
    } catch {
      setBalance(null); setAllowance(null);
    }
  }, [wallet.isConnected, wallet.account, tokenAddr, srcChainId, srcChain]);

  useEffect(() => { refresh(); }, [refresh]);

  // Poll bridge-api after burn lands
  useEffect(() => {
    if (!destTxHash || step === 'completed' || step === 'error' || step === 'ready_to_release' || step === 'releasing') return;
    const poll = async () => {
      try {
        const data = await getBridgeStatus(destTxHash);
        setStatusData(data);
        if (data.dbStatus === 'signed' || data.status === 'signing') {
          // Has signatures — let user trigger release on Kamet
          if (data.signaturesCollected >= (data.signaturesRequired ?? 2)) {
            setStep('ready_to_release');
          }
        }
      } catch { /* keep polling */ }
    };
    poll();
    pollRef.current = setInterval(poll, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [destTxHash, step]);

  // Step 1: switch to source chain, approve wrapped, burn (lock to Kamet)
  const burn = async () => {
    if (!wallet.signer || !parsedAmount) return;
    if (!onSrcChain) {
      // Try to switch wallet chain
      try {
        await wallet.switchChain?.(srcChainId);
      } catch (err) {
        setErrorMsg(`Switch your wallet to ${srcChain.name} first (chainId ${srcChainId}).`);
        setStep('error');
        return;
      }
    }
    setSubmitting(true); setErrorMsg(''); setDestTxHash(''); setStatusData(null);
    try {
      if (needsApproval) {
        setStep('approving');
        await approveOnDest(wallet.signer, srcChainId, tokenAddr, ethers.constants.MaxUint256);
        await refresh();
      }
      setStep('burning');
      const { txHash } = await lockOnDest(wallet.signer, srcChainId, tokenAddr, parsedAmount, KAMET_CHAIN_ID);
      setDestTxHash(txHash);
      setStep('waiting');
      setAmount('');
      await refresh();
    } catch (err) {
      const msg = friendlyError(err);
      if (msg === null) setStep('idle');
      else { setErrorMsg(msg); setStep('error'); }
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: once signatures are collected, user switches to Kamet and triggers release
  const release = async () => {
    if (!wallet.signer || !destTxHash || !statusData) return;
    if (!onKamet) {
      try { await wallet.switchToLithoChain?.(); }
      catch {
        setErrorMsg('Switch your wallet to Kamet to release.');
        setStep('error');
        return;
      }
    }
    setSubmitting(true); setErrorMsg(''); setReleaseTx('');
    try {
      setStep('releasing');
      const sigsData = await getBridgeSignatures(destTxHash);
      const signatures = sigsData.signatures || [];
      if (signatures.length === 0) throw new Error('No signatures available yet');

      // Sort signatures by signer address (ascending) — contract requires it.
      // Each signature recovers the same digest (per validator key) so we can
      // recover signer addresses and use them to sort.
      const sortedSigs = sortReleaseSignatures(signatures, {
        sourceTxHash: destTxHash,
        sourceBridge: statusData.sourceBridge,
        token: kametOriginToken,
        user: wallet.account,
        amount: ethers.BigNumber.from(statusData.amount || '0'),
        sourceChain: srcChainId,
        sourceNonce: statusData.sourceNonce,
        destinationChain: KAMET_CHAIN_ID,
        destinationBridge: BRIDGE_ADDRESS,
      });

      const kametBridge = new ethers.Contract(BRIDGE_ADDRESS, BRIDGE_ABI_MINIMAL, wallet.signer);
      const tx = await kametBridge.releaseTokens(
        kametOriginToken,
        wallet.account,
        ethers.BigNumber.from(statusData.amount),
        srcChainId,
        statusData.sourceBridge,
        statusData.sourceNonce,
        destTxHash,
        sortedSigs
      );
      const receipt = await tx.wait();
      setReleaseTx(receipt.transactionHash);
      setStep('completed');
    } catch (err) {
      const msg = friendlyError(err);
      if (msg === null) setStep('ready_to_release');
      else { setErrorMsg(msg); setStep('error'); }
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep('idle'); setDestTxHash(''); setStatusData(null);
    setReleaseTx(''); setErrorMsg('');
  };

  const sigCount = statusData?.signaturesCollected ?? 0;
  const sigRequired = statusData?.signaturesRequired ?? 2;
  const sigPct = sigRequired > 0 ? Math.min((sigCount / sigRequired) * 100, 100) : 0;

  const cta = (() => {
    if (!wallet.isConnected) return { label: 'Connect Wallet', onClick: () => wallet.connect(), disabled: false };
    if (step === 'completed') return { label: 'Bridge Another', onClick: reset, disabled: false };
    if (step === 'ready_to_release') {
      if (!onKamet) return { label: 'Switch to Kamet to release', onClick: () => wallet.switchToLithoChain?.(), disabled: false };
      return { label: 'Release on Kamet', onClick: release, disabled: submitting };
    }
    if (step === 'releasing') return { label: 'Releasing on Kamet…', onClick: null, disabled: true };
    if (step === 'waiting') return { label: 'Waiting for signatures…', onClick: null, disabled: true };
    if (step === 'burning') return { label: 'Burning wrapped tokens…', onClick: null, disabled: true };
    if (step === 'approving') return { label: `Approving w${tokenEntry?.[2] ?? 'token'}…`, onClick: null, disabled: true };
    if (!onSrcChain) return { label: `Switch to ${srcChain?.name}`, onClick: () => wallet.switchChain?.(srcChainId), disabled: !wallet.switchChain };
    if (!parsedAmount) return { label: 'Enter an amount', onClick: null, disabled: true };
    if (balance && parsedAmount.gt(balance)) return { label: `Insufficient w${tokenEntry?.[2] ?? 'token'}`, onClick: null, disabled: true };
    if (needsApproval) return { label: `Approve w${tokenEntry?.[2] ?? 'token'}`, onClick: burn, disabled: false };
    return { label: `Burn & Bridge to Kamet`, onClick: burn, disabled: false };
  })();

  return (
    <div className="bridge-page">
      <header className="bridge-page__header">
        <span className="bridge-page__eyebrow">{CHAIN_CONFIG.networkLabel}</span>
        <h1 className="bridge-page__title">Bridge — Inbound</h1>
        <p className="bridge-page__subtitle">
          Burn wrapped tokens on a destination chain to release the original LEP100 on Kamet. Two transactions: burn (on the source chain) then release (on Kamet).
        </p>
        <div style={{ marginTop: 12, display: 'inline-flex', gap: 6, padding: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 999 }}>
          <a
            href="/bridge"
            style={{ padding: '6px 14px', borderRadius: 999, color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}
          >
            Outbound (Kamet → dest)
          </a>
          <span style={{ padding: '6px 14px', borderRadius: 999, background: 'rgba(11,133,255,0.15)', color: '#0b85ff', fontSize: 13, fontWeight: 600 }}>
            Inbound (dest → Kamet)
          </span>
        </div>
      </header>

      <div className="bridge-card">
        {/* Source chain selector */}
        <div className="bridge-card__row">
          <div className="bridge-card__row-head">
            <span className="bridge-card__label">Source Chain</span>
          </div>
          <div className="bridge-card__field">
            <select
              className="bridge-card__select"
              style={{ flex: 1, borderRadius: 12 }}
              value={srcChainId}
              onChange={(e) => {
                const c = Number(e.target.value);
                setSrcChainId(c);
                const dep = DEST_CHAIN_DEPLOYMENTS[c];
                if (dep) setTokenAddr(dep.wrappedTokens[1][0]);
                setAmount('');
              }}
              disabled={step === 'waiting' || step === 'releasing' || step === 'completed'}
            >
              {DEST_CHAINS.map((c) => (
                <option key={c.chainId} value={c.chainId}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Wrapped token + amount */}
        <div className="bridge-card__row">
          <div className="bridge-card__row-head">
            <span className="bridge-card__label">Wrapped Token</span>
            {balance !== null && (
              <span className="bridge-card__balance">
                Balance {formatBN(balance, 18, 4)}
                <button
                  type="button"
                  className="bridge-card__max"
                  onClick={() => setAmount(ethers.utils.formatUnits(balance, 18))}
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
              disabled={step === 'waiting' || step === 'releasing' || step === 'completed'}
            />
            <select
              className="bridge-card__select"
              value={tokenAddr}
              onChange={(e) => { setTokenAddr(e.target.value); setAmount(''); }}
              disabled={step === 'waiting' || step === 'releasing' || step === 'completed'}
            >
              {srcChain?.tokens.map(([addr, , sym]) => (
                <option key={addr} value={addr}>w{sym}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Destination = Kamet */}
        <div className="bridge-card__row">
          <div className="bridge-card__row-head">
            <span className="bridge-card__label">Destination</span>
          </div>
          <div className="bridge-card__field">
            <span style={{ flex: 1, padding: '8px 14px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {CHAIN_CONFIG.networkLabel} ({KAMET_CHAIN_ID})
            </span>
          </div>
        </div>

        {/* Status panel after burn lands */}
        {(step === 'waiting' || step === 'ready_to_release' || step === 'releasing' || step === 'completed' || (step === 'error' && destTxHash)) && (
          <div className={`bridge-card__status${step === 'completed' ? ' bridge-card__status--success' : step === 'error' ? ' bridge-card__status--error' : ''}`}>
            <div className="bridge-card__status-row">
              <span>Burn tx (source)</span>
              <a
                className="bridge-card__tx-link"
                href={`${DEST_CHAIN_DEPLOYMENTS[srcChainId]?.explorer ?? ''}/tx/${destTxHash}`}
                target="_blank"
                rel="noreferrer"
              >
                {destTxHash.slice(0, 10)}…{destTxHash.slice(-8)} ↗
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
              </>
            )}
            {releaseTx && (
              <div className="bridge-card__status-row">
                <span>Release tx (Kamet)</span>
                <a
                  className="bridge-card__tx-link"
                  href={`${CHAIN_CONFIG.explorerUrl}/tx/${releaseTx}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {releaseTx.slice(0, 10)}…{releaseTx.slice(-8)} ↗
                </a>
              </div>
            )}
            <div className="bridge-card__status-row">
              <span>Status</span>
              <StatusBadge tone={step === 'completed' ? 'success' : 'default'}>
                {step === 'waiting' ? 'Waiting for validators' :
                 step === 'ready_to_release' ? 'Ready to release on Kamet' :
                 step === 'releasing' ? 'Releasing on Kamet' :
                 step === 'completed' ? 'Bridge complete' :
                 step}
              </StatusBadge>
            </div>
          </div>
        )}

        {step === 'error' && errorMsg && (
          <p className="bridge-card__error-msg">{errorMsg}</p>
        )}

        <button
          type="button"
          className="bridge-card__cta"
          onClick={cta.onClick}
          disabled={cta.disabled || !cta.onClick}
        >
          {cta.label}
        </button>

        {BRIDGE_ADDRESS && (
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-primary)', textAlign: 'center' }}>
            Kamet release bridge: <code style={{ fontSize: 10 }}>{BRIDGE_ADDRESS.slice(0, 10)}…</code>
          </p>
        )}
      </div>
    </div>
  );
};

export default BridgeInbound;
