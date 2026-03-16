import Head from 'next/head';
import React, { useMemo, useState } from 'react';
import { EXPLORER_TITLE } from '@/lib/constants';

declare global {
  interface Window {
    ethereum?: any;
  }
}

type WalletType = 'EVM' | 'COSMOS';

type ClaimResponse = {
  ok: boolean;
  txHash?: string;
  message?: string;
  cooldownSeconds?: number;
};

const NETWORK = {
  networkName: 'Lithosphere Makalu',
  rpcUrl: 'https://rpc.litho.ai',
  cosmosChainId: 'lithosphere_700777-1',
  evmChainIdDecimal: 700777,
  evmChainIdHex: '0xab169',
  explorer: 'https://makalu.litho.ai',
  symbol: 'LITHO',
  decimals: 18,
};

function shortenAddress(value: string) {
  if (!value) return '';
  if (value.length < 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export default function FaucetPage() {
  const [address, setAddress] = useState('');
  const [walletType, setWalletType] = useState<WalletType>('EVM');
  const [amount, setAmount] = useState('100 LITHO');
  const [reason, setReason] = useState('');
  const [connectedAddress, setConnectedAddress] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');
  const [cooldown, setCooldown] = useState<number | null>(null);

  const explorerTxUrl = useMemo(() => {
    if (!txHash) return '';
    return `${NETWORK.explorer}/tx/${txHash}`;
  }, [txHash]);

  async function connectEvmWallet() {
    setStatus('');
    setConnecting(true);
    try {
      if (!window.ethereum) {
        setStatus('No injected EVM wallet found. Install MetaMask or another compatible wallet.');
        return;
      }

      const accounts: string[] = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      const selected = accounts?.[0] || '';
      setConnectedAddress(selected);
      setAddress(selected);
      setWalletType('EVM');

      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (currentChainId?.toLowerCase() !== NETWORK.evmChainIdHex.toLowerCase()) {
        setStatus('Wallet connected. Switch to Lithosphere Makalu to continue.');
      } else {
        setStatus('Wallet connected to Makalu.');
      }
    } catch (err: any) {
      setStatus(err?.message || 'Failed to connect wallet.');
    } finally {
      setConnecting(false);
    }
  }

  async function addOrSwitchMakalu() {
    setStatus('');
    try {
      if (!window.ethereum) {
        setStatus('No injected EVM wallet found.');
        return;
      }

      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: NETWORK.evmChainIdHex }],
        });
        setStatus('Switched to Lithosphere Makalu.');
      } catch (switchError: any) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: NETWORK.evmChainIdHex,
              chainName: NETWORK.networkName,
              rpcUrls: [NETWORK.rpcUrl],
              nativeCurrency: {
                name: 'LITHO',
                symbol: NETWORK.symbol,
                decimals: NETWORK.decimals,
              },
              blockExplorerUrls: [NETWORK.explorer],
            },
          ],
        });
        setStatus('Makalu network added to wallet.');
      }
    } catch (err: any) {
      setStatus(err?.message || 'Failed to add or switch network.');
    }
  }

  async function signOwnershipProof() {
    if (!window.ethereum || !connectedAddress) return '';

    const message = `Lithosphere Makalu faucet claim\nAddress: ${connectedAddress}\nAmount: ${amount}`;
    const signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [message, connectedAddress],
    });
    return signature as string;
  }

  async function submitClaim(e: React.FormEvent) {
    e.preventDefault();
    setStatus('');
    setTxHash('');
    setCooldown(null);
    setClaiming(true);

    try {
      let signature = '';
      if (
        walletType === 'EVM' &&
        connectedAddress &&
        connectedAddress.toLowerCase() === address.toLowerCase()
      ) {
        try {
          signature = await signOwnershipProof();
        } catch {
          // continue without signature if user rejects
        }
      }

      const res = await fetch('/api/faucet/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, walletType, amount, reason, signature }),
      });

      const data: ClaimResponse = await res.json();

      if (!res.ok || !data.ok) {
        setStatus(data.message || 'Faucet claim failed.');
        if (typeof data.cooldownSeconds === 'number') {
          setCooldown(data.cooldownSeconds);
        }
        return;
      }

      setStatus(data.message || 'Claim submitted successfully.');
      if (data.txHash) setTxHash(data.txHash);
      if (typeof data.cooldownSeconds === 'number') setCooldown(data.cooldownSeconds);
    } catch (err: any) {
      setStatus(err?.message || 'Failed to submit faucet claim.');
    } finally {
      setClaiming(false);
    }
  }

  return (
    <>
      <Head>
        <title>Faucet | {EXPLORER_TITLE}</title>
      </Head>

      <div className="text-white">
        <div className="mx-auto max-w-6xl">
          {/* Hero */}
          <div className="mb-10 grid gap-6 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                Lithosphere Testnet
              </div>
              <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                Claim LITHO testnet coins on Makalu
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-white/70">
                Connect your wallet, switch to Lithosphere Makalu, and request LITHO for app
                development, contract deployment, and network testing.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={connectEvmWallet}
                  disabled={connecting}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-60"
                >
                  {connecting
                    ? 'Connecting...'
                    : connectedAddress
                    ? `Connected: ${shortenAddress(connectedAddress)}`
                    : 'Connect EVM Wallet'}
                </button>
                <button
                  onClick={addOrSwitchMakalu}
                  className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Add / Switch Makalu
                </button>
              </div>
            </div>

            {/* Network summary card */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30">
              <div className="mb-4 text-sm font-medium text-white/80">Makalu network summary</div>
              <div className="grid gap-3 text-sm text-white/75">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-white/50">Network Name</div>
                  <div className="mt-1 font-medium text-white">{NETWORK.networkName}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-white/50">RPC</div>
                  <div className="mt-1 break-all font-medium text-white">{NETWORK.rpcUrl}</div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="text-white/50">Cosmos Chain ID</div>
                    <div className="mt-1 font-medium text-white">{NETWORK.cosmosChainId}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="text-white/50">EVM Chain ID</div>
                    <div className="mt-1 font-medium text-white">{NETWORK.evmChainIdDecimal}</div>
                  </div>
                </div>
                <a
                  href={NETWORK.explorer}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:bg-white/5"
                >
                  <div className="text-white/50">Explorer</div>
                  <div className="mt-1 font-medium text-white">Open Makalu Explorer</div>
                </a>
              </div>
            </div>
          </div>

          {/* Claim form + network setup */}
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="mb-6">
                <div className="text-sm font-medium text-white/80">Faucet</div>
                <h2 className="mt-2 text-2xl font-semibold">Claim LITHO testnet coins</h2>
                <p className="mt-2 text-sm leading-6 text-white/65">
                  Enter your wallet address and submit a faucet request. The page signs an
                  ownership proof for connected EVM wallets when available.
                </p>
              </div>

              <form onSubmit={submitClaim} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm text-white/70">Wallet Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="0x... or cosmos wallet address"
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/25"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm text-white/70">Wallet Type</label>
                    <select
                      value={walletType}
                      onChange={(e) => setWalletType(e.target.value as WalletType)}
                      className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-white/25"
                    >
                      <option value="EVM">EVM Wallet</option>
                      <option value="COSMOS">Cosmos Wallet</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm text-white/70">Amount</label>
                    <select
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-white/25"
                    >
                      <option>100 LITHO</option>
                      <option>250 LITHO</option>
                      <option>500 LITHO</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-white/70">Reason for Request</label>
                  <textarea
                    rows={4}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Development, contract deployment, app testing, validator setup, etc."
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/25"
                  />
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={claiming}
                    className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-60"
                  >
                    {claiming ? 'Submitting...' : 'Claim Testnet LITHO'}
                  </button>
                  <button
                    type="button"
                    onClick={connectEvmWallet}
                    disabled={connecting}
                    className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
                  >
                    {connecting ? 'Connecting...' : 'Connect Wallet'}
                  </button>
                </div>
              </form>

              {(status || txHash || cooldown !== null) && (
                <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/80">
                  {status && <div>{status}</div>}
                  {txHash && (
                    <div>
                      Tx:{' '}
                      <a
                        href={explorerTxUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-white underline underline-offset-4"
                      >
                        {txHash}
                      </a>
                    </div>
                  )}
                  {cooldown !== null && <div>Cooldown: {cooldown} seconds</div>}
                </div>
              )}

              <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">
                Recommended backend protections: rate limiting, per-wallet cooldowns, IP
                throttling, CAPTCHA, and signature verification for connected wallets.
              </div>
            </section>

            {/* Network setup panel */}
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="mb-6">
                <div className="text-sm font-medium text-white/80">Network Setup</div>
                <h2 className="mt-2 text-2xl font-semibold">Connect to Makalu testnet</h2>
                <p className="mt-2 text-sm leading-6 text-white/65">
                  Add Lithosphere Makalu to your EVM wallet or use the chain identifiers for
                  Cosmos-native tooling.
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-white/50">Network Name</div>
                  <div className="mt-1 font-medium text-white">{NETWORK.networkName}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-white/50">RPC</div>
                  <div className="mt-1 break-all font-medium text-white">{NETWORK.rpcUrl}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-white/50">Cosmos Chain ID</div>
                  <div className="mt-1 font-medium text-white">{NETWORK.cosmosChainId}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-white/50">EVM Chain ID</div>
                  <div className="mt-1 font-medium text-white">{NETWORK.evmChainIdDecimal}</div>
                </div>
                <a
                  href={NETWORK.explorer}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:bg-white/5"
                >
                  <div className="text-white/50">Explorer</div>
                  <div className="mt-1 font-medium text-white">{NETWORK.explorer}</div>
                </a>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={addOrSwitchMakalu}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/90"
                >
                  Add / Switch in Wallet
                </button>
                <a
                  href={NETWORK.explorer}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Open Explorer
                </a>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-sm font-medium text-white">Suggested usage</div>
                <ul className="mt-3 space-y-2 text-sm text-white/65">
                  <li>• Connect an injected EVM wallet and switch to chain ID 700777.</li>
                  <li>• Use the Cosmos chain ID for Cosmos-native clients and relayers.</li>
                  <li>• Track faucet transfers and balances on the Makalu explorer.</li>
                </ul>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
