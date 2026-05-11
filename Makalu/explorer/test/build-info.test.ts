import { describe, expect, it } from 'vitest';
import { buildVersionResponse, readBuildInfo } from '../lib/build-info';

describe('readBuildInfo', () => {
  it('falls back through GIT_SHA → NEXT_PUBLIC_GIT_SHA → "unknown"', () => {
    expect(readBuildInfo({}).gitSha).toBe('unknown');
    expect(readBuildInfo({ NEXT_PUBLIC_GIT_SHA: 'abc' }).gitSha).toBe('abc');
    expect(readBuildInfo({ GIT_SHA: 'def', NEXT_PUBLIC_GIT_SHA: 'abc' }).gitSha).toBe('def');
  });

  it('prefers VERSION over npm_package_version, defaulting to 0.0.0', () => {
    expect(readBuildInfo({}).version).toBe('0.0.0');
    expect(readBuildInfo({ npm_package_version: '1.2.3' }).version).toBe('1.2.3');
    expect(readBuildInfo({ VERSION: '9.9.9', npm_package_version: '1.2.3' }).version).toBe('9.9.9');
  });

  it('always reports the running node version', () => {
    expect(readBuildInfo({}).nodeVersion).toBe(process.version);
  });
});

describe('buildVersionResponse', () => {
  it('decorates BuildInfo with service + uptimeSec', () => {
    const res = buildVersionResponse('explorer', {
      gitSha: 's',
      buildTime: 't',
      version: 'v',
      nodeVersion: 'n',
    });
    expect(res.service).toBe('explorer');
    expect(res.gitSha).toBe('s');
    expect(res.uptimeSec).toBeGreaterThanOrEqual(0);
  });

  it('defaults service to lithosphere-explorer', () => {
    const res = buildVersionResponse();
    expect(res.service).toBe('lithosphere-explorer');
  });
});
