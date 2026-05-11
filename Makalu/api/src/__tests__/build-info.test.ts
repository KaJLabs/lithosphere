import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { readBuildInfo, buildVersionResponse } from '../lib/build-info.js';

describe('readBuildInfo', () => {
  it('falls back to safe defaults when env vars are unset', () => {
    const info = readBuildInfo({});
    expect(info.gitSha).toBe('unknown');
    expect(info.buildTime).toBe('unknown');
    expect(info.version).toBe('0.0.0');
    expect(info.nodeVersion).toMatch(/^v\d+\./);
  });

  it('reads GIT_SHA / BUILD_TIME / VERSION from the env', () => {
    const info = readBuildInfo({
      GIT_SHA: 'abc1234',
      BUILD_TIME: '2026-05-11T00:00:00Z',
      VERSION: 'v0.2.0',
    });
    expect(info.gitSha).toBe('abc1234');
    expect(info.buildTime).toBe('2026-05-11T00:00:00Z');
    expect(info.version).toBe('v0.2.0');
  });

  it('falls back to npm_package_version when VERSION is unset', () => {
    const info = readBuildInfo({ npm_package_version: '0.3.1' });
    expect(info.version).toBe('0.3.1');
  });
});

describe('buildVersionResponse', () => {
  it('includes the service name and a non-negative uptime', () => {
    const startedAt = Date.now() - 5_000;
    const response = buildVersionResponse('lithosphere-api', startedAt, {
      gitSha: 'abc',
      buildTime: 't',
      version: 'v',
      nodeVersion: 'v20',
    });

    expect(response.service).toBe('lithosphere-api');
    expect(response.gitSha).toBe('abc');
    expect(response.uptimeSec).toBeGreaterThanOrEqual(4);
    expect(response.uptimeSec).toBeLessThan(10);
  });
});

describe('GET /version', () => {
  it('returns the build metadata as JSON', async () => {
    const app = express();
    const start = Date.now();
    const info = {
      gitSha: 'deadbeef',
      buildTime: '2026-05-11T12:00:00Z',
      version: '1.2.3',
      nodeVersion: process.version,
    };
    app.get('/version', (_req, res) =>
      res.status(200).json(buildVersionResponse('lithosphere-api', start, info)),
    );

    const res = await request(app).get('/version');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      service: 'lithosphere-api',
      gitSha: 'deadbeef',
      buildTime: '2026-05-11T12:00:00Z',
      version: '1.2.3',
      nodeVersion: process.version,
    });
    expect(typeof res.body.uptimeSec).toBe('number');
  });
});
