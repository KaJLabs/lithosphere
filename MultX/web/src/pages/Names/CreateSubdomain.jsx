import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ethers } from 'ethers5';
import { CHAIN_CONFIG } from '../../config/api';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useWallet } from '../../hooks/useWallet';
import { StatusBadge } from '../../components/explorer/ExplorerUI';
import { DNNS_CONFIG, fullName, isValidLabel, normalizeLabel } from '../../data/dnnsConfig';
import { createSubdomain, lookupName } from '../../services/namesService';
import { friendlyError } from '../../helpers/friendlyError';
import '../../scss/pages/Names/namesPage.scss';

export const CreateSubdomain = () => {
  const { name: rawName } = useParams();
  const navigate = useNavigate();
  const wallet = useWallet();
  const parentLabel = normalizeLabel(rawName);
  const parentName = fullName(parentLabel);
  usePageMeta(`Create subdomain for ${parentName}`);

  const [lookup, setLookup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subLabel, setSubLabel] = useState('');
  const [owner, setOwner] = useState(wallet.account || '');
  const [step, setStep] = useState('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const wrongChain = wallet.isConnected && wallet.chainId !== CHAIN_CONFIG.evmChainId;
  const isOwner = lookup && wallet.account && lookup.owner.toLowerCase() === wallet.account.toLowerCase();
  const validSubLabel = isValidLabel(subLabel);
  const fullSubdomain = useMemo(() => (
    validSubLabel ? `${normalizeLabel(subLabel)}.${parentName}` : ''
  ), [subLabel, validSubLabel, parentName]);

  useEffect(() => {
    if (wallet.account && !owner) setOwner(wallet.account);
  }, [wallet.account, owner]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await lookupName(parentLabel);
      setLookup(data);
      setError('');
    } catch (err) {
      setError(err?.message || 'Failed to load parent name');
    } finally {
      setLoading(false);
    }
  }, [parentLabel]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!wallet.signer || !validSubLabel || !ethers.utils.isAddress(owner)) return;
    setStep('creating');
    setError('');
    setResult(null);
    try {
      const created = await createSubdomain({
        signer: wallet.signer,
        parentLabel,
        subLabel: normalizeLabel(subLabel),
        owner,
      });
      setResult(created);
      setStep('success');
    } catch (err) {
      const msg = friendlyError(err);
      if (msg === null) setStep('idle');
      else {
        setError(msg);
        setStep('error');
      }
    }
  };

  const buttonState = (() => {
    if (!DNNS_CONFIG.nameWrapper) return { label: 'NameWrapper not configured', disabled: true, onClick: null };
    if (!wallet.isConnected) return { label: 'Connect Wallet', disabled: false, onClick: () => wallet.connect() };
    if (wrongChain) return { label: 'Switch to Kamet', disabled: false, onClick: () => wallet.switchToLithoChain() };
    if (!isOwner) return { label: 'Parent owner required', disabled: true, onClick: null };
    if (!validSubLabel) return { label: 'Enter a valid subdomain', disabled: true, onClick: null };
    if (!ethers.utils.isAddress(owner)) return { label: 'Enter a valid owner', disabled: true, onClick: null };
    if (step === 'creating') return { label: 'Creating...', disabled: true, onClick: null };
    return { label: `Create ${fullSubdomain}`, disabled: false, onClick: submit };
  })();

  return (
    <div className="names-page">
      <button type="button" className="names-back-btn" onClick={() => navigate(`/names/${parentLabel}`)}>
        Back to {parentName}
      </button>

      <header className="names-page__header">
        <h1 className="names-page__title">Create Subdomain</h1>
        <p className="names-page__subtitle">{parentName}</p>
      </header>

      {loading && <p className="names-page__hint">Loading...</p>}

      <div className="names-card">
        {lookup && (
          <div className="names-result__head">
            <div className="names-result__name">{parentName}</div>
            <StatusBadge tone={isOwner ? 'success' : 'neutral'}>
              {isOwner ? 'Owner connected' : 'Read-only'}
            </StatusBadge>
          </div>
        )}

        <div className="names-edit">
          <h3>Subdomain</h3>
          <input
            type="text"
            className="names-edit__input"
            placeholder="bob"
            value={subLabel}
            onChange={(e) => setSubLabel(e.target.value)}
          />
          {fullSubdomain && <p>{fullSubdomain}</p>}

          <h3>Owner address</h3>
          <input
            type="text"
            className="names-edit__input"
            placeholder="0x..."
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="names-cta"
          onClick={buttonState.onClick}
          disabled={buttonState.disabled || !buttonState.onClick}
        >
          {buttonState.label}
        </button>

        {step === 'success' && result && (
          <div className="names-success">
            <StatusBadge tone="success">Created</StatusBadge>
            <Link to={`/names/${result.name}`}>{result.name}</Link>
            {result.approvalTxHash && (
              <a href={`${CHAIN_CONFIG.explorerUrl}/tx/${result.approvalTxHash}`} target="_blank" rel="noreferrer">View approval tx</a>
            )}
            {result.wrapTxHash && (
              <a href={`${CHAIN_CONFIG.explorerUrl}/tx/${result.wrapTxHash}`} target="_blank" rel="noreferrer">View wrap tx</a>
            )}
            <a href={`${CHAIN_CONFIG.explorerUrl}/tx/${result.txHash}`} target="_blank" rel="noreferrer">View tx</a>
          </div>
        )}
        {error && <p className="names-result__error">{error}</p>}
      </div>
    </div>
  );
};

export default CreateSubdomain;
