import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ethers } from 'ethers5';
import { CHAIN_CONFIG } from '../../config/api';
import { usePageMeta, defaultExplorerDescription } from '../../hooks/usePageMeta';
import { useWallet } from '../../hooks/useWallet';
import { StatusBadge } from '../../components/explorer/ExplorerUI';
import { DexSubnav } from './DexSubnav';
import {
  DEX_CONFIG,
  DEX_TOKENS,
  isSupportedPair,
  tokenBySymbol,
} from '../../data/dexConfig';
import {
  getQuote,
  getAllowance,
  getBalance,
  approveToken,
  executeSwap,
  applySlippage,
} from '../../services/dexService';
import '../../scss/pages/Explorer/explorerPage.scss';
import '../../scss/pages/Dex/dexPage.scss';

const SLIPPAGE_BPS = 50; // 0.50%
const QUOTE_DEBOUNCE_MS = 350;

const formatBN = (bn, decimals = 18, frac = 6) => {
  if (!bn) return '0';
  try {
    return Number(ethers.utils.formatUnits(bn, decimals)).toFixed(frac);
  } catch {
    return '0';
  }
};

// Translate ethers / MetaMask errors into a short, friendly UI string.
// Returns null when the user simply cancelled — those don't deserve a banner.
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

export const DexSwap = () => {
  usePageMeta('DEX', defaultExplorerDescription);
  const wallet = useWallet();
  const { pathname } = useLocation();

  const [tokenInSym,  setTokenInSym]  = useState('wLITHO');
  const [tokenOutSym, setTokenOutSym] = useState('QTT');
  const [amountIn,    setAmountIn]    = useState('');
  const [quote,       setQuote]       = useState(null); // { amountOut: BigNumber }
  const [quoting,     setQuoting]     = useState(false);
  const [quoteError,  setQuoteError]  = useState('');
  const [balanceIn,   setBalanceIn]   = useState(null);
  const [allowance,   setAllowance]   = useState(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [step,        setStep]        = useState('idle'); // idle | approving | swapping | success | error
  const [txHash,      setTxHash]      = useState('');
  const [errorMsg,    setErrorMsg]    = useState('');

  const tokenIn  = tokenBySymbol(tokenInSym);
  const tokenOut = tokenBySymbol(tokenOutSym);

  const wrongChain = wallet.isConnected && wallet.chainId !== CHAIN_CONFIG.evmChainId;

  const supported = isSupportedPair(tokenInSym, tokenOutSym);

  // From: show every token that has at least one supported pair.
  // To:   show only tokens that form a supported pair with the current From.
  const tokenInOptions  = DEX_TOKENS.filter((t) =>
    DEX_TOKENS.some((other) => isSupportedPair(t.symbol, other.symbol))
  );
  const tokenOutOptions = DEX_TOKENS.filter((t) => isSupportedPair(tokenInSym, t.symbol));

  // When the user picks a new From, snap To to a valid counterparty.
  const handleSelectIn = (sym) => {
    setTokenInSym(sym);
    const stillValid = isSupportedPair(sym, tokenOutSym);
    if (!stillValid) {
      const fallback = DEX_TOKENS.find((t) => t.symbol !== sym && isSupportedPair(sym, t.symbol));
      if (fallback) setTokenOutSym(fallback.symbol);
    }
  };
  const handleSelectOut = (sym) => {
    setTokenOutSym(sym);
    const stillValid = isSupportedPair(tokenInSym, sym);
    if (!stillValid) {
      const fallback = DEX_TOKENS.find((t) => t.symbol !== sym && isSupportedPair(t.symbol, sym));
      if (fallback) setTokenInSym(fallback.symbol);
    }
  };

  const parsedAmountIn = useMemo(() => {
    if (!amountIn || isNaN(Number(amountIn)) || Number(amountIn) <= 0) return null;
    try {
      return ethers.utils.parseUnits(amountIn, tokenIn.decimals);
    } catch {
      return null;
    }
  }, [amountIn, tokenIn]);

  // Refresh balance + allowance whenever wallet or tokenIn changes
  const refreshOwnerState = useCallback(async () => {
    if (!wallet.isConnected || !wallet.account || wrongChain) {
      setBalanceIn(null);
      setAllowance(null);
      return;
    }
    try {
      const [bal, allow] = await Promise.all([
        getBalance({ token: tokenIn.address, owner: wallet.account }),
        getAllowance({ token: tokenIn.address, owner: wallet.account }),
      ]);
      setBalanceIn(bal);
      setAllowance(allow);
    } catch {
      setBalanceIn(null);
      setAllowance(null);
    }
  }, [wallet.isConnected, wallet.account, wrongChain, tokenIn]);

  useEffect(() => {
    refreshOwnerState();
  }, [refreshOwnerState]);

  // Debounced quote fetch. Clear quote synchronously whenever the parsed
  // amount becomes invalid so the rate row never sees a null parsedAmountIn.
  const debounceRef = useRef(null);
  useEffect(() => {
    if (!parsedAmountIn) setQuote(null);
  }, [parsedAmountIn]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!parsedAmountIn || !supported) {
      setQuote(null);
      setQuoteError('');
      return;
    }
    setQuoting(true);
    setQuoteError('');
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await getQuote({
          tokenIn:  tokenIn.address,
          tokenOut: tokenOut.address,
          amountIn: parsedAmountIn,
        });
        setQuote(result);
      } catch (err) {
        setQuote(null);
        setQuoteError(err?.message || 'Quote failed');
      } finally {
        setQuoting(false);
      }
    }, QUOTE_DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [parsedAmountIn, tokenIn, tokenOut, supported]);

  const needsApproval = useMemo(() => {
    if (!parsedAmountIn || !allowance) return false;
    return allowance.lt(parsedAmountIn);
  }, [parsedAmountIn, allowance]);

  const swap = async () => {
    if (!wallet.signer || !parsedAmountIn || !quote) return;
    setSubmitting(true);
    setErrorMsg('');
    setTxHash('');
    try {
      if (needsApproval) {
        setStep('approving');
        await approveToken({
          signer: wallet.signer,
          token:  tokenIn.address,
          amount: ethers.constants.MaxUint256,
        });
      }
      setStep('swapping');
      const minOut = applySlippage(quote.amountOut, SLIPPAGE_BPS);
      const hash = await executeSwap({
        signer:   wallet.signer,
        tokenIn:  tokenIn.address,
        tokenOut: tokenOut.address,
        amountIn: parsedAmountIn,
        amountOutMinimum: minOut,
        recipient: wallet.account,
      });
      setTxHash(hash);
      setStep('success');
      await refreshOwnerState();
    } catch (err) {
      const msg = friendlyError(err);
      if (msg === null) {
        setStep('idle');         // user cancelled — no error banner
      } else {
        setErrorMsg(msg);
        setStep('error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const flip = () => {
    setTokenInSym(tokenOutSym);
    setTokenOutSym(tokenInSym);
    setAmountIn('');
    setQuote(null);
    setStep('idle');
    setTxHash('');
    setErrorMsg('');
  };

  const buttonState = (() => {
    if (!wallet.isConnected) return { label: 'Connect Wallet', onClick: () => wallet.connect(), disabled: false };
    if (wrongChain)         return { label: 'Switch to Kamet', onClick: () => wallet.switchToLithoChain(), disabled: false };
    if (!supported)         return { label: 'Unsupported pair', onClick: null, disabled: true };
    if (!parsedAmountIn)    return { label: 'Enter an amount', onClick: null, disabled: true };
    if (balanceIn && parsedAmountIn.gt(balanceIn)) return { label: 'Insufficient balance', onClick: null, disabled: true };
    if (!quote)             return { label: quoting ? 'Quoting...' : 'No quote', onClick: null, disabled: true };
    if (submitting && step === 'approving') return { label: 'Approving...', onClick: null, disabled: true };
    if (submitting && step === 'swapping')  return { label: 'Swapping...',  onClick: null, disabled: true };
    if (needsApproval) return { label: `Approve ${tokenInSym}`, onClick: swap, disabled: false };
    return { label: 'Swap', onClick: swap, disabled: false };
  })();

  return (
    <div className="dex-page">
      <header className="dex-page__header">
        <span className="dex-page__eyebrow">{CHAIN_CONFIG.networkLabel}</span>
        <h1 className="dex-page__title">Swap</h1>
        <p className="dex-page__subtitle">
          Trade LEP100 tokens on the Lithosphere DEX. {(DEX_CONFIG.feeTier / 10000).toFixed(2)}% fee tier.
        </p>
      </header>

      <DexSubnav pathname={pathname} />

      <div className="dex-card">
        <div className="dex-card__row dex-card__row--in">
          <div className="dex-card__row-head">
            <span className="dex-card__label">From</span>
            {balanceIn !== null && (
              <span className="dex-card__balance">
                Balance {formatBN(balanceIn, tokenIn.decimals, 4)}
                <button
                  type="button"
                  className="dex-card__max"
                  onClick={() => setAmountIn(ethers.utils.formatUnits(balanceIn, tokenIn.decimals))}
                >
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
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              min="0"
              step="0.000001"
            />
            <select
              className="dex-card__select"
              value={tokenInSym}
              onChange={(e) => handleSelectIn(e.target.value)}
            >
              {tokenInOptions.map((t) => <option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
            </select>
          </div>
        </div>

        <button
          type="button"
          className="dex-card__flip"
          onClick={flip}
          aria-label="Reverse swap direction"
        >
          ↓
        </button>

        <div className="dex-card__row dex-card__row--out">
          <div className="dex-card__row-head">
            <span className="dex-card__label">To</span>
            {quoting && <span className="dex-card__hint">Fetching price…</span>}
          </div>
          <div className="dex-card__field">
            <input
              type="text"
              readOnly
              className="dex-card__amount dex-card__amount--readonly"
              value={quote ? formatBN(quote.amountOut, tokenOut.decimals, 6) : '0.0'}
            />
            <select
              className="dex-card__select"
              value={tokenOutSym}
              onChange={(e) => handleSelectOut(e.target.value)}
            >
              {tokenOutOptions.map((t) => <option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
            </select>
          </div>
        </div>

        {(quote || quoteError || !supported) && (
          <div className="dex-card__details">
            {!supported && (
              <p className="dex-card__error">
                No pool for {tokenInSym}/{tokenOutSym}. v0 routes through wLITHO.
              </p>
            )}
            {quoteError && supported && (
              <p className="dex-card__error">Quote error: {quoteError}</p>
            )}
            {quote && parsedAmountIn && parsedAmountIn.gt(0) && (
              <>
                <div className="dex-card__meta">
                  <span>Rate</span>
                  <span>
                    1 {tokenInSym} ≈ {formatBN(quote.amountOut.mul(ethers.BigNumber.from(10).pow(tokenIn.decimals)).div(parsedAmountIn), tokenOut.decimals, 6)} {tokenOutSym}
                  </span>
                </div>
                <div className="dex-card__meta">
                  <span>Min received</span>
                  <span>{formatBN(applySlippage(quote.amountOut, SLIPPAGE_BPS), tokenOut.decimals, 6)} {tokenOutSym}</span>
                </div>
              </>
            )}
            <div className="dex-card__meta dex-card__meta--muted">
              <span>Fee · Slippage</span>
              <span>{(DEX_CONFIG.feeTier / 10000).toFixed(2)}% · {(SLIPPAGE_BPS / 100).toFixed(2)}%</span>
            </div>
          </div>
        )}

        <button
          type="button"
          className="dex-card__cta"
          onClick={buttonState.onClick}
          disabled={buttonState.disabled || !buttonState.onClick}
        >
          {buttonState.label}
        </button>

        {step === 'success' && txHash && (
          <div className="dex-card__success">
            <StatusBadge tone="success">Swap complete</StatusBadge>
            <a href={`https://kamet.litho.ai/tx/${txHash}`} target="_blank" rel="noreferrer">
              View tx ↗
            </a>
          </div>
        )}
        {step === 'error' && errorMsg && (
          <div className="dex-card__error">{errorMsg}</div>
        )}
      </div>
    </div>
  );
};

export default DexSwap;
