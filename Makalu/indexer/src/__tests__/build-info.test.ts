import { describe, it, expect } from 'vitest';
import { readBuildInfo, buildVersionResponse } from '../lib/build-info.js';

describe('readBuildInfo (indexer)', () => {
  it('falls back to safe defaults when env vars are unset', () => {
    const info = readBuildInfo({});
    expect(info.gitSha).toBe('unknown');
    expect(info.buildTime).toBe('unknown');
    expect(info.version).toBe('0.0.0');
  });

  it('reads env vars when present', () => {
    const info = readBuildInfo({
      GIT_SHA: 'abc1234',
      BUILD_TIME: '2026-05-11T00:00:00Z',
      VERSION: 'v0.2.0',
    });
    expect(info.gitSha).toBe('abc1234');
    expect(info.buildTime).toBe('2026-05-11T00:00:00Z');
    expect(info.version).toBe('v0.2.0');
  });
});

describe('buildVersionResponse (indexer)', () => {
  it('builds a version response with uptime', () => {
    const startedAt = Date.now() - 3000;
    const response = buildVersionResponse('lithosphere-indexer', startedAt);
    expect(response.service).toBe('lithosphere-indexer');
    expect(response.uptimeSec).toBeGreaterThanOrEqual(2);
  });
});
