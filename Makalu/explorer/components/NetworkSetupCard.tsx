import {
  useWeb3Modal,
  useWeb3ModalAccount,
  useWeb3ModalProvider,
} from '@web3modal/ethers/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { NETWORK } from '@/lib/network';
import { ensureExplorerNetwork, type WalletRequestProvider } from '@/lib/walletNetwork';

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-litho-500 transition hover:border-litho-300 hover:bg-litho-50 dark:text-litho-300 dark:hover:bg-litho-400/10"
      aria-label={`Copy ${label}`}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function NetworkSetupCard() {
  const { open } = useWeb3Modal();
  const { isConnected, chainId } = useWeb3ModalAccount();
  const { walletProvider } = useWeb3ModalProvider();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pendingAdd = useRef(false);
  const connectedToExplorer = Number(chainId) === NETWORK.evmChainId;

  const addOrSwitch = useCallback(async () => {
    setError('');

    if (!NETWORK.walletReady) {
      setError(`${NETWORK.label} RPC is not configured.`);
      return;
    }

    if (!isConnected || !walletProvider) {
      pendingAdd.current = true;
      await open({ view: 'Connect' });
      return;
    }

    setBusy(true);
    try {
      await ensureExplorerNetwork(walletProvider as WalletRequestProvider);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Could not add the network.';
      setError(message);
    } finally {
      setBusy(false);
    }
  }, [isConnected, open, walletProvider]);

  useEffect(() => {
    if (!pendingAdd.current || !isConnected || !walletProvider) return;
    pendingAdd.current = false;
    void addOrSwitch();
  }, [addOrSwitch, isConnected, walletProvider]);

  const details = [
    { label: 'EVM chain ID', value: `${NETWORK.evmChainId} (${NETWORK.chainIdHex})` },
    { label: 'Cosmos chain ID', value: NETWORK.cosmosChainId },
    { label: 'RPC endpoint', value: NETWORK.rpcUrl || 'Not configured' },
    { label: 'Native currency', value: 'LITHO' },
  ];

  return (
    <section className="network-setup-card rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 shadow-sm">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-litho-500">
            Wallet network
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{NETWORK.label}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-text-secondary)]">
            Add the official network configuration to your wallet before connecting or signing in.
          </p>
        </div>
        <button
          type="button"
          onClick={addOrSwitch}
          disabled={busy || connectedToExplorer}
          className="shrink-0 rounded-2xl bg-litho-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-litho-500/20 transition hover:bg-litho-600 disabled:cursor-default disabled:bg-emerald-500 disabled:opacity-100"
        >
          {busy
            ? 'Adding network…'
            : connectedToExplorer
              ? `✓ ${NETWORK.shortName} connected`
              : isConnected
                ? `Switch to ${NETWORK.shortName}`
                : `Quick add ${NETWORK.shortName}`}
        </button>
      </div>

      <dl className="mt-6 divide-y divide-[var(--color-border-light)] overflow-hidden rounded-2xl border border-[var(--color-border)]">
        {details.map((detail) => (
          <div key={detail.label} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <dt className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              {detail.label}
            </dt>
            <dd className="flex min-w-0 items-center gap-3">
              <code className="min-w-0 break-all text-sm text-[var(--color-text-primary)]">
                {detail.value}
              </code>
              <CopyButton value={detail.value} label={detail.label} />
            </dd>
          </div>
        ))}
      </dl>

      {error && (
        <p className="mt-4 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-600 dark:text-red-200">
          {error}
        </p>
      )}
    </section>
  );
}
