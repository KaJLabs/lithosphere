import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  THANOS_SESSION_EVENT,
  THANOS_SESSION_KEY,
  authHeaders,
  clearStoredSession,
  getStoredSession,
  saveStoredSession,
  validateSession,
} from '@/lib/auth';
import { messageOf, normalizeSignature } from '@/components/ThanosSignIn';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('Thanos session helpers', () => {
  it('normalizes plain and wrapped wallet signatures', () => {
    expect(normalizeSignature('abcd')).toBe('0xabcd');
    expect(normalizeSignature({ result: { signature: '0x1234' } })).toBe('0x1234');
    expect(normalizeSignature({ result: '' })).toBeNull();
  });

  it('maps wallet cancellation to an actionable message', () => {
    expect(messageOf({ code: 4001 })).toContain('cancelled');
    expect(messageOf({ code: 'ACTION_REJECTED' })).toContain('cancelled');
  });

  it('persists sessions, emits updates, and produces bearer headers', () => {
    const listener = vi.fn();
    window.addEventListener(THANOS_SESSION_EVENT, listener);
    saveStoredSession({ address: '0xabc', sessionToken: 'token.sig', expiresAt: null });
    expect(getStoredSession()?.address).toBe('0xabc');
    expect(authHeaders()).toEqual({ Authorization: 'Bearer token.sig' });
    clearStoredSession();
    expect(localStorage.getItem(THANOS_SESSION_KEY)).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    window.removeEventListener(THANOS_SESSION_EVENT, listener);
  });

  it('drops locally expired sessions', () => {
    localStorage.setItem(
      THANOS_SESSION_KEY,
      JSON.stringify({ address: '0xabc', sessionToken: 'token.sig', expiresAt: 1 }),
    );
    expect(getStoredSession()).toBeNull();
  });

  it('validates a bearer session with the server', async () => {
    saveStoredSession({ address: '0xabc', sessionToken: 'token.sig', expiresAt: null });
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      expect(init?.headers).toEqual({ Authorization: 'Bearer token.sig' });
      return new Response(JSON.stringify({
        ok: true,
        address: '0xabc',
        chainId: 700777,
        expiresAt: 2_000_000_000,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));
    await expect(validateSession()).resolves.toMatchObject({ chainId: 700777 });
  });

  it('clears a server-rejected session', async () => {
    saveStoredSession({ address: '0xabc', sessionToken: 'bad.sig', expiresAt: null });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    await expect(validateSession()).resolves.toBeNull();
    expect(getStoredSession()).toBeNull();
  });
});
