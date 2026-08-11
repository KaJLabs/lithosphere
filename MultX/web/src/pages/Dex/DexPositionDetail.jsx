import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ethers } from 'ethers5';
import { CHAIN_CONFIG } from '../../config/api';
import { usePageMeta, defaultExplorerDescription } from '../../hooks/usePageMeta';
import { useWallet } from '../../hooks/useWallet';
import { StatusBadge } from '../../components/explorer/ExplorerUI';
import { DEX_CONFIG, FULL_RANGE_TICK_LOWER, FULL_RANGE_TICK_UPPER, tokenByAddress } from '../../data/dexConfig';
import {
  approveToken,
  burnPosition,
  collectFees,
  decreasePosition,
  feeToPercent,
  getAllowance,
  getBalance,
  getPoolByPair,
  getPoolState,
  getPosition,
  getPositionTokenAmounts,
  getTokenMeta,
  increasePosition,
  tickToPrice,
} from '../../services/dexService';
import { formatBN } from '../../helpers/formatBN';
import { friendlyError } from '../../helpers/friendlyError';
import { DexSubnav } from './DexSubnav';
import '../../scss/pages/Explorer/explorerPage.scss';
import '../../scss/pages/Dex/dexPage.scss';

const SLIPPAGE_BPS = 50;
const NPM = DEX_CONFIG.nonfungiblePositionManager;

const truncate = (addr, head = 8, tail = 6) =>
  addr ? `${addr.slice(0, head)}...${addr.slice(-tail)}` : '-';

const formatPrice = (value) => {
  if (!Number.isFinite(value) || value <= 0) return '-';
  return value.toLocaleString(undefined, { maximumSignificantDigits: 8 });
};

const formatApprox = (value) => {
  if (!Number.isFinite(value) || value <= 0) return '0';
  return value.toLocaleString(undefined, { maximumSignificantDigits: 8 });
};

const parseUnitsOrZero = (value, decimals) => {
  if (!value || isNaN(Number(value)) || Number(value) <= 0) return ethers.constants.Zero;
  return ethers.utils.parseUnits(value, decimals);
};

