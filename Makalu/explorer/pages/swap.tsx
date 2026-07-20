import Head from 'next/head';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useWeb3Modal, useWeb3ModalAccount, useWeb3ModalProvider } from '@web3modal/ethers/react';
import { parseUnits, type Eip1193Provider } from 'ethers';
import { EXPLORER_TITLE } from '@/lib/constants';
import {
  MAKALU_CHAIN_ID,
  MAKALU_RPC,
  SWAP_TOKENS,
  type SwapToken,
  type Quote,
  describeSwapError,
  ensureAllowance,
  formatAmount,
  getQuote,
  isSwapConfigured,
  minOut,
  swapExactTokensForTokens,
} from '@/lib/swap';

const PRIMARY_CTA =
  'rounded-2xl border border-sky-300/20 bg-gradient-to-r from-[#1cc7ff] via-[#227dff] to-[#3157ff] px-5 py-3 text-sm font-medium text-white shadow-[0_18px_40px_rgba(37,99,235,0.35)] transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0';

const SLIPPAGE_OPTIONS = [10, 50, 100]; // basis points: 0.1%, 0.5%, 1.0%

const MAKALU_PARAMS = {
  chainId: '0x' + MAKALU_CHAIN_ID.toString(16),
  chainName: 'Lithosphere Makalu',
  rpcUrls: [MAKALU_RPC],
  nativeCurrency: { name: 'LITHO', symbol: 'LITHO', decimals: 18 },
  blockExplorerUrls: ['https://makalu.litho.ai'],
};

