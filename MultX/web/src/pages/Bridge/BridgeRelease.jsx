import { useState } from 'react';
import { ethers } from 'ethers5';
import { CHAIN_CONFIG } from '../../config/api';
import { usePageMeta, defaultExplorerDescription } from '../../hooks/usePageMeta';
import { useWallet } from '../../hooks/useWallet';
import { StatusBadge } from '../../components/explorer/ExplorerUI';
import { BRIDGE_TOKENS } from '../../data/bridgeConfig';
import { getBridgeSignatures, releaseTokens } from '../../services/bridgeService';
import '../../scss/pages/Explorer/explorerPage.scss';
import '../../scss/pages/Bridge/bridgePage.scss';

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

export const BridgeRelease = () => {
  usePageMeta('Bridge Release', defaultExplorerDescription);
  const wallet = useWallet();

  const [sourceTxHash, setSourceTxHash] = useState('');
  const [tokenAddr, setTokenAddr] = useState('');
  const [userAddr, setUserAddr] = useState('');
  const [amount, setAmount] = useState('');
  const [sourceChain, setSourceChain] = useState('900523');
  const [sourceBridge, setSourceBridge] = useState('');
  const [sourceNonce, setSourceNonce] = useState('');

  const [step, setStep] = useState('idle'); // idle | fetching | releasing | done | error
  const [sigs, setSigs] = useState([]);
  const [releaseTxHash, setReleaseTxHash] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const wrongChain = wallet.isConnected && wallet.chainId !== CHAIN_CONFIG.evmChainId;

  const fetchAndRelease = async () => {
    if (!wallet.signer) return;
    setStep('fetching');
    setErrorMsg('');
    setSigs([]);
    try {
      const data = await getBridgeSignatures(sourceTxHash);
      const signatures = (data.signatures ?? []).map((s) => s.signature);
      setSigs(signatures);

      if (signatures.length === 0) {
        setErrorMsg('No signatures found for this tx. Validators may not have signed yet.');
        setStep('error');
        return;
      }

      setStep('releasing');
      const amountBN = ethers.utils.parseUnits(amount, 18);
      const { txHash } = await releaseTokens(wallet.signer, {
        token: tokenAddr,
        user: userAddr,
        amount: amountBN,
        sourceChain: BigInt(sourceChain),
        sourceBridge,
        sourceNonce: BigInt(sourceNonce),
        sourceTxHash,
        signatures,
      });
      setReleaseTxHash(txHash);
      setStep('done');
    } catch (err) {
      const msg = friendlyError(err);
      if (msg === null) { setStep('idle'); }
      else { setErrorMsg(msg); setStep('error'); }
    }
  };

  const field = (label, value, onChange, placeholder = '') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>{label}</span>
      <input
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border-color)',
          borderRadius: 10,
          padding: '10px 14px',
          color: 'var(--text-secondary)',
          fontSize: 13,
          fontFamily: 'monospace',
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
        }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={step === 'fetching' || step === 'releasing' || step === 'done'}
      />
    </div>
  );

  return (
    <div className="bridge-page">
      <header className="bridge-page__header">
        <span className="bridge-page__eyebrow">{CHAIN_CONFIG.networkLabel}</span>
        <h1 className="bridge-page__title">Release Tokens</h1>
        <p className="bridge-page__subtitle">
          Manually trigger token release on Kamet from a signed bridge transaction. Validator signatures are fetched automatically from the bridge API.
        </p>
      </header>

      <div className="bridge-card" style={{ maxWidth: 520, gap: 16 }}>
        {field('Source Tx Hash', sourceTxHash, setSourceTxHash, '0x...')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>Token</span>
            <select
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                padding: '10px 14px',
                color: 'var(--text-secondary)',
                fontSize: 13,
                outline: 'none',
              }}
              value={tokenAddr}
              onChange={(e) => setTokenAddr(e.target.value)}
              disabled={step !== 'idle' && step !== 'error'}
            >
              <option value="">Select token</option>
              {BRIDGE_TOKENS.map((t) => (
                <option key={t.symbol} value={t.address}>{t.symbol}</option>
              ))}
            </select>
          </div>
          {field('Amount (human)', amount, setAmount, '100.0')}
        </div>
        {field('Recipient address', userAddr, setUserAddr, '0x...')}
        {field('Source Bridge', sourceBridge, setSourceBridge, '0x...')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {field('Source Chain ID', sourceChain, setSourceChain, '900523')}
          {field('Source Nonce', sourceNonce, setSourceNonce, '1')}
        </div>

        {sigs.length > 0 && step !== 'done' && (
          <div style={{ fontSize: 12, color: 'var(--text-primary)', padding: '8px 0' }}>
            Fetched {sigs.length} signature{sigs.length !== 1 ? 's' : ''}.
          </div>
        )}

        {step === 'done' && releaseTxHash && (
          <div className="bridge-card__status bridge-card__status--success">
            <div className="bridge-card__status-row">
              <span>Released</span>
              <a
                className="bridge-card__tx-link"
                href={`${CHAIN_CONFIG.explorerUrl}/tx/${releaseTxHash}`}
                target="_blank"
                rel="noreferrer"
              >
                {releaseTxHash.slice(0, 10)}…{releaseTxHash.slice(-8)} ↗
              </a>
            </div>
            <StatusBadge tone="success">Release complete</StatusBadge>
          </div>
        )}

        {step === 'error' && errorMsg && (
          <p className="bridge-card__error-msg">{errorMsg}</p>
        )}

        {step !== 'done' ? (
          <button
            type="button"
            className="bridge-card__cta"
            onClick={() => {
              if (!wallet.isConnected) { wallet.connect(); return; }
              if (wrongChain) { wallet.switchToLithoChain(); return; }
              fetchAndRelease();
            }}
            disabled={
              (wallet.isConnected && !wrongChain) &&
              (!sourceTxHash || !sourceBridge || !tokenAddr || !userAddr || !amount || !sourceNonce ||
               step === 'fetching' || step === 'releasing')
            }
          >
            {!wallet.isConnected
              ? 'Connect Wallet'
              : wrongChain
              ? 'Switch to Kamet'
              : step === 'fetching'
              ? 'Fetching signatures…'
              : step === 'releasing'
              ? 'Releasing…'
              : 'Fetch Signatures & Release'}
          </button>
        ) : (
          <button
            type="button"
            className="bridge-card__cta"
            onClick={() => { setStep('idle'); setReleaseTxHash(''); setErrorMsg(''); setSigs([]); }}
          >
            Release Another
          </button>
        )}
      </div>
    </div>
  );
};

export default BridgeRelease;
