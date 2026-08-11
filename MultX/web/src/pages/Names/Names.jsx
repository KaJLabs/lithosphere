import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CHAIN_CONFIG } from '../../config/api';
import { usePageMeta, defaultExplorerDescription } from '../../hooks/usePageMeta';
import { useWallet } from '../../hooks/useWallet';
import { StatusBadge } from '../../components/explorer/ExplorerUI';
import {
  DNNS_CONFIG,
  normalizeLabel,
  isValidLabel,
  fullName,
} from '../../data/dnnsConfig';
import {
  lookupName,
  commitRegistration,
  completeRegistration,
  saveCommit,
  loadCommit,
  clearCommit,
  getNamesOwnedBy,
  getCachedNamesOwnedBy,
} from '../../services/namesService';
import '../../scss/pages/Names/namesPage.scss';

const QUERY_DEBOUNCE_MS = 350;

const shorten = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

// Translate ethers / MetaMask errors into a short, friendly UI string.
// Returns null when the user simply cancelled — we don't surface those.
const friendlyError = (err) => {
  if (!err) return null;
  const code = err.code || err.error?.code || err.data?.code;
  // 4001 = user rejected (MetaMask EIP-1193); ACTION_REJECTED = ethers v5 wrapper
  if (code === 4001 || code === 'ACTION_REJECTED') return null;
  const reason = err.reason || err.error?.message || err.data?.message;
  if (reason) return reason;
  const msg = err.message || '';
  // Strip the noisy bracketed transaction blob ethers prepends
  const truncated = msg.split(' (action=')[0].split(' [')[0].trim();
  return truncated.length > 200 ? truncated.slice(0, 200) + '…' : (truncated || 'Transaction failed.');
};