function SwapContent() {
  const { open } = useWeb3Modal();
  const { isConnected, address } = useWeb3ModalAccount();
  const { walletProvider } = useWeb3ModalProvider();

  const configured = isSwapConfigured();

  const [inSymbol, setInSymbol] = useState(SWAP_TOKENS[0].symbol);
  const [outSymbol, setOutSymbol] = useState(SWAP_TOKENS[2]?.symbol ?? SWAP_TOKENS[1].symbol);
  const [amount, setAmount] = useState('1');
  const [slippageBps, setSlippageBps] = useState(50);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState('');

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState<'info' | 'error' | 'success'>('info');

  const tokenIn = useMemo(
    () => SWAP_TOKENS.find((t) => t.symbol === inSymbol) ?? SWAP_TOKENS[0],
    [inSymbol],
  );
  const tokenOut = useMemo(
    () => SWAP_TOKENS.find((t) => t.symbol === outSymbol) ?? SWAP_TOKENS[1],
    [outSymbol],
  );
  const sameToken = tokenIn.address.toLowerCase() === tokenOut.address.toLowerCase();

  function show(msg: string, type: 'info' | 'error' | 'success' = 'info') {
    setStatus(msg);
    setStatusType(type);
  }

  function flip() {
    setInSymbol(outSymbol);
    setOutSymbol(inSymbol);
  }

  // Debounced live quote whenever the inputs change.
  useEffect(() => {
    if (!configured || sameToken) {
      setQuote(null);
      setQuoteError('');
      return;
    }
    if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) {
      setQuote(null);
      setQuoteError('');
      return;
    }
    let cancelled = false;
    setQuoting(true);
    setQuoteError('');
    const id = setTimeout(async () => {
      try {
        const q = await getQuote(amount, tokenIn.address, tokenIn.decimals, tokenOut.address);
        if (!cancelled) setQuote(q);
      } catch {
        if (!cancelled) {
          setQuote(null);
          setQuoteError(
            `No liquidity route for ${tokenIn.symbol} → ${tokenOut.symbol} yet. Once pools are seeded this will quote automatically.`,
          );
        }
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [amount, tokenIn, tokenOut, configured, sameToken]);

  const ensureMakalu = useCallback(async () => {
    if (!walletProvider) throw new Error('Wallet not connected');
    const provider = walletProvider as Eip1193Provider;
    const actual = async () => Number(await provider.request({ method: 'eth_chainId' }));
    if ((await actual()) === MAKALU_CHAIN_ID) return;
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: MAKALU_PARAMS.chainId }],
      });
    } catch {
      await provider.request({ method: 'wallet_addEthereumChain', params: [MAKALU_PARAMS] });
    }
    for (let i = 0; i < 4; i++) {
      if ((await actual()) === MAKALU_CHAIN_ID) return;
      await new Promise((r) => setTimeout(r, 700));
    }
    throw new Error(`Wallet is not on Lithosphere Makalu (${MAKALU_CHAIN_ID}). Switch manually and retry.`);
  }, [walletProvider]);

  async function handleSwap() {
    if (!isConnected || !walletProvider || !address) {
      void open({ view: 'Connect' });
      return;
    }
    if (sameToken) {
      show('Pick two different tokens.', 'error');
      return;
    }
    if (!quote) {
      show('No quote available — enter an amount with an available route.', 'error');
      return;
    }
    setBusy(true);
    try {
      show('Switching wallet to Lithosphere Makalu…');
      await ensureMakalu();

      const amountIn = parseUnits(amount, tokenIn.decimals);
      show(`Approving ${tokenIn.symbol}…`);
      await ensureAllowance(walletProvider as Eip1193Provider, tokenIn.address, amountIn);

      const floor = minOut(quote.amountOut, slippageBps);
      show(`Swapping ${amount} ${tokenIn.symbol} → ${tokenOut.symbol}…`);
      const hash = await swapExactTokensForTokens(
        walletProvider as Eip1193Provider,
        tokenIn.address,
        tokenOut.address,
        amount,
        tokenIn.decimals,
        floor,
        address,
      );
      show(`Swap confirmed: ${hash}`, 'success');
    } catch (err: unknown) {
      show(describeSwapError(err, tokenOut.symbol), 'error');
    } finally {
      setBusy(false);
    }
  }

  const statusColors = {
    info: 'border-blue-400/20 bg-blue-400/10 text-blue-200',
    error: 'border-red-400/20 bg-red-400/10 text-red-200',
    success: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
  };
  const selectCls =
    'w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-sky-400/50';

  const outDisplay = quote ? formatAmount(quote.amountOut, tokenOut.decimals) : '—';
  const minDisplay = quote ? formatAmount(minOut(quote.amountOut, slippageBps), tokenOut.decimals) : '—';

  return (
    <>
      <Head>
        <title>Swap | {EXPLORER_TITLE}</title>
      </Head>
      <div className="text-white">
        <div className="mx-auto max-w-xl">
          <div className="mb-8">
            <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
              MultX Swap
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">Swap tokens</h1>
            <p className="mt-3 max-w-lg text-base leading-7 text-white/70">
              Swap LEP-100 tokens on Lithosphere Makalu through the Lithoswap AMM. Quotes include the
              0.30% pool fee; swaps route through wLITHO when there is no direct pair.
            </p>
          </div>

          {!configured && (
            <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">
              Lithoswap isn&apos;t live on Makalu yet. Once the router is deployed and pools are
              seeded, swapping turns on here automatically — no app update needed.
            </div>
          )}

          {status && (
            <div className={`mb-6 rounded-2xl border p-4 text-sm ${statusColors[statusType]}`}>{status}</div>
          )}

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <label className="mb-2 block text-sm text-white/70">You pay</label>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0.0"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-sky-400/50"
              />
              <select value={inSymbol} onChange={(e) => setInSymbol(e.target.value)} className={selectCls}>
                {SWAP_TOKENS.map((t: SwapToken) => (
                  <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                ))}
              </select>
            </div>

            <div className="my-3 flex justify-center">
              <button
                type="button"
                onClick={flip}
                aria-label="Flip tokens"
                className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/40 text-white/70 transition hover:bg-black/60 hover:text-white"
              >
                ↓
              </button>
            </div>

            <label className="mb-2 block text-sm text-white/70">You receive</label>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div className="flex items-center rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/90">
                {quoting ? 'Quoting…' : outDisplay}
              </div>
              <select value={outSymbol} onChange={(e) => setOutSymbol(e.target.value)} className={selectCls}>
                {SWAP_TOKENS.map((t: SwapToken) => (
                  <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                ))}
              </select>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-white/70">Slippage tolerance</span>
              <div className="flex gap-2">
                {SLIPPAGE_OPTIONS.map((bps) => (
                  <button
                    key={bps}
                    type="button"
                    onClick={() => setSlippageBps(bps)}
                    className={`rounded-xl border px-3 py-1.5 text-xs transition ${
                      slippageBps === bps
                        ? 'border-sky-400/50 bg-sky-400/15 text-white'
                        : 'border-white/10 bg-black/30 text-white/60 hover:text-white'
                    }`}
                  >
                    {bps / 100}%
                  </button>
                ))}
              </div>
            </div>

            {quote && (
              <div className="mt-4 grid gap-1 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
                <div className="flex justify-between">
                  <span>Minimum received</span>
                  <span className="text-white">{minDisplay} {tokenOut.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span>Route</span>
                  <span className="text-white">{quote.multiHop ? `${tokenIn.symbol} → wLITHO → ${tokenOut.symbol}` : `${tokenIn.symbol} → ${tokenOut.symbol}`}</span>
                </div>
              </div>
            )}

            {sameToken && (
              <p className="mt-3 text-sm text-amber-200/90">Choose two different tokens to swap.</p>
            )}
            {quoteError && !sameToken && (
              <p className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm text-amber-200/90">
                {quoteError}
              </p>
            )}

            <div className="mt-5">
              <button
                onClick={handleSwap}
                disabled={busy || !configured || sameToken || (isConnected && !quote)}
                className={`w-full ${PRIMARY_CTA}`}
              >
                {busy
                  ? 'Working…'
                  : !isConnected
                    ? 'Connect Wallet'
                    : !configured
                      ? 'Swap not live yet'
                      : `Swap ${tokenIn.symbol} for ${tokenOut.symbol}`}
              </button>
            </div>

            <p className="mt-4 text-center text-sm text-white/50">
              Need a different chain?{' '}
              <Link href="/cross-swap" className="text-sky-300 underline-offset-2 hover:underline">
                Cross-chain swap →
              </Link>
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

export default function SwapPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return <SwapContent />;
}
