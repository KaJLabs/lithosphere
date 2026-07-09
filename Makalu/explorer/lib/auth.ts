/**
 * Thanos SIWE session helpers (client side).
 *
 * The `thanos-connect` sign-in mints an HMAC session token that the API's
 * `/api/auth/verify` returns. We persist it in localStorage so the signed-in
 * state survives reloads — but a token in localStorage is only a *claim*. The
 * server is the source of truth: `validateSession()` calls `/api/auth/me` with
 * the Bearer token so a tampered/expired/forged token is rejected, not merely
 * trusted. Use `authHeaders()` to attach the token to any authenticated fetch.
 */

export const THANOS_SESSION_KEY = 'thanos_session';
export const THANOS_SESSION_EVENT = 'thanos-session-changed';

export interface StoredSession {
  address: string;
  sessionToken: string | null;
  expiresAt: number | null; // unix seconds
}

export interface VerifiedIdentity {
  address: string;
  chainId: number;
  expiresAt: number; // unix seconds
}

/** Read the persisted session, dropping it if the local expiry has passed. */
export function getStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(THANOS_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredSession;
    if (s.expiresAt && s.expiresAt * 1000 <= Date.now()) {
      localStorage.removeItem(THANOS_SESSION_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function saveStoredSession(s: StoredSession): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(THANOS_SESSION_KEY, JSON.stringify(s));
  } catch {
    /* storage may be unavailable (private mode) — caller keeps it in memory */
  }
  notifySessionChanged();
}

export function clearStoredSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(THANOS_SESSION_KEY);
  } catch {
    /* ignore */
  }
  notifySessionChanged();
}

/** Authorization header for authenticated API calls (empty when signed out). */
export function authHeaders(): Record<string, string> {
  const s = getStoredSession();
  return s?.sessionToken ? { Authorization: `Bearer ${s.sessionToken}` } : {};
}

/** Notify same-tab listeners (e.g. the Header) that the session changed. */
export function notifySessionChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(THANOS_SESSION_EVENT));
  }
}

/**
 * Confirm a stored session with the server. Returns the verified identity, or
 * null (and clears the stored session) if the token is invalid/expired. This is
 * what turns "a token in localStorage" into real, server-checked auth.
 */
export async function validateSession(): Promise<VerifiedIdentity | null> {
  const s = getStoredSession();
  if (!s?.sessionToken) return null;
  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${s.sessionToken}` },
    });
    if (!res.ok) {
      clearStoredSession();
      return null;
    }
    const body = (await res.json()) as { ok?: boolean } & VerifiedIdentity;
    if (!body.ok) {
      clearStoredSession();
      return null;
    }
    return { address: body.address, chainId: body.chainId, expiresAt: body.expiresAt };
  } catch {
    // Network error — leave the stored session in place; treat as unverified.
    return null;
  }
}