export const DexPositionDetail = () => {
  const { tokenId } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const wallet = useWallet();
  usePageMeta(`LP Position #${tokenId}`, defaultExplorerDescription);

  const wrongChain = wallet.isConnected && wallet.chainId !== CHAIN_CONFIG.evmChainId;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [balance0, setBalance0] = useState(null);
  const [balance1, setBalance1] = useState(null);
  const [allowance0, setAllowance0] = useState(null);
  const [allowance1, setAllowance1] = useState(null);
  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  const [decreasePct, setDecreasePct] = useState('50');
  const [step, setStep] = useState('idle'); // idle | increasing | decreasing | collecting | burning | success | error
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const load = useCallback(async () => {
    if (!tokenId) return;
    setLoading(true);
    setLoadError('');
    try {
      const position = await getPosition(tokenId);
      if (
        position.token0.toLowerCase() === ethers.constants.AddressZero.toLowerCase() ||
        position.token1.toLowerCase() === ethers.constants.AddressZero.toLowerCase()
      ) {
        throw new Error('Position not found or already burned.');
      }

      const [meta0, meta1, poolAddress] = await Promise.all([
        tokenByAddress(position.token0) ?? getTokenMeta(position.token0),
        tokenByAddress(position.token1) ?? getTokenMeta(position.token1),
        getPoolByPair(position.token0, position.token1, position.fee),
      ]);

      const poolState = poolAddress && poolAddress !== ethers.constants.AddressZero
        ? await getPoolState(poolAddress)
        : null;
      const amounts = poolState
        ? getPositionTokenAmounts({
            liquidity: position.liquidity,
            tickLower: position.tickLower,
            tickUpper: position.tickUpper,
            currentTick: poolState.tick,
            decimals0: meta0.decimals,
            decimals1: meta1.decimals,
          })
        : { amount0: 0, amount1: 0 };

      setData({ position, meta0, meta1, poolAddress, poolState, amounts });
    } catch (err) {
      setLoadError(err?.message || 'Failed to load position.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [tokenId]);

  useEffect(() => { load(); }, [load]);

  const refreshOwnerState = useCallback(async () => {
    if (!wallet.account || wrongChain || !data) {
      setBalance0(null);
      setBalance1(null);
      setAllowance0(null);
      setAllowance1(null);
      return;
    }
    try {
      const [b0, b1, a0, a1] = await Promise.all([
        getBalance({ token: data.position.token0, owner: wallet.account }),
        getBalance({ token: data.position.token1, owner: wallet.account }),
        getAllowance({ token: data.position.token0, owner: wallet.account, spender: NPM }),
        getAllowance({ token: data.position.token1, owner: wallet.account, spender: NPM }),
      ]);
      setBalance0(b0);
      setBalance1(b1);
      setAllowance0(a0);
      setAllowance1(a1);
    } catch {
      setBalance0(null);
      setBalance1(null);
      setAllowance0(null);
      setAllowance1(null);
    }
  }, [wallet.account, wrongChain, data]);

  useEffect(() => { refreshOwnerState(); }, [refreshOwnerState]);

  const parsed0 = useMemo(() => {
    if (!data) return ethers.constants.Zero;
    try { return parseUnitsOrZero(amount0, data.meta0.decimals); } catch { return ethers.constants.Zero; }
  }, [amount0, data]);

  const parsed1 = useMemo(() => {
    if (!data) return ethers.constants.Zero;
    try { return parseUnitsOrZero(amount1, data.meta1.decimals); } catch { return ethers.constants.Zero; }
  }, [amount1, data]);

  const decreaseLiquidity = useMemo(() => {
    if (!data) return ethers.constants.Zero;
    const pct = Math.max(0, Math.min(100, Number(decreasePct)));
    if (!Number.isFinite(pct) || pct <= 0) return ethers.constants.Zero;
    return data.position.liquidity.mul(Math.round(pct * 100)).div(10_000);
  }, [data, decreasePct]);

  const canManage = Boolean(
    wallet.account &&
    data?.position.owner &&
    data.position.owner.toLowerCase() === wallet.account.toLowerCase()
  );

  const needsApproval0 = parsed0.gt(0) && (!allowance0 || allowance0.lt(parsed0));
  const needsApproval1 = parsed1.gt(0) && (!allowance1 || allowance1.lt(parsed1));
  const canBurn = Boolean(data) &&
    data.position.liquidity.eq(0) &&
    data.position.tokensOwed0.eq(0) &&
    data.position.tokensOwed1.eq(0);

  const rangeStatus = useMemo(() => {
    if (!data?.poolState) return { tone: 'neutral', label: 'Pool unavailable' };
    const tick = data.poolState.tick;
    if (tick < data.position.tickLower) return { tone: 'failed', label: 'Out of range: below' };
    if (tick >= data.position.tickUpper) return { tone: 'failed', label: 'Out of range: above' };
    return { tone: 'success', label: 'In range' };
  }, [data]);

  const priceRange = useMemo(() => {
    if (!data) return null;
    const fullRange =
      data.position.tickLower === FULL_RANGE_TICK_LOWER &&
      data.position.tickUpper === FULL_RANGE_TICK_UPPER;
    return {
      fullRange,
      lower: tickToPrice(data.position.tickLower, data.meta0.decimals, data.meta1.decimals),
      upper: tickToPrice(data.position.tickUpper, data.meta0.decimals, data.meta1.decimals),
      current: data.poolState
        ? tickToPrice(data.poolState.tick, data.meta0.decimals, data.meta1.decimals)
        : null,
    };
  }, [data]);

  const runAction = async (action, message) => {
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    setTxHash('');
    try {
      const hash = await action();
      setTxHash(typeof hash === 'string' ? hash : hash?.txHash);
      setSuccessMsg(message);
      setStep('success');
      await load();
      await refreshOwnerState();
    } catch (err) {
      const msg = friendlyError(err);
      if (msg === null) {
        setStep('idle');
      } else {
        setErrorMsg(msg);
        setStep('error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleIncrease = async () => {
    if (!wallet.signer || !data || (!parsed0.gt(0) && !parsed1.gt(0))) return;
    await runAction(async () => {
      if (needsApproval0) {
        await approveToken({
          signer: wallet.signer,
          token: data.position.token0,
          amount: ethers.constants.MaxUint256,
          spender: NPM,
        });
      }
      if (needsApproval1) {
        await approveToken({
          signer: wallet.signer,
          token: data.position.token1,
          amount: ethers.constants.MaxUint256,
          spender: NPM,
        });
      }
      setStep('increasing');
      const result = await increasePosition({
        signer: wallet.signer,
        tokenId,
        amount0: parsed0,
        amount1: parsed1,
        slippageBps: SLIPPAGE_BPS,
      });
      setAmount0('');
      setAmount1('');
      return result;
    }, 'Liquidity increased');
  };

  const handleDecrease = async () => {
    if (!wallet.signer || !data || decreaseLiquidity.lte(0)) return;
    setStep('decreasing');
    await runAction(() => decreasePosition({
      signer: wallet.signer,
      tokenId,
      liquidity: decreaseLiquidity,
      slippageBps: SLIPPAGE_BPS,
    }), 'Liquidity decreased. Collect to transfer tokens to your wallet.');
  };

  const handleCollect = async () => {
    if (!wallet.signer || !wallet.account) return;
    setStep('collecting');
    await runAction(() => collectFees({
      signer: wallet.signer,
      tokenId,
      recipient: wallet.account,
    }), 'Fees and withdrawn liquidity collected');
  };

  const handleBurn = async () => {
    if (!wallet.signer || !canBurn) return;
    setStep('burning');
    await runAction(async () => {
      const hash = await burnPosition({ signer: wallet.signer, tokenId });
      navigate('/dex/positions');
      return hash;
    }, 'Position burned');
  };

  const actionDisabled = submitting || !wallet.isConnected || wrongChain || !canManage;

  return (
    <div className="dex-page">
      <header className="dex-page__header">
        <span className="dex-page__eyebrow">{CHAIN_CONFIG.networkLabel}</span>
        <h1 className="dex-page__title">LP Position #{tokenId}</h1>
        <p className="dex-page__subtitle">
          {data ? `${data.meta0.symbol} / ${data.meta1.symbol} - ${feeToPercent(data.position.fee)} fee tier` : 'Liquidity position NFT'}
        </p>
      </header>

      <DexSubnav pathname={pathname} />

      {loading && <div className="dex-empty">Loading position...</div>}
      {loadError && <div className="dex-empty">{loadError}</div>}

      {data && (
        <div className="dex-position-detail">
          <div className="dex-stat-card">
            <h2 className="dex-stat-card__title">Position</h2>
            <div className="dex-stat-card__row">
              <span>Status</span>
              <StatusBadge tone={rangeStatus.tone}>{rangeStatus.label}</StatusBadge>
            </div>
            <div className="dex-stat-card__row">
              <span>NFT token ID</span>
              <span>#{data.position.tokenId}</span>
            </div>
            <div className="dex-stat-card__row">
              <span>Owner</span>
              <a href={`${CHAIN_CONFIG.explorerUrl}/address/${data.position.owner}`} target="_blank" rel="noreferrer">
                {truncate(data.position.owner)}
              </a>
            </div>
            <div className="dex-stat-card__row">
              <span>Liquidity</span>
              <span className="dex-stat-card__mono">{data.position.liquidity.toString()}</span>
            </div>
            <div className="dex-stat-card__row">
              <span>Tick range</span>
              <span>{data.position.tickLower} to {data.position.tickUpper}</span>
            </div>
          </div>

          <div className="dex-stat-card">
            <h2 className="dex-stat-card__title">Price Range</h2>
            <div className="dex-stat-card__row">
              <span>Current price</span>
              <span>1 {data.meta0.symbol} ~= {formatPrice(priceRange?.current)} {data.meta1.symbol}</span>
            </div>
            <div className="dex-stat-card__row">
              <span>Min price</span>
              <span>{priceRange?.fullRange ? 'Full range' : `1 ${data.meta0.symbol} ~= ${formatPrice(priceRange?.lower)} ${data.meta1.symbol}`}</span>
            </div>
            <div className="dex-stat-card__row">
              <span>Max price</span>
              <span>{priceRange?.fullRange ? 'Full range' : `1 ${data.meta0.symbol} ~= ${formatPrice(priceRange?.upper)} ${data.meta1.symbol}`}</span>
            </div>
            <div className="dex-stat-card__row">
              <span>Pool</span>
              <Link to={`/dex/pool/${data.poolAddress}`}>{truncate(data.poolAddress)}</Link>
            </div>
          </div>

          <div className="dex-stat-card">
            <h2 className="dex-stat-card__title">Current Value</h2>
            <div className="dex-stat-card__row">
              <span>{data.meta0.symbol} in position</span>
              <span>{formatApprox(data.amounts.amount0)}</span>
            </div>
            <div className="dex-stat-card__row">
              <span>{data.meta1.symbol} in position</span>
              <span>{formatApprox(data.amounts.amount1)}</span>
            </div>
            <div className="dex-stat-card__row">
              <span>Fees owed ({data.meta0.symbol})</span>
              <span>{formatBN(data.position.tokensOwed0, data.meta0.decimals, 6)}</span>
            </div>
            <div className="dex-stat-card__row">
              <span>Fees owed ({data.meta1.symbol})</span>
              <span>{formatBN(data.position.tokensOwed1, data.meta1.decimals, 6)}</span>
            </div>
          </div>

          <div className="dex-action-card">
            <h2 className="dex-action-card__title">Increase Liquidity</h2>
            <div className="dex-action-card__grid">
              <label className="dex-action-card__field">
                <span>{data.meta0.symbol}</span>
                {balance0 !== null && <small>Balance {formatBN(balance0, data.meta0.decimals, 4)}</small>}
                <input
                  type="number"
                  min="0"
                  step="0.000001"
                  value={amount0}
                  onChange={(e) => setAmount0(e.target.value)}
                  placeholder="0.0"
                />
              </label>
              <label className="dex-action-card__field">
                <span>{data.meta1.symbol}</span>
                {balance1 !== null && <small>Balance {formatBN(balance1, data.meta1.decimals, 4)}</small>}
                <input
                  type="number"
                  min="0"
                  step="0.000001"
                  value={amount1}
                  onChange={(e) => setAmount1(e.target.value)}
                  placeholder="0.0"
                />
              </label>
            </div>
            <button
              type="button"
              className="dex-card__cta"
              onClick={handleIncrease}
              disabled={
                actionDisabled ||
                (!parsed0.gt(0) && !parsed1.gt(0)) ||
                (balance0 && parsed0.gt(balance0)) ||
                (balance1 && parsed1.gt(balance1))
              }
            >
              {submitting && step === 'increasing'
                ? 'Increasing...'
                : needsApproval0
                ? `Approve ${data.meta0.symbol}`
                : needsApproval1
                ? `Approve ${data.meta1.symbol}`
                : 'Increase Liquidity'}
            </button>
          </div>

          <div className="dex-action-card">
            <h2 className="dex-action-card__title">Decrease Liquidity</h2>
            <div className="dex-range-presets">
              {['25', '50', '75', '100'].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  className={decreasePct === pct ? 'dex-range-presets__button dex-range-presets__button--active' : 'dex-range-presets__button'}
                  onClick={() => setDecreasePct(pct)}
                >
                  {pct}%
                </button>
              ))}
            </div>
            <label className="dex-action-card__field">
              <span>Remove percent</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={decreasePct}
                onChange={(e) => setDecreasePct(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="dex-card__cta"
              onClick={handleDecrease}
              disabled={actionDisabled || data.position.liquidity.eq(0) || decreaseLiquidity.lte(0)}
            >
              {submitting && step === 'decreasing' ? 'Decreasing...' : 'Decrease Liquidity'}
            </button>
            <p className="dex-action-card__hint">After decreasing, collect to transfer the withdrawn tokens.</p>
          </div>

          <div className="dex-action-card">
            <h2 className="dex-action-card__title">Collect and Burn</h2>
            <button
              type="button"
              className="dex-card__cta"
              onClick={handleCollect}
              disabled={actionDisabled}
            >
              {submitting && step === 'collecting' ? 'Collecting...' : 'Collect Fees'}
            </button>
            <button
              type="button"
              className="dex-action-card__danger"
              onClick={handleBurn}
              disabled={actionDisabled || !canBurn}
            >
              {submitting && step === 'burning' ? 'Burning...' : 'Burn Position'}
            </button>
            {!canBurn && (
              <p className="dex-action-card__hint">Burn is enabled after liquidity is zero and all owed tokens are collected.</p>
            )}
          </div>

          {!wallet.isConnected && (
            <div className="dex-empty">
              Connect your wallet to manage this position.
              <br />
              <button type="button" className="dex-inline-button" onClick={() => wallet.connect()}>
                Connect Wallet
              </button>
            </div>
          )}
          {wallet.isConnected && wrongChain && (
            <div className="dex-empty">
              Switch to Kamet to manage this position.
              <br />
              <button type="button" className="dex-inline-button" onClick={() => wallet.switchToLithoChain()}>
                Switch to Kamet
              </button>
            </div>
          )}
          {wallet.isConnected && !wrongChain && !canManage && (
            <div className="dex-empty">This wallet is not the owner of position #{tokenId}.</div>
          )}

          {step === 'success' && successMsg && (
            <div className="dex-card__success dex-position-detail__status">
              <StatusBadge tone="success">{successMsg}</StatusBadge>
              {txHash && <a href={`${CHAIN_CONFIG.explorerUrl}/tx/${txHash}`} target="_blank" rel="noreferrer">View tx</a>}
            </div>
          )}
          {step === 'error' && errorMsg && (
            <p className="dex-card__error dex-position-detail__status">{errorMsg}</p>
          )}

          <Link to="/dex/positions" className="dex-back-link">Back to positions</Link>
        </div>
      )}
    </div>
  );
};

export default DexPositionDetail;
