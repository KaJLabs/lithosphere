import { ConnectionController, ConnectorController, type Connector } from '@web3modal/core';
import { useDisconnect } from '@web3modal/ethers/react';
import { getAddress, hexlify, toUtf8Bytes, type Eip1193Provider } from 'ethers';
import { useEffect, useState } from 'react';
import { buildSiweMessage } from 'thanos-connect';

import {
  clearStoredSession,
  getStoredSession,
  saveStoredSession,
  validateSession,
  type StoredSession,
} from '@/lib/auth';
import { NETWORK } from '@/lib/network';
import { isThanosConnector, isThanosIdentity, THANOS_INSTALL_URL } from '@/lib/thanos';
import { ensureExplorerNetwork, type WalletRequestProvider } from '@/lib/walletNetwork';

/**
 * "Sign in with Thanos" — SIWE authentication, unified with wallet connection.
 *
 * The button connects the Thanos wallet DIRECTLY (EIP-6963, RDNS
 * `fi.thanos.wallet`) — no multi-wallet picker. It drives Web3Modal's own
 * connect path (ConnectionController.connectExternal, the same call the
 * modal's wallet list makes), so the whole app sees the connection exactly as
 * if Thanos had been picked in the modal: the header shows the account pill,
 * and bridge/faucet can transact immediately. If Thanos isn't installed we
 * show an install link instead of falling back to the wallet picker.
 *
 * Sign out clears the SIWE session AND disconnects the wallet in the same
 * click, so the header flips back to "Connect Wallet" without a page refresh.
 *
 * We sign a `0x`-hex payload (hexlify(toUtf8Bytes(message))) rather than the raw
 * string — historically the Thanos extension mis-serialised a string message
 * (fixed in v0.9.19, but the hex path keeps older versions working) — and
 * normalise whatever the wallet returns into a signature string. The API's
 * verifyMessage(message, signature) recovers the signer regardless.
 */

const APP_NAME = `${NETWORK.label} Explorer`;
const CHAIN_ID = NETWORK.evmChainId;
function shorten(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function findThanosConnector(): Connector | undefined {
  return ConnectorController.state.connectors.find(isThanosConnector);
}

/**
 * Thanos may announce after Web3Modal's init-time EIP-6963 discovery (the
 * extension's service worker can wake late). Re-request announcements once
 * before concluding it isn't installed.
 */
type ThanosWallet = { connector?: Connector; provider: Eip1193Provider };

type ThanosInjectedWindow = Window & {
  thanos?: Eip1193Provider & { isThanos?: boolean };
};

function findInjectedThanosProvider(): Eip1193Provider | undefined {
  const provider = (window as ThanosInjectedWindow).thanos;
  return provider?.isThanos === true && typeof provider.request === 'function'
    ? provider
    : undefined;
}

export async function discoverThanosWallet(): Promise<ThanosWallet | undefined> {
  const existing = findThanosConnector();
  if (existing?.provider) {
    return { connector: existing, provider: existing.provider as Eip1193Provider };
  }

  // The published extension also exposes the same provider as window.thanos.
  // Use it as a verified fallback when an EIP-6963 announcement was missed.
  const injectedProvider = findInjectedThanosProvider();
  if (injectedProvider) return { provider: injectedProvider };

  let announcedProvider: Eip1193Provider | undefined;
  const onAnnouncement = (event: Event) => {
    const detail = (event as CustomEvent<{
      info?: { rdns?: string; name?: string };
      provider?: Eip1193Provider;
    }>).detail;
    if (detail?.provider && isThanosIdentity(detail.info?.rdns, detail.info?.name)) {
      announcedProvider = detail.provider;
    }
  };

  window.addEventListener('eip6963:announceProvider', onAnnouncement);
  window.dispatchEvent(new Event('eip6963:requestProvider'));

  try {
    // Extension service workers can wake after Web3Modal's initial discovery.
    // Allow late announcements and prefer Web3Modal's connector when it appears.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      const connector = findThanosConnector();
      if (connector?.provider) {
        return { connector, provider: connector.provider as Eip1193Provider };
      }
      if (announcedProvider) return { provider: announcedProvider };
      const lateInjectedProvider = findInjectedThanosProvider();
      if (lateInjectedProvider) return { provider: lateInjectedProvider };
    }
  } finally {
    window.removeEventListener('eip6963:announceProvider', onAnnouncement);
  }

  return announcedProvider ? { provider: announcedProvider } : undefined;
}

/**
 * Coerce whatever the wallet returns from personal_sign into a `0x` signature
 * string. Most providers resolve a plain hex string, but some wrap it
 * ({ signature }, { result }, …). Returns null if no usable signature is present.
 */
export function normalizeSignature(raw: unknown): string | null {
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return null;
    return s.startsWith('0x') ? s : `0x${s}`;
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    for (const key of ['signature', 'result', 'sig', 'data', 'value']) {
      if (o[key] != null) {
        const nested = normalizeSignature(o[key]);
        if (nested) return nested;
      }
    }
  }
  return null;
}

