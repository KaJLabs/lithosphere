import { useWeb3Modal, useWeb3ModalAccount, useWeb3ModalProvider } from '@web3modal/ethers/react';
import { type Eip1193Provider } from 'ethers';
import Head from 'next/head';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import FeatureUnavailable from '@/components/FeatureUnavailable';
import { BRIDGE_CHAIN_LIST, BRIDGE_TOKENS, chainByKey, describeBridgeError } from '@/lib/bridge';
import { EXPLORER_TITLE } from '@/lib/constants';
import {
  SOURCE_CHAIN_KEYS,
  claimReady,
  createSaga,
  clearSaga,
  describeStep,
  isComplete,
  isCrossSwapConfigured,
  loadSaga,
  planRoute,
  pollRelayer,
  runBridgeInClaim,
  runBridgeInLock,
  runBridgeOutClaim,
  runBridgeOutLock,
  runSwap,
  saveSaga,
  tokenBySymbol,
  type SagaState,
} from '@/lib/crossSwap';
import { NETWORK } from '@/lib/network';
import { formatAmount, getQuote, describeSwapError } from '@/lib/swap';

const PRIMARY_CTA =
  'w-full rounded-2xl border border-sky-300/20 bg-gradient-to-r from-[#1cc7ff] via-[#227dff] to-[#3157ff] px-5 py-3 text-sm font-medium text-white shadow-[0_18px_40px_rgba(37,99,235,0.35)] transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0';
const SELECT =
  'w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-sky-400/50';
const SLIPPAGE_OPTIONS = [10, 50, 100];

const CHAIN_PARAMS: Record<number, {
  chainId: string;
  chainName: string;
  rpcUrls: string[];
  nativeCurrency: { name: string; symbol: string; decimals: number };
  blockExplorerUrls: string[];
}> = {
  700777: {
    chainId: '0x' + (700777).toString(16),
    chainName: 'Lithosphere Makalu',
    rpcUrls: ['https://rpc.litho.ai'],
    nativeCurrency: { name: 'LITHO', symbol: 'LITHO', decimals: 18 },
    blockExplorerUrls: ['https://makalu.litho.ai'],
  },
  900523: {
    chainId: '0x' + (900523).toString(16),
    chainName: 'Lithosphere Kamet',
    rpcUrls: ['https://rpc-3.litho.ai'],
    nativeCurrency: { name: 'LITHO', symbol: 'LITHO', decimals: 18 },
    blockExplorerUrls: ['https://kamet.litho.ai'],
  },
};

