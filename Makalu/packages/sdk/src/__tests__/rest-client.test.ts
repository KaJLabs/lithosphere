import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLithoRestClient } from '../rest-client.js';

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('createLithoRestClient', () => {
  // openapi-fetch dispatches via a Request object (not (url, init)).
  // Capture it through a shared ref so the test bodies stay readable.
  function makeFetchMock(body: unknown, status = 200) {
    const captured: { request?: Request } = {};
    const fn = vi.fn((req: Request) => {
      captured.request = req;
      return Promise.resolve(mockResponse(body, status));
    });
    return { fn, captured };
  }

  it('resolves the baseUrl + path into a GET request', async () => {
    const { fn, captured } = makeFetchMock({ blocks: [], pagination: { total: 0 } });
    globalThis.fetch = fn as unknown as typeof fetch;

    const api = createLithoRestClient({ baseUrl: 'https://api.example.test' });
    const { data, error } = await api.GET('/blocks', {
      params: { query: { limit: 5 } },
    });

    expect(error).toBeUndefined();
    expect(data).toEqual({ blocks: [], pagination: { total: 0 } });
    expect(fn).toHaveBeenCalledOnce();

    expect(captured.request!.url).toContain('https://api.example.test/blocks');
    expect(captured.request!.url).toContain('limit=5');
  });

  it('substitutes path parameters', async () => {
    const { fn, captured } = makeFetchMock({ height: 1000 });
    globalThis.fetch = fn as unknown as typeof fetch;

    const api = createLithoRestClient({ baseUrl: 'https://api.example.test' });
    await api.GET('/blocks/{height}', { params: { path: { height: 1000 } } });

    expect(captured.request!.url).toBe('https://api.example.test/blocks/1000');
  });

  it('surfaces non-2xx as `error`, not a thrown exception', async () => {
    const { fn } = makeFetchMock({ message: 'not found' }, 404);
    globalThis.fetch = fn as unknown as typeof fetch;

    const api = createLithoRestClient({ baseUrl: 'https://api.example.test' });
    const { data, error } = await api.GET('/blocks/{height}', {
      params: { path: { height: 999_999_999 } },
    });

    expect(data).toBeUndefined();
    expect(error).toBeDefined();
  });

  it('forwards custom headers from options', async () => {
    const { fn, captured } = makeFetchMock({ ok: true });
    globalThis.fetch = fn as unknown as typeof fetch;

    const api = createLithoRestClient({
      baseUrl: 'https://api.example.test',
      headers: { 'X-Trace-Id': 'abc-123' },
    });
    await api.GET('/blocks', { params: { query: {} } });

    expect(captured.request!.headers.get('X-Trace-Id')).toBe('abc-123');
  });
});