function describeShape(raw: unknown): string {
  if (raw === undefined) return 'undefined';
  if (raw === null) return 'null';
  if (typeof raw === 'object') {
    const keys = Object.keys(raw as object);
    return keys.length ? `object{${keys.join(',')}}` : 'empty object';
  }
  return typeof raw;
}

export function messageOf(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const e = err as { code?: number | string; message?: string };
    if (e.code === 4001 || e.code === 'ACTION_REJECTED') {
      return 'Signature request was cancelled in the wallet.';
    }
    if (typeof e.message === 'string' && e.message) return e.message;
  }
  return 'Sign-in failed. Please try again.';
}

/** SIWE round-trip against a connected EIP-1193 provider. */
async function signSession(provider: Eip1193Provider, rawAddress: string): Promise<StoredSession> {
  const address = getAddress(rawAddress);
  const nonce = (await (await fetch(`/api/auth/nonce?address=${address}`)).text()).trim();

  const message = buildSiweMessage({
    domain: window.location.host,
    address,
    uri: window.location.origin,
    statement: `Sign in to ${APP_NAME} with your Thanos Wallet.`,
    chainId: CHAIN_ID,
    nonce,
  });

  const hexMessage = hexlify(toUtf8Bytes(message));
  const raw = await provider.request({ method: 'personal_sign', params: [hexMessage, address] });
  const signature = normalizeSignature(raw);
  if (!signature) {
    throw new Error(
      `The wallet did not return a signature (${describeShape(raw)}). ` +
        'Update the Thanos extension to the latest version and try again.',
    );
  }

  const res = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, signature, address }),
  });
  const body = (await res.json()) as {
    ok?: boolean;
    error?: string;
    address?: string;
    sessionToken?: string | null;
    expiresAt?: number | null;
  };
  if (!res.ok || !body.ok) throw new Error(body.error || 'Sign-in verification failed.');
  return {
    address: body.address ?? address,
    sessionToken: body.sessionToken ?? null,
    expiresAt: body.expiresAt ?? null,
  };
}

export default function ThanosSignIn() {
  const { disconnect } = useDisconnect();

  const [session, setSession] = useState<StoredSession | null>(null);
  const [error, setError] = useState('');
  const [thanosMissing, setThanosMissing] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'connecting' | 'signing'>('idle');

  // Restore a session on mount, then confirm it with the server. A token in
  // localStorage is only a claim; /api/auth/me is the source of truth.
  useEffect(() => {
    const stored = getStoredSession();
    if (!stored) return;
    setSession(stored); // optimistic — avoids a flash of the signed-out button
    void validateSession().then((identity) => {
      if (!identity) setSession(null); // validateSession already cleared storage
    });
  }, []);

  async function handleSignIn() {
    setError('');
    setThanosMissing(false);
    setPhase('connecting');
    try {
      const wallet = await discoverThanosWallet();
      if (!wallet) {
        setThanosMissing(true);
        return;
      }
      const { connector, provider } = wallet;
      if (connector) {
        // Keep Web3Modal's shared account state in sync when its connector is available.
        await ConnectionController.connectExternal(connector, connector.chain);
      }
      let accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
      if (!accounts?.length && !connector) {
        accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
      }
      const address = accounts?.[0];
      if (!address) {
        // connectExternal swallows a user rejection (it stores the error and
        // resolves) — an empty account list is how the rejection surfaces here.
        throw new Error('Wallet connection was declined in Thanos.');
      }
      await ensureExplorerNetwork(provider as WalletRequestProvider);
      setPhase('signing');
      const stored = await signSession(provider, address);
      setSession(stored);
      saveStoredSession(stored);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setPhase('idle');
    }
  }

  async function signOut() {
    setSession(null);
    setError('');
    clearStoredSession();
    // Also disconnect the wallet so the header account pill clears immediately,
    // with no page refresh.
    try {
      await disconnect();
    } catch {
      /* wallet may already be disconnected */
    }
  }

  if (session) {
    return (
      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5 text-sm text-emerald-100">
        <div className="font-medium text-white">Signed in with Thanos</div>
        <div className="mt-1 break-all text-emerald-200/90" title={session.address}>
          {shorten(session.address)}
        </div>
        {session.expiresAt && (
          <div className="mt-1 text-xs text-emerald-200/60">
            Session valid until {new Date(session.expiresAt * 1000).toLocaleString()}
          </div>
        )}
        <button
          onClick={signOut}
          className="mt-4 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
        >
          Sign out
        </button>
      </div>
    );
  }

  const busy = phase !== 'idle';
  const label =
    phase === 'connecting' ? 'Connecting Thanos…' : phase === 'signing' ? 'Signing in…' : 'Sign in with Thanos';

  return (
    <div>
      <button
        onClick={handleSignIn}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-2xl border border-sky-300/20 bg-gradient-to-r from-[#6d5cff] to-[#227dff] px-5 py-3 text-sm font-medium text-white shadow-[0_18px_40px_rgba(37,99,235,0.35)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {label}
      </button>
      {thanosMissing && (
        <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">
          Thanos Wallet was not detected in this browser.{' '}
          <a
            href={THANOS_INSTALL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline hover:text-amber-100"
          >
            Install the Thanos extension
          </a>{' '}
          and try again.
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
