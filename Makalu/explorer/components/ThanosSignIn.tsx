import { useEffect, useState } from 'react';
import { ThanosConnectButton } from 'thanos-connect/react';
import type { ThanosSession } from 'thanos-connect';
import {
  clearStoredSession,
  getStoredSession,
  saveStoredSession,
  validateSession,
  type StoredSession,
} from '@/lib/auth';

/**
 * "Sign in with Thanos" — SIWE authentication via the `thanos-connect` SDK.
 *
 * The SDK's default endpoints (GET /api/auth/nonce?address=…, POST
 * /api/auth/verify) are exactly what the Makalu API serves, so no endpoint
 * overrides are needed. On success the API returns a session token, which we
 * persist in localStorage — and re-validate against the server (`/api/auth/me`)
 * on mount so a stale/tampered token never shows as signed in.
 */

function shorten(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

export default function ThanosSignIn() {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [error, setError] = useState('');

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

  function handleSignIn(s: ThanosSession) {
    const raw = s.raw as { expiresAt?: number } | undefined;
    const stored: StoredSession = {
      address: s.address,
      sessionToken: s.sessionToken,
      expiresAt: raw?.expiresAt ?? null,
    };
    setSession(stored);
    setError('');
    saveStoredSession(stored);
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
      <ThanosConnectButton
        config={{ appName: 'Lithosphere Makalu Explorer', chainId: 700777 }}
        onSignIn={handleSignIn}
        onError={(e) => setError(e.message)}
      />
      {error && (
        <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
