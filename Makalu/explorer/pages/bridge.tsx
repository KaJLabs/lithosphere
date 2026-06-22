import Head from 'next/head';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useWeb3Modal, useWeb3ModalAccount, useWeb3ModalProvider } from '@web3modal/ethers/react';
import { parseUnits, type Eip1193Provider } from 'ethers';
import { EXPLORER_TITLE } from '@/lib/constants';
import {
  BRIDGE_CHAINS,
  BRIDGE_TOKENS,
  approveIfNeeded,
  fetchSignatures,
  fetchStatus,
  lockTokens,
  releaseTokens,
  sourceChainFor,
  targetChainFor,
  type BridgeDirection,
  type BridgeStatus,
} from '@/lib/bridge';

const PRIMARY_CTA_CLASSES =
  'rounded-2xl border border-sky-300/20 bg-gradient-to-r from-[#1cc7ff] via-[#227dff] to-[#3157ff] px-5 py-3 text-sm font-medium text-white shadow-[0_18px_40px_rgba(37,99,235,0.35)] transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0';

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

function chainName(id: number): string {
  return CHAIN_PARAMS[id]?.chainName ?? `chain ${id}`;
}

function BridgeContent() {
  const { open } = useWeb3Modal();
  const { address, isConnected, chainId } = useWeb3ModalAccount();
  const { walletProvider } = useWeb3ModalProvider();

  const [direction, setDirection] = useState<BridgeDirection>('makalu-to-kamet');
  const [symbol, setSymbol] = useState(BRIDGE_TOKENS[0].symbol);
  const [amount, setAmount] = useState('10');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [statusType, setStatusType] = useState<'info' | 'error' | 'success'>('info');
  const [bridgeTxHash, setBridgeTxHash] = useState('');
  const [transfer, setTransfer] = useState<BridgeStatus | null>(null);

  const token = useMemo(
    () => BRIDGE_TOKENS.find((t) => t.symbol === symbol) ?? BRIDGE_TOKENS[0],
    [symbol],
  );
  const sourceChain = sourceChainFor(direction);
  const targetChain = targetChainFor(direction);
  const sourceBridge =
    direction === 'makalu-to-kamet' ? BRIDGE_CHAINS.makalu.bridge : BRIDGE_CHAINS.kamet.bridge;
  const destBridge =
    direction === 'makalu-to-kamet' ? BRIDGE_CHAINS.kamet.bridge : BRIDGE_CHAINS.makalu.bridge;
  const sourceTokenAddr = direction === 'makalu-to-kamet' ? token.makalu : token.kamet;

  function show(msg: string, type: 'info' | 'error' | 'success' = 'info') {
    setStatus(msg);
    setStatusType(type);
  }

  const ensureChain = useCallback(
    async (targetId: number) => {
      if (!walletProvider) throw new Error('Wallet not connected');
      if (Number(chainId) === targetId) return;
      const params = CHAIN_PARAMS[targetId];
      const provider = walletProvider as Eip1193Provider;
      try {
        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: params.chainId }] });
      } catch (err: unknown) {
        if ((err as { code?: number })?.code === 4902) {
          await provider.request({ method: 'wallet_addEthereumChain', params: [params] });
        } else {
          throw err;
        }
      }
    },
    [walletProvider, chainId],
  );

  // Poll status while a transfer is in flight.
  useEffect(() => {
    if (!bridgeTxHash) return;
    let cancelled = false;
    const tick = async () => {
      const s = await fetchStatus(bridgeTxHash);
      if (cancelled || !s) return;
      setTransfer(s);
      if (s.status === 'completed') {
        show('Bridge transfer completed — tokens released on the destination chain.', 'success');
      }
    };
    void tick();
    const id = setInterval(tick, 6000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [bridgeTxHash]);

  async function handleLock() {
    if (!isConnected || !walletProvider) {
      void open({ view: 'Connect' });
      return;
    }
    if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) {
      show('Enter a valid amount.', 'error');
      return;
    }
    setBusy(true);
    setTransfer(null);
    setBridgeTxHash('');
    try {
      show(`Switching wallet to ${chainName(sourceChain)}…`);
      await ensureChain(sourceChain);

      show('Approving bridge allowance…');
      await approveIfNeeded(
        walletProvider as Eip1193Provider,
        sourceTokenAddr,
        sourceBridge,
        parseUnits(amount, token.decimals),
      );

      show(`Locking ${amount} ${token.symbol} on ${chainName(sourceChain)}…`);
      const { bridgeTxHash: h } = await lockTokens(
        walletProvider as Eip1193Provider,
        sourceBridge,
        sourceTokenAddr,
        amount,
        token.decimals,
        targetChain,
      );
      setBridgeTxHash(h);
      show(
        `Locked. Validators are signing your transfer. It will be released on ${chainName(targetChain)} automatically, or you can claim it below.`,
        'success',
      );
    } catch (err: unknown) {
      show((err as Error)?.message || 'Bridge lock failed.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleClaim() {
    if (!transfer || !walletProvider) return;
    setBusy(true);
    try {
      show(`Switching wallet to ${chainName(targetChain)} to claim…`);
      await ensureChain(targetChain);
      const sigs = await fetchSignatures(bridgeTxHash);
      show('Submitting release transaction…');
      const txHash = await releaseTokens(walletProvider as Eip1193Provider, destBridge, transfer, sigs);
      show(`Release submitted: ${txHash}`, 'success');
    } catch (err: unknown) {
      show((err as Error)?.message || 'Claim failed.', 'error');
    } finally {
      setBusy(false);
    }
  }

  const canClaim =
    transfer &&
    transfer.status !== 'completed' &&
    !transfer.releaseTxHash &&
    transfer.signaturesCollected >= transfer.signaturesRequired;

  const statusColors = {
    info: 'border-blue-400/20 bg-blue-400/10 text-blue-200',
    error: 'border-red-400/20 bg-red-400/10 text-red-200',
    success: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
  };

  return (
    <>
      <Head>
        <title>Bridge | {EXPLORER_TITLE}</title>
      </Head>
      <div className="text-white">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8">
            <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
              MultX Bridge
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">Cross-chain bridge</h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-white/70">
              Bridge LEP-100 assets between Lithosphere Makalu and Kamet. Lock on the source chain;
              tokens are released on the destination chain after validators sign.
            </p>
          </div>

          {status && (
            <div className={`mb-6 rounded-2xl border p-4 text-sm ${statusColors[statusType]}`}>{status}</div>
          )}

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="mb-5 grid grid-cols-2 gap-3">
              {(['makalu-to-kamet', 'kamet-to-makalu'] as BridgeDirection[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  className={`rounded-2xl border px-4 py-3 text-sm transition ${
                    direction === d
                      ? 'border-sky-400/50 bg-sky-500/15 text-white'
                      : 'border-white/10 bg-black/30 text-white/70 hover:border-white/25'
                  }`}
                >
                  {d === 'makalu-to-kamet' ? 'Makalu → Kamet' : 'Kamet → Makalu'}
                </button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-white/70">Token</label>
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-sky-400/50"
                >
                  {BRIDGE_TOKENS.map((t) => (
                    <option key={t.symbol} value={t.symbol}>
                      {t.symbol} — {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm text-white/70">Amount</label>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.0"
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-sky-400/50"
                />
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/65">
              Source: <span className="text-white">{chainName(sourceChain)}</span> → Destination:{' '}
              <span className="text-white">{chainName(targetChain)}</span>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={handleLock} disabled={busy} className={PRIMARY_CTA_CLASSES}>
                {busy ? 'Working…' : isConnected ? `Bridge ${token.symbol}` : 'Connect Wallet'}
              </button>
              {canClaim && (
                <button onClick={handleClaim} disabled={busy} className={PRIMARY_CTA_CLASSES}>
                  Claim on {chainName(targetChain)}
                </button>
              )}
            </div>

            {transfer && (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/75">
                <div className="mb-2 font-medium text-white">Transfer status</div>
                <div className="grid gap-1">
                  <div>Status: <span className="text-white">{transfer.status}</span></div>
                  <div>
                    Signatures: {transfer.signaturesCollected}/{transfer.signaturesRequired}
                  </div>
                  {transfer.releaseTxHash && (
                    <div className="break-all">Release tx: {transfer.releaseTxHash}</div>
                  )}
                  <div className="break-all text-white/50">Bridge hash: {bridgeTxHash}</div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

export default function BridgePage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return <BridgeContent />;
}