export const Names = () => {
  usePageMeta('Names', defaultExplorerDescription);
  const wallet = useWallet();
  const navigate = useNavigate();

  const [input,    setInput]    = useState('');
  const [lookup,   setLookup]   = useState(null);   // { label, available, owner, addr, expiry }
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [step, setStep] = useState('idle');         // idle | committing | waiting | registering | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const [txHash,   setTxHash]   = useState('');
  const [commitInfo, setCommitInfo] = useState(null); // { commitment, secret, savedAt } from localStorage
  const [now, setNow] = useState(Date.now());
  const [myNames, setMyNames] = useState(null);        // null = not loaded; [] = loaded, empty
  const [myNamesLoading, setMyNamesLoading] = useState(false);
  const [myNamesError, setMyNamesError] = useState('');

  const wrongChain = wallet.isConnected && wallet.chainId !== CHAIN_CONFIG.evmChainId;
  const label = useMemo(() => normalizeLabel(input), [input]);
  const validLabel = isValidLabel(label);

  // 1s timer for the commit-age countdown
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Load names owned by the connected wallet whenever the active account changes.
  // Renders the localStorage cache immediately (if any) so the list is instant on
  // revisit, then refreshes in the background — the background pass only scans
  // blocks added since the last cache write, re-verifies owned tokenIds, and
  // drops anything that's been transferred away.
  const refreshMyNames = useCallback(async () => {
    if (!wallet.isConnected || !wallet.account) {
      setMyNames(null);
      setMyNamesError('');
      return;
    }
    const cached = getCachedNamesOwnedBy(wallet.account);
    if (cached) setMyNames(cached);
    setMyNamesLoading(true);
    setMyNamesError('');
    try {
      const names = await getNamesOwnedBy(wallet.account);
      setMyNames(names);
    } catch (err) {
      if (!cached) setMyNames(null);
      setMyNamesError(err?.message || 'Failed to load your names');
    } finally {
      setMyNamesLoading(false);
    }
  }, [wallet.isConnected, wallet.account]);
  useEffect(() => { refreshMyNames(); }, [refreshMyNames]);

  // Restore any pending commit from localStorage when label changes
  useEffect(() => {
    if (!validLabel) { setCommitInfo(null); return; }
    setCommitInfo(loadCommit(label));
  }, [label, validLabel]);

  // Debounced lookup
  const debounceRef = useRef(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!validLabel) { setLookup(null); setSearchError(''); return; }
    setSearching(true);
    setSearchError('');
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await lookupName(label);
        setLookup(res);
      } catch (err) {
        setLookup(null);
        setSearchError(err?.message || 'Lookup failed');
      } finally {
        setSearching(false);
      }
    }, QUERY_DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [label, validLabel]);

  const onCommit = useCallback(async () => {
    if (!wallet.signer || !validLabel) return;
    setStep('committing'); setErrorMsg(''); setTxHash('');
    try {
      const result = await commitRegistration({
        signer: wallet.signer,
        label,
        owner: wallet.account,
      });
      saveCommit(label, result);
      setCommitInfo({ ...result, savedAt: Date.now() });
      setStep('waiting');
    } catch (err) {
      const msg = friendlyError(err);
      if (msg === null) {
        // User cancelled — return to idle silently
        setStep('idle');
      } else {
        setErrorMsg(msg);
        setStep('error');
      }
    }
  }, [wallet.signer, wallet.account, validLabel, label]);

  const onRegister = useCallback(async () => {
    if (!wallet.signer || !commitInfo) return;
    setStep('registering'); setErrorMsg('');
    try {
      const hash = await completeRegistration({
        signer: wallet.signer,
        label,
        owner: wallet.account,
        secret: commitInfo.secret,
      });
      setTxHash(hash);
      clearCommit(label);
      setCommitInfo(null);
      setStep('success');
      // Refresh lookup to reflect new ownership
      const updated = await lookupName(label);
      setLookup(updated);
      // Refresh the "Your Names" panel so the newly-registered name shows up
      refreshMyNames();
    } catch (err) {
      const msg = friendlyError(err);
      if (msg === null) {
        // Cancelled — keep the commitment so they can try again
        setStep('waiting');
      } else {
        setErrorMsg(msg);
        setStep('error');
      }
    }
  }, [wallet.signer, wallet.account, commitInfo, label, refreshMyNames]);

  // Compute time remaining on commitment
  const elapsedMs    = commitInfo ? now - commitInfo.savedAt : 0;
  const minAgeMs     = DNNS_CONFIG.minCommitmentAge * 1000;
  const remainingMs  = commitInfo ? Math.max(0, minAgeMs - elapsedMs) : 0;
  const canRegister  = commitInfo && elapsedMs >= minAgeMs && elapsedMs < (DNNS_CONFIG.maxCommitmentAge * 1000);

  // ─── Render the result card ────────────────────────────────────────────
  const renderResult = () => {
    if (!input)        return null;
    if (!validLabel)   return <p className="names-result__error">Names must be 3+ characters, lowercase letters, digits, hyphens.</p>;
    if (searching)     return <p className="names-result__hint">Looking up <code>{fullName(label)}</code>…</p>;
    if (searchError)   return <p className="names-result__error">{searchError}</p>;
    if (!lookup)       return null;

    if (lookup.available) {
      // Available — show register flow
      return (
        <div className="names-result">
          <div className="names-result__head">
            <div className="names-result__name">{fullName(label)}</div>
            <StatusBadge tone="success">Available</StatusBadge>
          </div>

          {/* Wallet gates */}
          {!wallet.isConnected && (
            <button type="button" className="names-cta" onClick={() => wallet.connect()}>
              Connect Wallet to Register
            </button>
          )}
          {wallet.isConnected && wrongChain && (
            <button type="button" className="names-cta" onClick={() => wallet.switchToLithoChain()}>
              Switch to Kamet
            </button>
          )}

          {/* Register flow */}
          {wallet.isConnected && !wrongChain && !commitInfo && (
            <button type="button" className="names-cta" onClick={onCommit} disabled={step === 'committing'}>
              {step === 'committing' ? 'Submitting commit…' : `Register ${fullName(label)} (free)`}
            </button>
          )}
          {wallet.isConnected && !wrongChain && commitInfo && !canRegister && (
            <div className="names-stage">
              <p>
                Commitment submitted. Waiting{' '}
                <strong>{Math.ceil(remainingMs / 1000)}s</strong>{' '}
                before final registration (front-running protection).
              </p>
              <button type="button" className="names-cta" disabled>
                Wait {Math.ceil(remainingMs / 1000)}s…
              </button>
            </div>
          )}
          {wallet.isConnected && !wrongChain && commitInfo && canRegister && (
            <div className="names-stage">
              <p>Commitment ready. Submit the registration to claim <code>{fullName(label)}</code>.</p>
              <button type="button" className="names-cta" onClick={onRegister} disabled={step === 'registering'}>
                {step === 'registering' ? 'Registering…' : `Register ${fullName(label)}`}
              </button>
            </div>
          )}

          {step === 'success' && txHash && (
            <div className="names-success">
              <StatusBadge tone="success">Registered</StatusBadge>
              <a href={`${CHAIN_CONFIG.explorerUrl}/tx/${txHash}`} target="_blank" rel="noreferrer">View tx ↗</a>
              <button type="button" className="names-link-btn" onClick={() => navigate(`/names/${label}`)}>
                Manage records →
              </button>
            </div>
          )}
          {step === 'error' && errorMsg && (
            <p className="names-result__error">{errorMsg}</p>
          )}
        </div>
      );
    }

    // Taken — show owner + link to detail
    return (
      <div className="names-result">
        <div className="names-result__head">
          <div className="names-result__name">{fullName(label)}</div>
          <StatusBadge tone="failed">Taken</StatusBadge>
        </div>
        <div className="names-result__meta">
          <div><span>Owner:</span> <code>{shorten(lookup.owner)}</code></div>
          {lookup.addr && <div><span>Resolves to:</span> <code>{shorten(lookup.addr)}</code></div>}
        </div>
        <button type="button" className="names-link-btn" onClick={() => navigate(`/names/${label}`)}>
          View name →
        </button>
      </div>
    );
  };

  return (
    <div className="names-page">
      <header className="names-page__header">
        <span className="names-page__eyebrow">{CHAIN_CONFIG.networkLabel}</span>
        <h1 className="names-page__title">Names</h1>
        <p className="names-page__subtitle">
          Register a <code>.litho</code> name on the Lithosphere DNNS. Free on testnet.
        </p>
      </header>

      {wallet.isConnected && (
        <div className="names-card names-mine">
          <div className="names-mine__head">
            <div>
              <h2 className="names-mine__title">Your Names</h2>
              <p className="names-mine__sub">
                Names owned by <code>{shorten(wallet.account)}</code> on Kamet.
              </p>
            </div>
            <button
              type="button"
              className="names-link-btn"
              onClick={refreshMyNames}
              disabled={myNamesLoading}
            >
              {myNamesLoading ? 'Loading…' : 'Refresh'}
            </button>
          </div>

          {myNamesError && <p className="names-result__error">{myNamesError}</p>}

          {myNamesLoading && myNames === null && (
            <p className="names-page__hint">Scanning your registrations…</p>
          )}

          {!myNamesLoading && myNames && myNames.length === 0 && (
            <p className="names-page__hint">
              No <code>.litho</code> names registered to this address yet. Search above to register one.
            </p>
          )}

          {myNames && myNames.length > 0 && (
            <ul className="names-mine__list">
              {myNames.map((n) => (
                <li key={n.tokenId} className="names-mine__item">
                  <div className="names-mine__item-main">
                    <button
                      type="button"
                      className="names-mine__name"
                      onClick={() => navigate(`/names/${n.name}`)}
                      title="Manage this name"
                    >
                      {fullName(n.name)}
                    </button>
                    {n.addr ? (
                      <span className="names-mine__resolves">
                        → <code>{shorten(n.addr)}</code>
                      </span>
                    ) : (
                      <span className="names-mine__resolves names-mine__resolves--empty">
                        no address record
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="names-link-btn"
                    onClick={() => navigate(`/names/${n.name}`)}
                  >
                    Manage →
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="names-card">
        <div className="names-search">
          <input
            type="text"
            className="names-search__input"
            placeholder="alice or alice.litho"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
          />
          <span className="names-search__suffix">.{DNNS_CONFIG.tld}</span>
        </div>

        {renderResult()}
      </div>

      <p className="names-page__hint">
        Reserved names: {DNNS_CONFIG.reservedNames.map((n) => `${n}.litho`).join(', ')}
      </p>
    </div>
  );
};

export default Names;
