import { useEffect, useState } from 'react';
import { buildSiweMessage, discoverThanos } from 'thanos-connect';
import { getAddress, hexlify, toUtf8Bytes } from 'ethers';
import {
  clearStoredSession,
  getStoredSession,
  saveStoredSession,
  validateSession,
  type StoredSession,
} from '@/lib/auth';

/**
 * "Sign in with Thanos" — SIWE authentication.
 *
 * We drive the flow directly (discover → nonce → build SIWE → personal_sign →
 * verify) instead of using the SDK's <ThanosConnectButton>, for ONE reason:
 * the button hands the raw SIWE *string* to `personal_sign`, and the current
 * Thanos extension mis-serialises that into a byte-map object, so its own
 * ethers call throws `invalid BytesLike value (value={"0":…})` and the signature
 * never completes. Passing a `0x`-hex payload instead signs the exact same bytes
 * (the UTF-8 encoding of the message) but sidesteps the extension's bug. The
 * server still verifies with `verifyMessage(message, signature)` because the
 * signed bytes are identical.
 *
 * Endpoints (GET /api/auth/nonce?address=…, POST /api/auth/verify) are the API's
 * defaults; on success we persist the session and re-validate it against
 * /api/auth/me on mount.
 */

const APP_NAME = 'Lithosphere Makalu Explorer';
const CHAIN_ID = 700777;
const CHAIN_HEX = '0xab169';
const THANOS_RDNS = 'fi.thanos.wallet';

function shorten(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
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

async function signInWithHexPayload(): Promise<StoredSession> {
  const discovered = await discoverThanos({ walletRdns: THANOS_RDNS });
  if (!discovered) {
    throw new Error('Thanos wallet not found. Install the Thanos extension, then reload this page.');
  }
  const provider = discovered.provider;

  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
  if (!accounts?.length) throw new Error('No account was returned by the wallet.');
  const address = getAddress(accounts[0]);

  // Best-effort: make sure the wallet is on Makalu. Thanos has it built in and
  // treats this as a no-op; failures are non-fatal.
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] });
  } catch {
    /* ignore — user can still sign */
  }

  const nonce = (await (await fetch(`/api/auth/nonce?address=${address}`)).text()).trim();

  const message = buildSiweMessage({
    domain: window.location.host,
    address,
    uri: window.location.origin,
    statement: `Sign in to ${APP_NAME} with your Thanos Wallet.`,
    chainId: CHAIN_ID,
    nonce,
  });

  // The fix: sign a 0x-hex payload (the UTF-8 bytes of the message) rather than
  // the raw string. Same bytes signed → server verifyMessage() still recovers
  // the signer, but the extension no longer chokes on a serialised byte-array.
  const hexMessage = hexlify(toUtf8Bytes(message));
  const signature = (await provider.request({
    method: 'personal_sign',
    params: [hexMessage, address],
  })) as string;

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
  if (!res.ok || !body.ok) {
    throw new Error(body.error || 'Sign-in verification failed.');
  }
  return {
    address: body.address ?? address,
    sessionToken: body.sessionToken ?? null,
    expiresAt: body.expiresAt ?? null,
  };
}

export default function ThanosSignIn() {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    try {
      const stored = await signInWithHexPayload();
      setSession(stored);
      saveStoredSession(stored);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
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

  return (
    <div>
      <button
        onClick={handleSignIn}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-2xl border border-sky-300/20 bg-gradient-to-r from-[#6d5cff] to-[#227dff] px-5 py-3 text-sm font-medium text-white shadow-[0_18px_40px_rgba(37,99,235,0.35)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {busy ? 'Signing in…' : 'Sign in with Thanos'}
      </button>
      {error && (
        <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
