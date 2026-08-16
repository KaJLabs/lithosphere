import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { CHAIN_CONFIG } from '../../config/api';
import { usePageMeta, defaultExplorerDescription } from '../../hooks/usePageMeta';
import { tokenByAddress } from '../../data/dexConfig';
import {
  feeToPercent,
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

const truncate = (addr, head = 8, tail = 6) =>
  addr ? `${addr.slice(0, head)}...${addr.slice(-tail)}` : '-';

const formatWlithoVolume = (data) => {
  if (!data?.volume || data.volume.error) return 'Unavailable';
  if (data.meta0.symbol === 'wLITHO') return `~${formatBN(data.volume.vol0, data.meta0.decimals, 4)} wLITHO`;
  if (data.meta1.symbol === 'wLITHO') return `~${formatBN(data.volume.vol1, data.meta1.decimals, 4)} wLITHO`;
  return `~${formatBN(data.volume.vol0, data.meta0.decimals, 4)} ${data.meta0.symbol}`;
};

export const DexPoolDetail = () => {
  const { address } = useParams();
  const { pathname } = useLocation();
  usePageMeta(`Pool ${address?.slice(0, 8)}...`, defaultExplorerDescription);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const state = await getPoolState(address);
        const [meta0, meta1] = await Promise.all([
          tokenByAddress(state.token0) ?? getTokenMeta(state.token0),
          tokenByAddress(state.token1) ?? getTokenMeta(state.token1),
        ]);
        const { price1per0, price0per1 } = priceFromSqrtPriceX96(
          state.sqrtPriceX96,
          meta0.decimals,
          meta1.decimals
        );
        const [reserves, volume] = await Promise.all([
          getPoolReserves(address, state.token0, state.token1),
          getPool24hVolume(address).catch((err) => ({ error: err?.message || 'Volume read failed' })),
        ]);
        if (!cancelled) {
          setData({
            state,
            meta0,
            meta1,
            price1per0,
            price0per1,
            reserves,
            volume,
          });
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Failed to load pool');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (address) load();
    return () => { cancelled = true; };
  }, [address]);

  return (
    <div className="dex-page">
      <header className="dex-page__header">
        <span className="dex-page__eyebrow">{CHAIN_CONFIG.networkLabel}</span>
        <h1 className="dex-page__title">
          {loading
            ? 'Loading pool...'
            : data
            ? `${data.meta0.symbol} / ${data.meta1.symbol}`
            : 'Pool'}
        </h1>
        <p className="dex-page__subtitle">
          {data ? `${feeToPercent(data.state.fee)} fee tier - ${truncate(address)}` : address}
        </p>
      </header>

      <DexSubnav pathname={pathname} />

      {error && <div className="dex-empty">{error}</div>}

      {data && (
        <div className="dex-pool-detail">
          <div className="dex-stat-card">
            <h2 className="dex-stat-card__title">Price</h2>
            <div className="dex-stat-card__row">
              <span>1 {data.meta0.symbol}</span>
              <span>~= {data.price1per0.toLocaleString(undefined, { maximumSignificantDigits: 6 })} {data.meta1.symbol}</span>
            </div>
            <div className="dex-stat-card__row">
              <span>1 {data.meta1.symbol}</span>
              <span>~= {data.price0per1.toLocaleString(undefined, { maximumSignificantDigits: 6 })} {data.meta0.symbol}</span>
            </div>
            <div className="dex-stat-card__row">
              <span>Current tick</span>
              <span>{data.state.tick.toString()}</span>
            </div>
          </div>

          <div className="dex-stat-card">
            <h2 className="dex-stat-card__title">24h Volume</h2>
            <div className="dex-stat-card__row">
              <span>wLITHO volume</span>
              <span>{formatWlithoVolume(data)}</span>
            </div>
            <div className="dex-stat-card__row">
              <span>Swaps scanned</span>
              <span>{data.volume?.swapCount ?? '-'}</span>
            </div>
            <div className="dex-stat-card__row">
              <span>Block window</span>
              <span>{data.volume?.fromBlock ?? '-'} to {data.volume?.toBlock ?? '-'}</span>
            </div>
          </div>

          <div className="dex-stat-card">
            <h2 className="dex-stat-card__title">Liquidity</h2>
            <div className="dex-stat-card__row">
              <span>{data.meta0.symbol} reserve</span>
              <span>{formatBN(data.reserves.reserve0, data.meta0.decimals, 4)}</span>
            </div>
            <div className="dex-stat-card__row">
              <span>{data.meta1.symbol} reserve</span>
              <span>{formatBN(data.reserves.reserve1, data.meta1.decimals, 4)}</span>
            </div>
            <div className="dex-stat-card__row">
              <span>In-range liquidity</span>
              <span className="dex-stat-card__mono">{data.state.liquidity.toString()}</span>
            </div>
          </div>

          <div className="dex-stat-card">
            <h2 className="dex-stat-card__title">Contract</h2>
            <div className="dex-stat-card__row">
              <span>Pool address</span>
              <a href={`${CHAIN_CONFIG.explorerUrl}/address/${address}`} target="_blank" rel="noreferrer">
                {truncate(address)}
              </a>
            </div>
            <div className="dex-stat-card__row">
              <span>{data.meta0.symbol}</span>
              <a href={`${CHAIN_CONFIG.explorerUrl}/token/${data.state.token0}`} target="_blank" rel="noreferrer">
                {truncate(data.state.token0)}
              </a>
            </div>
            <div className="dex-stat-card__row">
              <span>{data.meta1.symbol}</span>
              <a href={`${CHAIN_CONFIG.explorerUrl}/token/${data.state.token1}`} target="_blank" rel="noreferrer">
                {truncate(data.state.token1)}
              </a>
            </div>
          </div>

          <div className="dex-actions-row">
            <Link to={`/dex/swap?in=${data.meta0.symbol}&out=${data.meta1.symbol}`} className="dex-actions-row__primary">
              Swap
            </Link>
            <Link
              to={`/dex/positions/new?token0=${data.state.token0}&token1=${data.state.token1}&fee=${data.state.fee}`}
              className="dex-actions-row__secondary"
            >
              Add Liquidity
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default DexPoolDetail;
