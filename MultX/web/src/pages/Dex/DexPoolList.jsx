import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CHAIN_CONFIG } from '../../config/api';
import { usePageMeta, defaultExplorerDescription } from '../../hooks/usePageMeta';
import { tokenByAddress } from '../../data/dexConfig';
import {
  feeToPercent,
  getAllPools,
  getConfiguredPools,
  getPool24hVolume,
  getPoolReserves,
  getPoolState,
  getTokenMeta,
  priceFromSqrtPriceX96,
} from '../../services/dexService';
import { formatBN } from '../../helpers/formatBN';
import { DexSubnav } from './DexSubnav';
import '../../scss/pages/Explorer/explorerPage.scss';
import '../../scss/pages/Dex/dexPage.scss';

const SkeletonCard = () => (
  <div className="dex-pool-card" aria-hidden="true" style={{ pointerEvents: 'none' }}>
    <div className="dex-pool-card__head">
      <div className="dex-pool-card__skeleton" style={{ width: 120 }} />
      <div className="dex-pool-card__skeleton" style={{ width: 50, height: 22 }} />
    </div>
    <div className="dex-pool-card__skeleton" style={{ width: '70%' }} />
    <div className="dex-pool-card__skeleton" style={{ width: '60%' }} />
    <div className="dex-pool-card__skeleton" style={{ width: '55%' }} />
  </div>
);

const formatPoolVolume = (pool) => {
  if (!pool.volume) return 'Loading...';
  if (pool.volume.error) return 'Unavailable';
  const sym0 = pool.meta0?.symbol ?? 'token0';
  const sym1 = pool.meta1?.symbol ?? 'token1';
  if (sym0 === 'wLITHO') return `~${formatBN(pool.volume.vol0, pool.meta0.decimals, 4)} wLITHO`;
  if (sym1 === 'wLITHO') return `~${formatBN(pool.volume.vol1, pool.meta1.decimals, 4)} wLITHO`;
  return `~${formatBN(pool.volume.vol0, pool.meta0?.decimals ?? 18, 4)} ${sym0}`;
};

export const DexPoolList = () => {
  usePageMeta('DEX Pools', defaultExplorerDescription);
  const { pathname } = useLocation();
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [discoveryError, setDiscoveryError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setDiscoveryError('');
      let discovered;
      try {
        discovered = await getAllPools();
      } catch (err) {
        discovered = [];
        if (!cancelled) setDiscoveryError(err?.message || 'Pool discovery failed; using configured pools.');
      }

      const sourcePools = discovered.length > 0 ? discovered : getConfiguredPools();
      try {
        const enriched = await Promise.all(
          sourcePools.map(async (pool) => {
            try {
              const state = await getPoolState(pool.address);
              const [meta0, meta1] = await Promise.all([
                tokenByAddress(state.token0) ?? getTokenMeta(state.token0),
                tokenByAddress(state.token1) ?? getTokenMeta(state.token1),
              ]);
              const { price1per0 } = priceFromSqrtPriceX96(state.sqrtPriceX96, meta0.decimals, meta1.decimals);
              const [reserves, volume] = await Promise.all([
                getPoolReserves(pool.address, state.token0, state.token1),
                getPool24hVolume(pool.address).catch((err) => ({ error: err?.message || 'Volume read failed' })),
              ]);
              return {
                ...pool,
                state,
                meta0,
                meta1,
                price1per0,
                reserve0: reserves.reserve0,
                reserve1: reserves.reserve1,
                volume,
              };
            } catch (err) {
              return { ...pool, error: err?.message || 'Read failed' };
            }
          })
        );
        if (!cancelled) setPools(enriched);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="dex-page">
      <header className="dex-page__header">
        <span className="dex-page__eyebrow">{CHAIN_CONFIG.networkLabel}</span>
        <h1 className="dex-page__title">Pools</h1>
        <p className="dex-page__subtitle">
          Liquidity pools discovered from the Lithosphere DEX factory.
        </p>
      </header>

      <DexSubnav pathname={pathname} />

      {discoveryError && <div className="dex-pool-note">{discoveryError}</div>}

      <div className="dex-pool-list">
        {loading
          ? Array.from({ length: 3 }, (_, i) => <SkeletonCard key={i} />)
          : pools.map((pool) => {
              const sym0 = pool.meta0?.symbol ?? pool.state?.token0?.slice(0, 6) ?? '?';
              const sym1 = pool.meta1?.symbol ?? pool.state?.token1?.slice(0, 6) ?? '?';
              const price = Number.isFinite(pool.price1per0)
                ? pool.price1per0.toLocaleString(undefined, { maximumSignificantDigits: 6 })
                : '-';
              return (
                <Link key={pool.address} to={`/dex/pool/${pool.address}`} className="dex-pool-card">
                  <div className="dex-pool-card__head">
                    <span className="dex-pool-card__pair">{sym0} / {sym1}</span>
                    <span className="dex-pool-card__fee">{pool.state ? feeToPercent(pool.state.fee) : feeToPercent(pool.fee)}</span>
                  </div>
                  {pool.error ? (
                    <p className="dex-card__error">{pool.error}</p>
                  ) : (
                    <>
                      <div className="dex-pool-card__volume">
                        <span>{formatPoolVolume(pool)}</span>
                        <small>24h volume</small>
                      </div>
                      <div className="dex-pool-card__row">
                        <span>Price</span>
                        <span>1 {sym0} ~= {price} {sym1}</span>
                      </div>
                      <div className="dex-pool-card__row">
                        <span>{sym0} reserve</span>
                        <span>{pool.reserve0 ? formatBN(pool.reserve0, pool.meta0?.decimals ?? 18, 4) : '-'}</span>
                      </div>
                      <div className="dex-pool-card__row">
                        <span>{sym1} reserve</span>
                        <span>{pool.reserve1 ? formatBN(pool.reserve1, pool.meta1?.decimals ?? 18, 4) : '-'}</span>
                      </div>
                    </>
                  )}
                </Link>
              );
            })}
      </div>
    </div>
  );
};

export default DexPoolList;
