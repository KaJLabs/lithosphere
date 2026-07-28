import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db.js', () => ({
  query: vi.fn(),
  slowQuery: vi.fn(),
  getPool: vi.fn(),
}));

const { explorerRouter } = await import('../routes.js');
const originalNodeEnv = process.env.NODE_ENV;
const originalSecret = process.env.AUTH_SESSION_SECRET;

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalSecret === undefined) delete process.env.AUTH_SESSION_SECRET;
  else process.env.AUTH_SESSION_SECRET = originalSecret;
});

describe('production authentication configuration', () => {
  it('rejects a missing or placeholder session secret', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.AUTH_SESSION_SECRET;
    expect(() => explorerRouter()).toThrow(/AUTH_SESSION_SECRET/);

    process.env.AUTH_SESSION_SECRET = '<INJECTED_BY_CI>';
    expect(() => explorerRouter()).toThrow(/AUTH_SESSION_SECRET/);
  });

  it('accepts a sufficiently long injected secret', () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_SESSION_SECRET = 'production-only-secret-with-at-least-32-characters';
    expect(() => explorerRouter()).not.toThrow();
  });
});
