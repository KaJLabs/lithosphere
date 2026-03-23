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
  evmRpcUrl: 'https://rpc.litho.ai',
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
  const [walletType, setWalletType] = useState<WalletType>('COSMOS');
  const [amount, setAmount] = useState('10 LITHO');
  const [reason, setReason] = useState('');
  const [connectedAddress, setConnectedAddress] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [statusType, setStatusType] = useState<'info' | 'error' | 'success'>('info');
  const [txHash, setTxHash] = useState<string>('');
  const [cooldown, setCooldown] = useState<number | null>(null);

  const explorerTxUrl = useMemo(() => {
    if (!txHash) return '';
    return `${NETWORK.explorer}/tx/${txHash}`;
  }, [txHash]);

  function showStatus(msg: string, type: 'info' | 'error' | 'success' = 'info') {
    setStatus(msg);
    setStatusType(type);
  }

  async function connectEvmWallet() {
    showStatus('');
    setConnecting(true);
    try {
      if (!window.ethereum) {
        showStatus('No EVM wallet detected. Please install MetaMask or a compatible browser wallet extension.', 'error');
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
        showStatus(`Wallet connected (${shortenAddress(selected)}). Please switch to Lithosphere Makalu network.`, 'info');
      } else {
        showStatus(`Wallet connected to Makalu: ${shortenAddress(selected)}`, 'success');
      }
    } catch (err: any) {
      if (err?.code === 4001) {
        showStatus('Connection request rejected by user.', 'error');
      } else {
        showStatus(err?.message || 'Failed to connect wallet.', 'error');
      }
    } finally {
      setConnecting(false);
    }
  }

  async function addOrSwitchMakalu() {
    showStatus('');
    try {
      if (!window.ethereum) {
        showStatus('No EVM wallet detected. Please install MetaMask or a compatible browser wallet extension.', 'error');
        return;
      }

      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: NETWORK.evmChainIdHex }],
        });
        showStatus('Switched to Lithosphere Makalu.', 'success');
      } catch (switchError: any) {
        if (switchError?.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: NETWORK.evmChainIdHex,
                chainName: NETWORK.networkName,
                rpcUrls: [NETWORK.evmRpcUrl],
                nativeCurrency: {
                  name: 'LITHO',
                  symbol: NETWORK.symbol,
                  decimals: NETWORK.decimals,
                },
                blockExplorerUrls: [NETWORK.explorer],
              },
            ],
          });
          showStatus('Makalu network added to wallet.', 'success');
        } else if (switchError?.code === 4001) {
          showStatus('Network switch rejected by user.', 'error');
        } else {
          showStatus(switchError?.message || 'Failed to switch network.', 'error');
        }
      }
    } catch (err: any) {
      if (err?.code === 4001) {
        showStatus('Request rejected by user.', 'error');
      } else {
        showStatus(err?.message || 'Failed to add or switch network.', 'error');
      }
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
    showStatus('');
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
        showStatus(data.message || 'Faucet claim failed.', 'error');
        if (typeof data.cooldownSeconds === 'number') {
          setCooldown(data.cooldownSeconds);
        }
        return;
      }

      showStatus(data.message || 'Claim submitted successfully.', 'success');
      if (data.txHash) setTxHash(data.txHash);
      if (typeof data.cooldownSeconds === 'number') setCooldown(data.cooldownSeconds);
    } catch (err: any) {
      showStatus(err?.message || 'Failed to submit faucet claim.', 'error');
    } finally {
      setClaiming(false);
    }
  }

  const statusColors = {
    info: 'border-blue-400/20 bg-blue-400/10 text-blue-200',
    error: 'border-red-400/20 bg-red-400/10 text-red-200',
    success: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
  };

  return (
    <>
      <Head>
        <title>Faucet | {EXPLORER_TITLE}</title>
      </Head>

      <div className="text-white">
        <div className="mx-auto max-w-6xl">

          {/* Status banner — visible at top so feedback is always seen */}
          {status && (
            <div className={`mb-6 rounded-2xl border p-4 text-sm ${statusColors[statusType]}`}>
              {status}
            </div>
          )}

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
                  <div className="mt-1 break-all font-medium text-white">{NETWORK.evmRpcUrl}</div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="text-white/50">Chain ID</div>
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
                  Enter your wallet address and select an amount. Maximum one claim per wallet every 24 hours.
                </p>
              </div>

              <form onSubmit={submitClaim} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm text-white/70">Wallet Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="0x... or litho1... wallet address"
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
                      <option value="COSMOS">Wallet</option>
                      <option value="EVM">EVM Wallet</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm text-white/70">Amount</label>
                    <select
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-white/25"
                    >
                      <option>10 LITHO</option>
                      <option>25 LITHO</option>
                      <option>50 LITHO</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={claiming || !address}
                    className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {claiming ? 'Submitting...' : 'Claim Testnet LITHO'}
                  </button>
                  <button
                    type="button"
                    onClick={connectEvmWallet}
                    disabled={connecting}
                    className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
                  >
                    {connecting ? 'Connecting...' : connectedAddress ? `${shortenAddress(connectedAddress)}` : 'Connect Wallet'}
                  </button>
                </div>
              </form>

              {txHash && (
                <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">
                  <div className="font-medium">Transaction Submitted</div>
                  <a
                    href={explorerTxUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block break-all text-white underline underline-offset-4"
                  >
                    {txHash}
                  </a>
                </div>
              )}

              {cooldown !== null && cooldown > 0 && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
                  Cooldown: {Math.ceil(cooldown / 3600)}h remaining before next claim
                </div>
              )}
            </section>

            {/* Network setup panel */}
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="mb-6">
                <div className="text-sm font-medium text-white/80">Network Setup</div>
                <h2 className="mt-2 text-2xl font-semibold">Connect to Makalu testnet</h2>
                <p className="mt-2 text-sm leading-6 text-white/65">
                  Add Lithosphere Makalu to your EVM wallet or use the chain identifiers for
                  native tooling.
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-white/50">Network Name</div>
                  <div className="mt-1 font-medium text-white">{NETWORK.networkName}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-white/50">EVM RPC</div>
                  <div className="mt-1 break-all font-medium text-white">{NETWORK.evmRpcUrl}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-white/50">Chain ID</div>
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
                  <li>• Install MetaMask or a compatible EVM wallet extension.</li>
                  <li>• Click &quot;Connect EVM Wallet&quot; then &quot;Add / Switch Makalu&quot;.</li>
                  <li>• Enter your address and select an amount (10, 25, or 50 LITHO).</li>
                  <li>• One claim per wallet every 24 hours.</li>
                </ul>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
