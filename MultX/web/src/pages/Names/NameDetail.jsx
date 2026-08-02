import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ethers } from 'ethers5';
import { CHAIN_CONFIG } from '../../config/api';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useWallet } from '../../hooks/useWallet';
import { StatusBadge } from '../../components/explorer/ExplorerUI';
import { normalizeLabel, isValidLabel, fullName } from '../../data/dnnsConfig';
import { lookupName, setAddressRecord } from '../../services/namesService';
import '../../scss/pages/Names/namesPage.scss';

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

export const NameDetail = () => {
  const { name: rawName } = useParams();
  const navigate = useNavigate();
  const wallet = useWallet();

  const label = normalizeLabel(rawName);
  const valid = isValidLabel(label);
  usePageMeta(`${fullName(label)}`);

  const [lookup, setLookup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [addrInput, setAddrInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedTx, setSavedTx] = useState('');

  const wrongChain = wallet.isConnected && wallet.chainId !== CHAIN_CONFIG.evmChainId;
  const isOwner = lookup && wallet.account &&
    lookup.owner.toLowerCase() === wallet.account.toLowerCase();

  const load = useCallback(async () => {
    if (!valid) { setError('Invalid name'); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await lookupName(label);
      setLookup(res);
      setAddrInput(res.addr || '');
      setError('');
    } catch (err) {
      setError(err?.message || 'Lookup failed');
    } finally {
      setLoading(false);
    }
  }, [label, valid]);

  useEffect(() => { load(); }, [load]);

  const onSaveAddr = async () => {
    if (!wallet.signer || !ethers.utils.isAddress(addrInput)) return;
    setSaving(true); setSavedTx(''); setError('');
    try {
      const hash = await setAddressRecord({
        signer:  wallet.signer,
        label,
        address: addrInput,
      });
      setSavedTx(hash);
      const updated = await lookupName(label);
      setLookup(updated);
    } catch (err) {
      const msg = friendlyError(err);
      if (msg !== null) setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="names-page">
      <button type="button" className="names-back-btn" onClick={() => navigate('/names')}>
        ← Back to Names
      </button>

      <header className="names-page__header">
        <h1 className="names-page__title">{fullName(label)}</h1>
        {lookup && (
          <p className="names-page__subtitle">
            <StatusBadge tone={lookup.available ? 'success' : 'failed'}>
              {lookup.available ? 'Available' : 'Taken'}
            </StatusBadge>
          </p>
        )}
      </header>

      {loading && <p className="names-page__hint">Loading…</p>}
      {error && <p className="names-result__error">{error}</p>}

      {lookup && !lookup.available && (
        <div className="names-card">
          <div className="names-detail-grid">
            <div><span>Owner</span> <code>{lookup.owner}</code></div>
            {lookup.addr && <div><span>Resolves to</span> <code>{lookup.addr}</code></div>}
          </div>

          {isOwner && !wrongChain && (
            <div className="names-edit">
              <h3>Set address record</h3>
              <p>Update what address this name resolves to. Two transactions: setResolver + setAddr (if the resolver isn&apos;t already set).</p>
              <input
                type="text"
                className="names-edit__input"
                placeholder="0x… (target Lithosphere address)"
                value={addrInput}
                onChange={(e) => setAddrInput(e.target.value)}
              />
              <button
                type="button"
                className="names-cta"
                onClick={onSaveAddr}
                disabled={saving || !ethers.utils.isAddress(addrInput) || addrInput.toLowerCase() === (lookup.addr || '').toLowerCase()}
              >
                {saving ? 'Saving…' : 'Save address record'}
              </button>
              {savedTx && (
                <div className="names-success">
                  <StatusBadge tone="success">Saved</StatusBadge>
                  <a href={`${CHAIN_CONFIG.explorerUrl}/tx/${savedTx}`} target="_blank" rel="noreferrer">View tx ↗</a>
                </div>
              )}
            </div>
          )}

          {!isOwner && wallet.isConnected && (
            <p className="names-page__hint">You&apos;re not the owner — read-only.</p>
          )}
          {!wallet.isConnected && (
            <button type="button" className="names-cta" onClick={() => wallet.connect()}>
              Connect Wallet
            </button>
          )}
        </div>
      )}

      {lookup && lookup.available && (
        <div className="names-card">
          <p className="names-page__hint">This name is available — go register it.</p>
          <button type="button" className="names-cta" onClick={() => navigate(`/names?q=${label}`)}>
            Register {fullName(label)}
          </button>
        </div>
      )}
    </div>
  );
};

export default NameDetail;
