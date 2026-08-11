import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ethers } from 'ethers5';
import { CHAIN_CONFIG } from '../../config/api';
import { usePageMeta, defaultExplorerDescription } from '../../hooks/usePageMeta';
import { useWallet } from '../../hooks/useWallet';
import { StatusBadge } from '../../components/explorer/ExplorerUI';
import {
  DEX_CONFIG,
  DEX_TOKENS,
  MAX_TICK,
  tokenBySymbol,
  tokenByAddress,
} from '../../data/dexConfig';
import {
  approveToken,
  clampTick,
  feeToPercent,
  getAllPools,
  getAllowance,
  getBalance,
  getConfiguredPools,
  getPoolByPair,
  getPoolState,
  mintPosition,
  priceFromSqrtPriceX96,
  priceToTick,
  roundToTickSpacing,
} from '../../services/dexService';
import { formatBN } from '../../helpers/formatBN';
import { friendlyError } from '../../helpers/friendlyError';
import { DexSubnav } from './DexSubnav';
import '../../scss/pages/Explorer/explorerPage.scss';
import '../../scss/pages/Dex/dexPage.scss';

const SLIPPAGE_BPS = 50;
const NPM = DEX_CONFIG.nonfungiblePositionManager;

const symbolFromAddress = (addr) => {
  if (!addr) return null;
  return tokenByAddress(addr)?.symbol ?? null;
};

const parseUnitsOrZero = (value, decimals) => {
  if (!value || isNaN(Number(value)) || Number(value) <= 0) return ethers.constants.Zero;
  return ethers.utils.parseUnits(value, decimals);
};

const poolsForSymbols = (pools, symbolA, symbolB) => (
  pools.filter((pool) => {
    const s0 = tokenByAddress(pool.token0)?.symbol;
    const s1 = tokenByAddress(pool.token1)?.symbol;
    return s0 && s1 && (
      (s0 === symbolA && s1 === symbolB) ||
      (s0 === symbolB && s1 === symbolA)
    );
  })
);

const uniqueFees = (pools) => [...new Set(pools.map((pool) => Number(pool.fee)))].sort((a, b) => a - b);

const fullRangeForSpacing = (tickSpacing = 60) => {
  const spacing = Math.abs(Number(tickSpacing) || 60);
  const max = Math.floor(MAX_TICK / spacing) * spacing;
  return { tickLower: -max, tickUpper: max };
};

const formatPrice = (value) => {
  if (!Number.isFinite(value) || value <= 0) return '-';
  return value.toLocaleString(undefined, { maximumSignificantDigits: 8 });
};