function CrossSwapContent() {
  const { open } = useWeb3Modal();
  const { isConnected, address } = useWeb3ModalAccount();
  const { walletProvider } = useWeb3ModalProvider();

  const configured = isCrossSwapConfigured();

  const [saga, setSaga] = useState<SagaState | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState<'info' | 'error' | 'success'>('info');
  const [ready, setReady] = useState(false); // claim-readiness for the current bridge leg

  // Setup form
  const [symbolIn, setSymbolIn] = useState(BRIDGE_TOKENS[0].symbol);
  const [symbolOut, setSymbolOut] = useState(BRIDGE_TOKENS[2]?.symbol ?? BRIDGE_TOKENS[1].symbol);
  const [chainXKey, setChainXKey] = useState('kamet');
  const [chainYKey, setChainYKey] = useState('makalu');
  const [amount, setAmount] = useState('1');
  const [slippageBps, setSlippageBps] = useState(50);
  const [previewOut, setPreviewOut] = useState<string>('—');

  function show(msg: string, type: 'info' | 'error' | 'success' = 'info') {
    setStatus(msg);
    setStatusType(type);
  }

  // Restore an in-flight saga on mount.
  useEffect(() => {
    const existing = loadSaga();
    if (existing && existing.status === 'active') setSaga(existing);
  }, []);

  const tokenIn = useMemo(() => tokenBySymbol(symbolIn), [symbolIn]);
  const tokenOut = useMemo(() => tokenBySymbol(symbolOut), [symbolOut]);
  const sameToken = tokenIn.symbol === tokenOut.symbol;
  const plan = useMemo(() => planRoute(chainXKey, chainYKey), [chainXKey, chainYKey]);

  // Live quote preview (on Makalu, where the swap runs).
  useEffect(() => {
    if (saga || !configured || sameToken || !/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) {
      setPreviewOut('—');
      return;
    }
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const q = await getQuote(amount, tokenIn.makalu, tokenIn.decimals, tokenOut.makalu);
        if (!cancelled) setPreviewOut(q ? formatAmount(q.amountOut, tokenOut.decimals) : '—');
      } catch {
        if (!cancelled) setPreviewOut('no route');
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [amount, tokenIn, tokenOut, saga, configured, sameToken]);

  const step = saga ? describeStep(saga) : null;

  // Poll signature-readiness (claim steps) or relayer completion (external dest).
  useEffect(() => {
    if (!saga || !step) return;
    if (step.kind === 'bridge_in_claim' || step.kind === 'bridge_out_claim') {
      setReady(false);
      let cancelled = false;
      const poll = async () => {
        if (!step.bridgeTxHash) return;
        const r = await claimReady(step.bridgeTxHash);
        if (!cancelled) setReady(r);
      };
      void poll();
      const t = setInterval(poll, 6000);
      return () => {
        cancelled = true;
        clearInterval(t);
      };
    }
    if (step.kind === 'await_relayer') {
      let cancelled = false;
      const poll = async () => {
        const next = await pollRelayer(saga);
        if (!cancelled && next !== saga) {
          saveSaga(next);
          setSaga(next);
        }
      };
      void poll();
      const t = setInterval(poll, 8000);
      return () => {
        cancelled = true;
        clearInterval(t);
      };
    }
  }, [saga, step]);

  const ensureChain = useCallback(
    async (targetId: number) => {
      if (!walletProvider) throw new Error('Wallet not connected');
      const provider = walletProvider as Eip1193Provider;
      const params = CHAIN_PARAMS[targetId];
      if (!params) throw new Error(`No wallet config for chain ${targetId}`);
      const actual = async () => Number(await provider.request({ method: 'eth_chainId' }));
      if ((await actual()) === targetId) return;
      try {
        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: params.chainId }] });
      } catch {
        await provider.request({ method: 'wallet_addEthereumChain', params: [params] });
      }
      for (let i = 0; i < 4; i++) {
        if ((await actual()) === targetId) return;
        await new Promise((r) => setTimeout(r, 700));
      }
      throw new Error(`Wallet is not on ${params.chainName}. Switch manually and retry.`);
    },
    [walletProvider],
  );

  function startSaga() {
    if (!configured) return;
    if (sameToken) {
      show('Pick two different tokens.', 'error');
      return;
    }
    const s = createSaga({ symbolIn, symbolOut, chainXKey, chainYKey, amountIn: amount, slippageBps });
    saveSaga(s);
    setSaga(s);
    show('Route started — follow the steps below. You can leave and resume any time.', 'info');
  }

  function reset() {
    clearSaga();
    setSaga(null);
    setReady(false);
    show('', 'info');
  }

  async function advance() {
    if (!saga || !step) return;
    if (!isConnected || !walletProvider || !address) {
      void open({ view: 'Connect' });
      return;
    }
    const wp = walletProvider as Eip1193Provider;
    setBusy(true);
    try {
      if (step.chainId) {
        show(`Switching wallet to ${chainByKey(step.chainKey!)?.name ?? 'target chain'}…`);
        await ensureChain(step.chainId);
      }
      let next = saga;
      switch (step.kind) {
        case 'bridge_in_lock':
          show(`Locking ${saga.config.symbolIn}…`);
          next = await runBridgeInLock(saga, wp);
          break;
        case 'bridge_in_claim':
          if (!ready) {
            show('Validators are still signing this transfer — the claim unlocks automatically.', 'info');
            setBusy(false);
            return;
          }
          show(`Claiming ${saga.config.symbolIn} on Makalu…`);
          next = await runBridgeInClaim(saga, wp);
          break;
        case 'swap':
          show(`Swapping ${saga.config.symbolIn} → ${saga.config.symbolOut}…`);
          next = await runSwap(saga, wp, address);
          break;
        case 'bridge_out_lock':
          show(`Locking ${saga.config.symbolOut} to bridge out…`);
          next = await runBridgeOutLock(saga, wp);
          break;
        case 'bridge_out_claim':
          if (!ready) {
            show('Validators are still signing — the claim unlocks automatically.', 'info');
            setBusy(false);
            return;
          }
          show(`Claiming ${saga.config.symbolOut}…`);
          next = await runBridgeOutClaim(saga, wp);
          break;
        case 'await_relayer':
          show('The relayer releases the tokens on the destination chain — no action needed.', 'info');
          setBusy(false);
          return;
        case 'done':
          setBusy(false);
          return;
      }
      if (isComplete(next)) next = { ...next, status: 'completed' };
      saveSaga(next);
      setSaga(next);
      if (next.status === 'completed') show('Cross-chain swap complete 🎉', 'success');
    } catch (err: unknown) {
      const msg =
        step.kind === 'swap'
          ? describeSwapError(err, saga.config.symbolOut)
          : describeBridgeError(err, { symbol: saga.config.symbolIn, chainName: step.chainKey ?? 'chain' });
      show(msg, 'error');
    } finally {
      setBusy(false);
    }
  }

  const statusColors = {
    info: 'border-blue-400/20 bg-blue-400/10 text-blue-200',
    error: 'border-red-400/20 bg-red-400/10 text-red-200',
    success: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
  };

  // Visual leg status for the progress rail.
  function legDone(phase: 'bridge_in' | 'swap' | 'bridge_out'): boolean {
    if (!saga) return false;
    if (phase === 'bridge_in') return !!saga.bridgeIn?.claimed;
    if (phase === 'swap') return !!saga.swap?.txHash;
    return chainByKey(saga.config.chainYKey)?.litho
      ? !!saga.bridgeOut?.claimed
      : !!saga.bridgeOut?.releaseTxHash;
  }
  const phaseLabel: Record<string, string> = {
    bridge_in: 'Bridge in',
    swap: 'Swap',
    bridge_out: 'Bridge out',
  };

  return (
    <>
      <Head>
        <title>Cross-chain Swap | {EXPLORER_TITLE}</title>
      </Head>
      <div className="text-white">
        <div className="mx-auto max-w-xl">
          <div className="mb-8">
            <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
              MultX Cross-chain Swap
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">Swap across chains</h1>
            <p className="mt-3 max-w-lg text-base leading-7 text-white/70">
              Go from one token on one chain to a different token on another. The route bridges to
              Makalu, swaps on Lithoswap, then bridges out — one guided flow you can resume any time.
            </p>
          </div>

          {!configured && (
            <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">
              The Lithoswap DEX isn&apos;t live on Makalu yet, so cross-chain swaps are disabled. This
              turns on automatically once the router is deployed and pools are seeded.
            </div>
          )}
          {status && (
            <div className={`mb-6 rounded-2xl border p-4 text-sm ${statusColors[statusType]}`}>{status}</div>
          )}

          {!saga ? (
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-white/70">From token</label>
                  <select value={symbolIn} onChange={(e) => setSymbolIn(e.target.value)} className={SELECT}>
                    {BRIDGE_TOKENS.map((t) => <option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm text-white/70">From chain</label>
                  <select value={chainXKey} onChange={(e) => setChainXKey(e.target.value)} className={SELECT}>
                    {SOURCE_CHAIN_KEYS.map((k) => (
                      <option key={k} value={k}>{chainByKey(k)?.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm text-white/70">To token</label>
                  <select value={symbolOut} onChange={(e) => setSymbolOut(e.target.value)} className={SELECT}>
                    {BRIDGE_TOKENS.map((t) => <option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm text-white/70">To chain</label>
                  <select value={chainYKey} onChange={(e) => setChainYKey(e.target.value)} className={SELECT}>
                    {BRIDGE_CHAIN_LIST.filter((c) => !c.comingSoon).map((c) => (
                      <option key={c.key} value={c.key}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-sm text-white/70">Amount</label>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.0"
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-sky-400/50"
                />
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-white/70">Slippage</span>
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

              <div className="mt-4 grid gap-1 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
                <div className="flex justify-between">
                  <span>Est. received (before bridge fees)</span>
                  <span className="text-white">{previewOut} {tokenOut.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span>Route</span>
                  <span className="text-white">{plan.map((p) => phaseLabel[p]).join(' → ')}</span>
                </div>
              </div>

              {sameToken && <p className="mt-3 text-sm text-amber-200/90">Choose two different tokens.</p>}

              <div className="mt-5">
                <button onClick={startSaga} disabled={!configured || sameToken} className={PRIMARY_CTA}>
                  {configured ? 'Start cross-chain swap' : 'Not live yet'}
                </button>
              </div>
            </section>
          ) : (
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="mb-5 flex items-center gap-2">
                {saga.plan.map((phase, i) => (
                  <React.Fragment key={phase}>
                    <div
                      className={`flex-1 rounded-xl border px-3 py-2 text-center text-xs ${
                        legDone(phase)
                          ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                          : step?.kind.startsWith(phase)
                            ? 'border-sky-400/40 bg-sky-400/10 text-white'
                            : 'border-white/10 bg-black/30 text-white/50'
                      }`}
                    >
                      {legDone(phase) ? '✓ ' : ''}{phaseLabel[phase]}
                    </div>
                    {i < saga.plan.length - 1 && <span className="text-white/30">→</span>}
                  </React.Fragment>
                ))}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-sm text-white/60">Current step</div>
                <div className="mt-1 text-lg font-medium text-white">{step?.title}</div>
                <div className="mt-1 text-sm text-white/60">
                  {saga.config.amountIn} {saga.config.symbolIn} ({chainByKey(saga.config.chainXKey)?.name})
                  {' → '}
                  {saga.config.symbolOut} ({chainByKey(saga.config.chainYKey)?.name})
                </div>
                {(step?.kind === 'bridge_in_claim' || step?.kind === 'bridge_out_claim') && !ready && (
                  <div className="mt-2 text-xs text-white/50">Waiting for validator signatures…</div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {!isComplete(saga) && step?.kind !== 'await_relayer' && (
                  <button
                    onClick={advance}
                    disabled={busy || ((step?.kind === 'bridge_in_claim' || step?.kind === 'bridge_out_claim') && !ready)}
                    className={PRIMARY_CTA}
                  >
                    {busy ? 'Working…' : !isConnected ? 'Connect Wallet' : `Continue — ${step?.title}`}
                  </button>
                )}
                {isComplete(saga) && (
                  <button onClick={reset} className={PRIMARY_CTA}>Start another swap</button>
                )}
                {!isComplete(saga) && (
                  <button
                    onClick={reset}
                    className="rounded-2xl border border-white/10 bg-black/30 px-5 py-3 text-sm text-white/60 transition hover:text-white"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

export default function CrossSwapPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  if (!NETWORK.bridgeEnabled || !NETWORK.swapEnabled) return <FeatureUnavailable feature="Cross-chain swap" />;
  return <CrossSwapContent />;
}
