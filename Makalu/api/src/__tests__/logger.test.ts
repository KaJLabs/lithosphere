import { describe, it, expect, vi, afterEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';
import {
  requestIdStore,
  currentRequestId,
  resolveRequestId,
  fetchWithRequestId,
} from '../lib/logger.js';

describe('resolveRequestId', () => {
  it('returns the header value when a string', () => {
    expect(resolveRequestId('abc-123')).toBe('abc-123');
  });

  it('returns the first array entry when an array', () => {
    expect(resolveRequestId(['xyz-456', 'ignored'])).toBe('xyz-456');
  });

  it('generates a UUID when nothing was provided', () => {
    const generated = resolveRequestId(undefined);
    expect(generated).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('generates a UUID for empty strings', () => {
    const generated = resolveRequestId('');
    expect(generated).toMatch(/^[0-9a-f]{8}-/);
  });
});

describe('requestIdStore (AsyncLocalStorage)', () => {
  it('exposes the current requestId inside the .run() scope', async () => {
    let seen: string | undefined;
    await requestIdStore.run({ requestId: 'rid-1' }, async () => {
      await Promise.resolve();
      seen = currentRequestId();
    });
    expect(seen).toBe('rid-1');
  });

  it('returns undefined outside of any scope', () => {
    expect(currentRequestId()).toBeUndefined();
  });

  it('keeps scopes independent across concurrent runs', async () => {
    const results: string[] = [];
    await Promise.all([
      requestIdStore.run({ requestId: 'a' }, async () => {
        await new Promise((r) => setTimeout(r, 5));
        results.push(currentRequestId() ?? 'none');
      }),
      requestIdStore.run({ requestId: 'b' }, async () => {
        await new Promise((r) => setTimeout(r, 2));
        results.push(currentRequestId() ?? 'none');
      }),
    ]);
    expect(results.sort()).toEqual(['a', 'b']);
  });
});

describe('fetchWithRequestId', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('injects X-Request-Id when inside a request scope', async () => {
    let observed: Headers | undefined;
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      observed = new Headers(init?.headers);
      return new Response('ok', { status: 200 });
    }) as unknown as typeof fetch;

    await requestIdStore.run({ requestId: 'rid-42' }, async () => {
      await fetchWithRequestId('https://example.test/api');
    });

    expect(observed?.get('x-request-id')).toBe('rid-42');
  });

  it('preserves an explicit X-Request-Id header set by the caller', async () => {
    let observed: Headers | undefined;
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      observed = new Headers(init?.headers);
      return new Response('ok', { status: 200 });
    }) as unknown as typeof fetch;

    await requestIdStore.run({ requestId: 'rid-from-store' }, async () => {
      await fetchWithRequestId('https://example.test/api', {
        headers: { 'X-Request-Id': 'rid-from-caller' },
      });
    });

    expect(observed?.get('x-request-id')).toBe('rid-from-caller');
  });

  it('falls through to plain fetch outside a request scope', async () => {
    let observed: Headers | undefined;
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      observed = new Headers(init?.headers);
      return new Response('ok', { status: 200 });
    }) as unknown as typeof fetch;

    await fetchWithRequestId('https://example.test/api');

    expect(observed?.has('x-request-id')).toBe(false);
  });
});

describe('request-id middleware behaviour', () => {
  function makeApp() {
    const app = express();
    app.use((req: Request, res: Response, next: NextFunction) => {
      const requestId = resolveRequestId(req.headers['x-request-id']);
      res.setHeader('X-Request-Id', requestId);
      requestIdStore.run({ requestId }, () => next());
    });
    app.get('/echo', (_req, res) => {
      res.status(200).json({ rid: currentRequestId() });
    });
    return app;
  }

  it('echoes back a caller-provided X-Request-Id and exposes it in ALS', async () => {
    const res = await request(makeApp())
      .get('/echo')
      .set('X-Request-Id', 'caller-rid');
    expect(res.status).toBe(200);
    expect(res.body.rid).toBe('caller-rid');
    expect(res.headers['x-request-id']).toBe('caller-rid');
  });

  it('generates and echoes a fresh UUID when none was provided', async () => {
    const res = await request(makeApp()).get('/echo');
    expect(res.status).toBe(200);
    expect(res.body.rid).toMatch(/^[0-9a-f]{8}-/);
    expect(res.headers['x-request-id']).toBe(res.body.rid);
  });
});
