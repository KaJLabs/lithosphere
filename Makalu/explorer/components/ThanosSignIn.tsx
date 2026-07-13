import { useCallback, useEffect, useState } from 'react';
import { useWeb3Modal, useWeb3ModalAccount, useWeb3ModalProvider } from '@web3modal/ethers/react';
import { buildSiweMessage } from 'thanos-connect';
import { getAddress, hexlify, toUtf8Bytes, type Eip1193Provider } from 'ethers';
import {
  clearStoredSession,
  getStoredSession,
  saveStoredSession,
  validateSession,
  type StoredSession,
} from '@/lib/auth';

/**
 * "Sign in with Thanos" — SIWE authentication, unified with wallet connection.
 *
 * Sign-in runs through the SAME Web3Modal connection the rest of the app uses
 * (bridge, faucet). So signing in also *connects* the wallet: after a successful
 * sign-in the header shows the account pill instead of "Connect Wallet", and the
 * user can immediately transact. If no wallet is connected yet, clicking the
 * button opens the Web3Modal connect flow first, then signs automatically once a
 * wallet lands.
 *
 * We sign a `0x`-hex payload (hexlify(toUtf8Bytes(message))) rather than the raw
 * string — historically the Thanos extension mis-serialised a string message
 * (fixed in v0.9.19, but the hex path keeps older versions working) — and
 * normalise whatever the wallet returns into a signature string. The API's
 * verifyMessage(message, signature) recovers the signer regardless.
 */

const APP_NAME = 'Lithosphere Makalu Explorer';
const CHAIN_ID = 700777;

function shorten(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

/**
 * Coerce whatever the wallet returns from personal_sign into a `0x` signature
 * string. Most providers resolve a plain hex string, but some wrap it
 * ({ signature }, { result }, …). Returns null if no usable signature is present.
 */
function normalizeSignature(raw: unknown): string | null {
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

function messageOf(err: unknown): string {
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
  const { open } = useWeb3Modal();
  const { address, isConnected } = useWeb3ModalAccount();
  const { walletProvider } = useWeb3ModalProvider();

  const [session, setSession] = useState<StoredSession | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // True while we've opened the connect modal and are waiting for a wallet to
  // land so we can proceed to sign.
  const [awaitingConnect, setAwaitingConnect] = useState(false);

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

  const runSignIn = useCallback(async (provider: Eip1193Provider, addr: string) => {
    setBusy(true);
    setError('');
    try {
      const stored = await signSession(provider, addr);
      setSession(stored);
      saveStoredSession(stored);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }, []);

  // A wallet connected while we were waiting → sign now.
  useEffect(() => {
    if (awaitingConnect && isConnected && walletProvider && address) {
      setAwaitingConnect(false);
      void runSignIn(walletProvider as Eip1193Provider, address);
    }
  }, [awaitingConnect, isConnected, walletProvider, address, runSignIn]);

  async function handleSignIn() {
    setError('');
    if (isConnected && walletProvider && address) {
      await runSignIn(walletProvider as Eip1193Provider, address);
    } else {
      // Connect first; the effect above resumes sign-in once connected.
      setAwaitingConnect(true);
      await open({ view: 'Connect' });
    }
  }

  function signOut() {
    setSession(null);
    setError('');
    clearStoredSession();
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

  const label = busy ? 'Signing in…' : awaitingConnect ? 'Connect your wallet…' : 'Sign in with Thanos';

  return (
    <div>
      <button
        onClick={handleSignIn}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-2xl border border-sky-300/20 bg-gradient-to-r from-[#6d5cff] to-[#227dff] px-5 py-3 text-sm font-medium text-white shadow-[0_18px_40px_rgba(37,99,235,0.35)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {label}
      </button>
      {error && (
        <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
