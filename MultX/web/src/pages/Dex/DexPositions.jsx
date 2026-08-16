import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CHAIN_CONFIG } from '../../config/api';
import { usePageMeta, defaultExplorerDescription } from '../../hooks/usePageMeta';
import { useWallet } from '../../hooks/useWallet';
import { tokenByAddress } from '../../data/dexConfig';
import { getUserPositions, getTokenMeta } from '../../services/dexService';
import { formatBN } from '../../helpers/formatBN';
import { DexSubnav } from './DexSubnav';
import '../../scss/pages/Explorer/explorerPage.scss';
import '../../scss/pages/Dex/dexPage.scss';

const feePct = (fee) => `${(Number(fee) / 10_000).toFixed(2)}%`;

export const DexPositions = () => {
  usePageMeta('My LP Positions', defaultExplorerDescription);
  const { pathname } = useLocation();
  const wallet = useWallet();
  const wrongChain = wallet.isConnected && wallet.chainId !== CHAIN_CONFIG.evmChainId;

  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!wallet.account || wrongChain) return;
    setLoading(true);
    setError('');
    try {
      const raw = await getUserPositions(wallet.account);

      // Resolve token metadata for any unknown addresses
      const unknownAddrs = new Set();
      raw.forEach((p) => {
        if (!tokenByAddress(p.token0)) unknownAddrs.add(p.token0);
        if (!tokenByAddress(p.token1)) unknownAddrs.add(p.token1);
      });
      const resolved = {};
      await Promise.all(
        [...unknownAddrs].map(async (a) => { resolved[a.toLowerCase()] = await getTokenMeta(a); })
      );
      const meta = (addr) =>
        tokenByAddress(addr) ?? resolved[addr.toLowerCase()] ?? { symbol: addr.slice(0, 6), decimals: 18 };

      const enriched = raw.map((p) => ({
        ...p,
        meta0: meta(p.token0),
        meta1: meta(p.token1),
      }));
      setPositions(enriched);
    } catch (err) {
      setError(err?.message || 'Failed to load positions');
    } finally {
      setLoading(false);
    }
  }, [wallet.account, wrongChain]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="dex-page">
      <header className="dex-page__header">
        <span className="dex-page__eyebrow">{CHAIN_CONFIG.networkLabel}</span>
        <h1 className="dex-page__title">My Positions</h1>
        <p className="dex-page__subtitle">
          Your LP positions on Lithosphere DEX. Each position is a transferable NFT.
        </p>
      </header>

      <DexSubnav pathname={pathname} />

      {!wallet.isConnected && (
        <div className="dex-empty">
          Connect your wallet to view your LP positions.
          <br />
          <button
            type="button"
            onClick={() => wallet.connect()}
            style={{
              marginTop: 16,
              padding: '10px 20px',
              background: 'var(--button-color)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Connect Wallet
          </button>
        </div>
      )}

      {wallet.isConnected && wrongChain && (
        <div className="dex-empty">
          Switch to Kamet to view your positions.
          <br />
          <button
            type="button"
            onClick={() => wallet.switchToLithoChain()}
            style={{
              marginTop: 16,
              padding: '10px 20px',
              background: 'var(--button-color)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Switch to Kamet
          </button>
        </div>
      )}

      {wallet.isConnected && !wrongChain && (
        <>
          {loading && <div className="dex-empty">Loading…</div>}
          {error && <div className="dex-empty">{error}</div>}
          {!loading && !error && positions.length === 0 && (
            <div className="dex-empty">
              No LP positions yet.
              <br />
              <Link to="/dex/positions/new">Add liquidity →</Link>
            </div>
          )}
          {!loading && positions.length > 0 && (
            <div className="dex-position-list">
              {positions.map((p) => (
                <div key={p.tokenId} className="dex-position-card">
                  <div className="dex-position-card__head">
                    <span className="dex-position-card__pair">
                      {p.meta0.symbol} / {p.meta1.symbol}
                      <span className="dex-position-card__id">#{p.tokenId}</span>
                    </span>
                    <span className="dex-position-card__fee">{feePct(p.fee)}</span>
                  </div>
                  <div className="dex-position-card__grid">
                    <div className="dex-position-card__cell">
                      <span>Liquidity</span>
                      <span>{p.liquidity.toString()}</span>
                    </div>
                    <div className="dex-position-card__cell">
                      <span>Range</span>
                      <span>{p.tickLower} → {p.tickUpper}</span>
                    </div>
                    <div className="dex-position-card__cell">
                      <span>Fees owed ({p.meta0.symbol})</span>
                      <span>{formatBN(p.tokensOwed0, p.meta0.decimals, 6)}</span>
                    </div>
                    <div className="dex-position-card__cell">
                      <span>Fees owed ({p.meta1.symbol})</span>
                      <span>{formatBN(p.tokensOwed1, p.meta1.decimals, 6)}</span>
                    </div>
                  </div>
                  <Link
                    to={`/dex/positions/${p.tokenId}`}
                    style={{ color: '#0b85ff', textDecoration: 'none', fontSize: 12, marginTop: 4 }}
                  >
                    View NFT
                  </Link>
                </div>
              ))}
            </div>
          )}
          <Link
            to="/dex/positions/new"
            style={{
              marginTop: 4,
              padding: '12px 28px',
              background: 'var(--button-color)',
              color: '#fff',
              borderRadius: 12,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            + New Position
          </Link>
        </>
      )}
    </div>
  );
};

export default DexPositions;