export const DexPositionNew = () => {
  usePageMeta('Add Liquidity', defaultExplorerDescription);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const wallet = useWallet();
  const [searchParams] = useSearchParams();

  const fallbackPools = useMemo(() => getConfiguredPools(), []);
  const initialA = symbolFromAddress(searchParams.get('token0')) ?? 'wLITHO';
  const initialB = symbolFromAddress(searchParams.get('token1')) ?? 'QTT';
  const configuredInitialSupported = poolsForSymbols(fallbackPools, initialA, initialB).length > 0;
  const configuredFallbackB = DEX_TOKENS.find((t) => poolsForSymbols(fallbackPools, initialA, t.symbol).length > 0)?.symbol ?? 'QTT';
  const initialFee = Number(searchParams.get('fee') || DEX_CONFIG.feeTier);

  const [availablePools, setAvailablePools] = useState(fallbackPools);
  const [poolDiscoveryError, setPoolDiscoveryError] = useState('');
  const [tokenASym, setTokenASym] = useState(initialA);
  const [tokenBSym, setTokenBSym] = useState(configuredInitialSupported ? initialB : configuredFallbackB);
  const [selectedFee, setSelectedFee] = useState(initialFee);
  const [mode, setMode] = useState(searchParams.get('concentrated') === 'true' ? 'custom' : 'full');
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [poolPrice, setPoolPrice] = useState(null);
  const [poolState, setPoolState] = useState(null);
  const [poolAddress, setPoolAddress] = useState('');
  const [poolError, setPoolError] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const [balanceA, setBalanceA] = useState(null);
  const [balanceB, setBalanceB] = useState(null);
  const [allowanceA, setAllowanceA] = useState(null);
  const [allowanceB, setAllowanceB] = useState(null);

  const [step, setStep] = useState('idle'); // idle | approvingA | approvingB | minting | success | error
  const [submitting, setSubmitting] = useState(false);
  const [tokenId, setTokenId] = useState('');
  const [txHash, setTxHash] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const tokenA = tokenBySymbol(tokenASym);
  const tokenB = tokenBySymbol(tokenBSym);
  const wrongChain = wallet.isConnected && wallet.chainId !== CHAIN_CONFIG.evmChainId;
  const pairPools = useMemo(() => poolsForSymbols(availablePools, tokenASym, tokenBSym), [availablePools, tokenASym, tokenBSym]);
  const supported = pairPools.length > 0;
  const feeOptions = useMemo(() => uniqueFees(pairPools), [pairPools]);

  const tokenAOptions = DEX_TOKENS.filter((t) =>
    DEX_TOKENS.some((other) => poolsForSymbols(availablePools, t.symbol, other.symbol).length > 0)
  );
  const tokenBOptions = DEX_TOKENS.filter((t) => poolsForSymbols(availablePools, tokenASym, t.symbol).length > 0);

  useEffect(() => {
    let cancelled = false;
    const loadPools = async () => {
      try {
        const discovered = await getAllPools();
        if (!cancelled && discovered.length > 0) {
          setAvailablePools(discovered);
          setPoolDiscoveryError('');
        }
      } catch (err) {
        if (!cancelled) setPoolDiscoveryError(err?.message || 'Pool discovery scan failed; using configured pools.');
      }
    };
    loadPools();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!feeOptions.length) return;
    if (!feeOptions.includes(Number(selectedFee))) {
      setSelectedFee(feeOptions.includes(DEX_CONFIG.feeTier) ? DEX_CONFIG.feeTier : feeOptions[0]);
    }
  }, [feeOptions, selectedFee]);

  const handleSelectA = (sym) => {
    setTokenASym(sym);
    setAmountA('');
    setAmountB('');
    setPoolPrice(null);
    setMinPrice('');
    setMaxPrice('');
    if (poolsForSymbols(availablePools, sym, tokenBSym).length === 0) {
      const fallback = DEX_TOKENS.find((t) => t.symbol !== sym && poolsForSymbols(availablePools, sym, t.symbol).length > 0);
      if (fallback) setTokenBSym(fallback.symbol);
    }
  };

  const handleSelectB = (sym) => {
    setTokenBSym(sym);
    setAmountA('');
    setAmountB('');
    setPoolPrice(null);
    setMinPrice('');
    setMaxPrice('');
  };

  const parsedA = useMemo(() => {
    if (!tokenA) return ethers.constants.Zero;
    try { return parseUnitsOrZero(amountA, tokenA.decimals); } catch { return ethers.constants.Zero; }
  }, [amountA, tokenA]);

  const parsedB = useMemo(() => {
    if (!tokenB) return ethers.constants.Zero;
    try { return parseUnitsOrZero(amountB, tokenB.decimals); } catch { return ethers.constants.Zero; }
  }, [amountB, tokenB]);

  const needsApprovalA = parsedA.gt(0) && (!allowanceA || allowanceA.lt(parsedA));
  const needsApprovalB = parsedB.gt(0) && (!allowanceB || allowanceB.lt(parsedB));

  useEffect(() => {
    if (!supported || !tokenA || !tokenB || !selectedFee) {
      setPoolPrice(null);
      setPoolState(null);
      setPoolAddress('');
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const pool = await getPoolByPair(tokenA.address, tokenB.address, selectedFee);
        if (!pool || pool === ethers.constants.AddressZero) {
          if (!cancelled) {
            setPoolAddress('');
            setPoolState(null);
            setPoolPrice(null);
            setPoolError('Pool not found for this fee tier.');
          }
          return;
        }
        const state = await getPoolState(pool);
        const aIs0 = state.token0.toLowerCase() === tokenA.address.toLowerCase();
        const dec0 = aIs0 ? tokenA.decimals : tokenB.decimals;
        const dec1 = aIs0 ? tokenB.decimals : tokenA.decimals;
        const { price1per0 } = priceFromSqrtPriceX96(state.sqrtPriceX96, dec0, dec1);
        const tokenBperA = aIs0 ? price1per0 : (price1per0 > 0 ? 1 / price1per0 : 0);
        const tokenAperB = tokenBperA > 0 ? 1 / tokenBperA : 0;
        if (!cancelled) {
          setPoolAddress(pool);
          setPoolState(state);
          setPoolPrice({ tokenAperB, tokenBperA });
          setPoolError('');
        }
      } catch (err) {
        if (!cancelled) {
          setPoolAddress('');
          setPoolState(null);
          setPoolPrice(null);
          setPoolError(err?.message || 'Pool read failed');
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [tokenA, tokenB, selectedFee, supported]);

  const setDefaultCustomRange = useCallback(() => {
    if (!poolPrice?.tokenBperA) return;
    setMinPrice((poolPrice.tokenBperA * 0.8).toPrecision(8));
    setMaxPrice((poolPrice.tokenBperA * 1.2).toPrecision(8));
  }, [poolPrice]);

  const handleMode = (nextMode) => {
    setMode(nextMode);
    if (nextMode === 'custom' && (!minPrice || !maxPrice)) setDefaultCustomRange();
  };

  useEffect(() => {
    if (mode === 'custom' && poolPrice && !minPrice && !maxPrice) {
      setDefaultCustomRange();
    }
  }, [mode, poolPrice, minPrice, maxPrice, setDefaultCustomRange]);

  const rangePreview = useMemo(() => {
    if (!poolState || !tokenA || !tokenB) {
      return { error: 'Pool price is still loading.' };
    }
    if (mode === 'full') {
      return { ...fullRangeForSpacing(poolState.tickSpacing), error: '' };
    }

    const min = Number(minPrice);
    const max = Number(maxPrice);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) {
      return { error: 'Enter a valid min and max price.' };
    }
    if (min >= max) return { error: 'Min price must be lower than max price.' };

    const aIsToken0 = poolState.token0.toLowerCase() === tokenA.address.toLowerCase();
    const decimals0 = aIsToken0 ? tokenA.decimals : tokenB.decimals;
    const decimals1 = aIsToken0 ? tokenB.decimals : tokenA.decimals;
    const toToken1Per0 = (tokenBperA) => (
      aIsToken0 ? tokenBperA : 1 / tokenBperA
    );
    const tickA = priceToTick(toToken1Per0(min), decimals0, decimals1);
    const tickB = priceToTick(toToken1Per0(max), decimals0, decimals1);
    if (tickA === null || tickB === null) return { error: 'Price range is outside supported tick math.' };

    let tickLower = roundToTickSpacing(Math.min(tickA, tickB), poolState.tickSpacing);
    let tickUpper = roundToTickSpacing(Math.max(tickA, tickB), poolState.tickSpacing);
    tickLower = clampTick(tickLower);
    tickUpper = clampTick(tickUpper);
    if (tickLower >= tickUpper) {
      return { error: `Price range is too narrow for ${feeToPercent(selectedFee)} tick spacing.` };
    }
    return { tickLower, tickUpper, error: '' };
  }, [poolState, tokenA, tokenB, mode, minPrice, maxPrice, selectedFee]);

  const markerPct = useMemo(() => {
    if (!poolPrice || mode !== 'custom') return null;
    const min = Number(minPrice);
    const max = Number(maxPrice);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;
    return Math.max(0, Math.min(100, ((poolPrice.tokenBperA - min) / (max - min)) * 100));
  }, [poolPrice, mode, minPrice, maxPrice]);

  const estimatedB = useMemo(() => {
    const a = Number(amountA);
    if (!Number.isFinite(a) || a <= 0 || !poolPrice?.tokenBperA) return null;
    return a * poolPrice.tokenBperA;
  }, [amountA, poolPrice]);

  const refreshOwner = useCallback(async () => {
    if (!wallet.isConnected || !wallet.account || wrongChain || !tokenA || !tokenB) {
      setBalanceA(null);
      setBalanceB(null);
      setAllowanceA(null);
      setAllowanceB(null);
      return;
    }
    try {
      const [bA, bB, aA, aB] = await Promise.all([
        getBalance({ token: tokenA.address, owner: wallet.account }),
        getBalance({ token: tokenB.address, owner: wallet.account }),
        getAllowance({ token: tokenA.address, owner: wallet.account, spender: NPM }),
        getAllowance({ token: tokenB.address, owner: wallet.account, spender: NPM }),
      ]);
      setBalanceA(bA);
      setBalanceB(bB);
      setAllowanceA(aA);
      setAllowanceB(aB);
    } catch {
      setBalanceA(null);
      setBalanceB(null);
      setAllowanceA(null);
      setAllowanceB(null);
    }
  }, [wallet.isConnected, wallet.account, wrongChain, tokenA, tokenB]);

  useEffect(() => { refreshOwner(); }, [refreshOwner]);

  const mint = async () => {
    if (!wallet.signer || !tokenA || !tokenB || (!parsedA.gt(0) && !parsedB.gt(0)) || rangePreview.error) return;
    setSubmitting(true);
    setErrorMsg('');
    setTxHash('');
    setTokenId('');
    try {
      if (needsApprovalA) {
        setStep('approvingA');
        await approveToken({ signer: wallet.signer, token: tokenA.address, amount: ethers.constants.MaxUint256, spender: NPM });
      }
      if (needsApprovalB) {
        setStep('approvingB');
        await approveToken({ signer: wallet.signer, token: tokenB.address, amount: ethers.constants.MaxUint256, spender: NPM });
      }
      setStep('minting');
      const result = await mintPosition({
        signer: wallet.signer,
        tokenA: tokenA.address,
        amountA: parsedA,
        tokenB: tokenB.address,
        amountB: parsedB,
        recipient: wallet.account,
        fee: selectedFee,
        tickLower: rangePreview.tickLower,
        tickUpper: rangePreview.tickUpper,
        slippageBps: SLIPPAGE_BPS,
      });
      setTokenId(result.tokenId ?? '');
      setTxHash(result.txHash);
      setStep('success');
      await refreshOwner();
    } catch (err) {
      const msg = friendlyError(err);
      if (msg === null) setStep('idle');
      else {
        setErrorMsg(msg);
        setStep('error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const buttonState = (() => {
    if (!wallet.isConnected) return { label: 'Connect Wallet', onClick: () => wallet.connect(), disabled: false };
    if (wrongChain) return { label: 'Switch to Kamet', onClick: () => wallet.switchToLithoChain(), disabled: false };
    if (!supported) return { label: 'Unsupported pair', onClick: null, disabled: true };
    if (poolError) return { label: 'Pool unavailable', onClick: null, disabled: true };
    if (rangePreview.error) return { label: rangePreview.error, onClick: null, disabled: true };
    if (!parsedA.gt(0) && !parsedB.gt(0)) return { label: 'Enter amounts', onClick: null, disabled: true };
    if (balanceA && parsedA.gt(balanceA)) return { label: `Insufficient ${tokenASym}`, onClick: null, disabled: true };
    if (balanceB && parsedB.gt(balanceB)) return { label: `Insufficient ${tokenBSym}`, onClick: null, disabled: true };
    if (submitting && step === 'approvingA') return { label: `Approving ${tokenASym}...`, onClick: null, disabled: true };
    if (submitting && step === 'approvingB') return { label: `Approving ${tokenBSym}...`, onClick: null, disabled: true };
    if (submitting && step === 'minting') return { label: 'Adding liquidity...', onClick: null, disabled: true };
    if (needsApprovalA) return { label: `Approve ${tokenASym}`, onClick: mint, disabled: false };
    if (needsApprovalB) return { label: `Approve ${tokenBSym}`, onClick: mint, disabled: false };
    return { label: 'Add Liquidity', onClick: mint, disabled: false };
  })();

  return (
    <div className="dex-page">
      <header className="dex-page__header">
        <span className="dex-page__eyebrow">{CHAIN_CONFIG.networkLabel}</span>
        <h1 className="dex-page__title">Add Liquidity</h1>
        <p className="dex-page__subtitle">
          Mint a liquidity position NFT with full-range or custom price bounds.
        </p>
      </header>

      <DexSubnav pathname={pathname} />

      <div className="dex-card dex-card--wide">
        <div className="dex-range-mode" role="tablist" aria-label="Liquidity range mode">
          <button
            type="button"
            className={mode === 'full' ? 'dex-range-mode__button dex-range-mode__button--active' : 'dex-range-mode__button'}
            onClick={() => handleMode('full')}
          >
            Full Range
          </button>
          <button
            type="button"
            className={mode === 'custom' ? 'dex-range-mode__button dex-range-mode__button--active' : 'dex-range-mode__button'}
            onClick={() => handleMode('custom')}
          >
            Custom Range
          </button>
        </div>

        <div className="dex-card__row">
          <div className="dex-card__row-head">
            <span className="dex-card__label">Token A</span>
            {balanceA !== null && (
              <span className="dex-card__balance">
                Balance {formatBN(balanceA, tokenA.decimals, 4)}
                <button type="button" className="dex-card__max" onClick={() => setAmountA(ethers.utils.formatUnits(balanceA, tokenA.decimals))}>
                  MAX
                </button>
              </span>
            )}
          </div>
          <div className="dex-card__field">
            <input
              type="number"
              placeholder="0.0"
              className="dex-card__amount"
              value={amountA}
              onChange={(e) => setAmountA(e.target.value)}
              min="0"
              step="0.000001"
            />
            <select className="dex-card__select" value={tokenASym} onChange={(e) => handleSelectA(e.target.value)}>
              {tokenAOptions.map((t) => <option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
            </select>
          </div>
        </div>

        <div className="dex-card__row">
          <div className="dex-card__row-head">
            <span className="dex-card__label">Token B</span>
            {balanceB !== null && (
              <span className="dex-card__balance">
                Balance {formatBN(balanceB, tokenB.decimals, 4)}
                <button type="button" className="dex-card__max" onClick={() => setAmountB(ethers.utils.formatUnits(balanceB, tokenB.decimals))}>
                  MAX
                </button>
              </span>
            )}
          </div>
          <div className="dex-card__field">
            <input
              type="number"
              placeholder="0.0"
              className="dex-card__amount"
              value={amountB}
              onChange={(e) => setAmountB(e.target.value)}
              min="0"
              step="0.000001"
            />
            <select className="dex-card__select" value={tokenBSym} onChange={(e) => handleSelectB(e.target.value)}>
              {tokenBOptions.map((t) => <option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
            </select>
          </div>
        </div>

        <div className="dex-card__details">
          <div className="dex-card__meta">
            <span>Fee tier</span>
            <select className="dex-card__select dex-card__select--compact" value={selectedFee} onChange={(e) => setSelectedFee(Number(e.target.value))}>
              {feeOptions.length ? feeOptions.map((fee) => (
                <option key={fee} value={fee}>{feeToPercent(fee)}</option>
              )) : <option value={selectedFee}>{feeToPercent(selectedFee)}</option>}
            </select>
          </div>
          {poolAddress && (
            <div className="dex-card__meta dex-card__meta--muted">
              <span>Pool</span>
              <Link to={`/dex/pool/${poolAddress}`}>{poolAddress.slice(0, 8)}...{poolAddress.slice(-6)}</Link>
            </div>
          )}
          {poolDiscoveryError && (
            <p className="dex-card__error">{poolDiscoveryError}</p>
          )}
          {!supported ? (
            <p className="dex-card__error">No pool exists for {tokenASym}/{tokenBSym}.</p>
          ) : poolError ? (
            <p className="dex-card__error">{poolError}</p>
          ) : poolPrice ? (
            <>
              <div className="dex-card__meta">
                <span>Current price</span>
                <span>1 {tokenASym} ~= {formatPrice(poolPrice.tokenBperA)} {tokenBSym}</span>
              </div>
              {estimatedB !== null && (
                <div className="dex-card__meta dex-card__meta--muted">
                  <span>At current price</span>
                  <span>{amountA} {tokenASym} ~= {formatPrice(estimatedB)} {tokenBSym}</span>
                </div>
              )}
            </>
          ) : (
            <div className="dex-card__meta dex-card__meta--muted">
              <span>Loading pool...</span>
            </div>
          )}
        </div>

        <div className="dex-range-card">
          <div className="dex-range-card__head">
            <span>{mode === 'full' ? 'Full range ticks' : 'Custom price range'}</span>
            {mode === 'custom' && (
              <button type="button" className="dex-range-card__preset" onClick={() => handleMode('full')}>
                Full Range
              </button>
            )}
          </div>
          {mode === 'custom' && (
            <div className="dex-action-card__grid">
              <label className="dex-action-card__field">
                <span>Min Price ({tokenBSym} per {tokenASym})</span>
                <input type="number" min="0" step="0.000001" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
              </label>
              <label className="dex-action-card__field">
                <span>Max Price ({tokenBSym} per {tokenASym})</span>
                <input type="number" min="0" step="0.000001" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
              </label>
            </div>
          )}
          <div className="dex-range-card__ticks">
            <span>Lower tick {rangePreview.tickLower ?? '-'}</span>
            <span>Upper tick {rangePreview.tickUpper ?? '-'}</span>
          </div>
          {mode === 'custom' && markerPct !== null && (
            <div className="dex-range-card__bar" aria-hidden="true">
              <span className="dex-range-card__marker" style={{ left: `${markerPct}%` }} />
            </div>
          )}
          {rangePreview.error && <p className="dex-card__error">{rangePreview.error}</p>}
        </div>

        {step === 'success' && (
          <div className="dex-card__success">
            <StatusBadge tone="success">Position #{tokenId || '?'} minted</StatusBadge>
            <a href={`${CHAIN_CONFIG.explorerUrl}/tx/${txHash}`} target="_blank" rel="noreferrer">View tx</a>
          </div>
        )}
        {step === 'error' && errorMsg && (
          <p className="dex-card__error">{errorMsg}</p>
        )}

        {step !== 'success' ? (
          <button
            type="button"
            className="dex-card__cta"
            onClick={buttonState.onClick}
            disabled={buttonState.disabled || !buttonState.onClick}
          >
            {buttonState.label}
          </button>
        ) : (
          <button type="button" className="dex-card__cta" onClick={() => navigate('/dex/positions')}>
            View My Positions
          </button>
        )}
      </div>

      <Link to="/dex/positions" className="dex-back-link">Back to positions</Link>
    </div>
  );
};

export default DexPositionNew;
