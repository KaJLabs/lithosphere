import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { register } from 'prom-client';
import {
  metricsMiddleware,
  httpRequestsTotal,
  httpRequestDurationSeconds,
} from '../lib/http-metrics.js';

function makeApp() {
  const app = express();
  app.use(metricsMiddleware);
  app.get('/healthcheck', (_req, res) => res.status(200).json({ ok: true }));
  app.get('/items/:id', (_req, res) => res.status(200).json({ id: _req.params.id }));
  app.get('/boom', (_req, res) => res.status(500).json({ error: 'kaboom' }));
  return app;
}

beforeEach(() => {
  httpRequestsTotal.reset();
  httpRequestDurationSeconds.reset();
});

describe('metricsMiddleware', () => {
  it('records a counter increment + duration observation per request', async () => {
    await request(makeApp()).get('/healthcheck');
    const metrics = await register.getMetricsAsJSON();
    const counter = metrics.find((m) => m.name === 'litho_api_http_requests_total') as any;
    const histogram = metrics.find((m) => m.name === 'litho_api_http_request_duration_seconds') as any;

    expect(counter).toBeDefined();
    expect(histogram).toBeDefined();
    const values = counter.values.filter((v: any) => v.labels.route === '/healthcheck');
    expect(values.length).toBe(1);
    expect(values[0].value).toBe(1);
    expect(values[0].labels.method).toBe('GET');
    expect(values[0].labels.status_code).toBe('200');
  });

  it('uses the route pattern not the raw URL so :id-style paths share a label', async () => {
    await request(makeApp()).get('/items/123');
    await request(makeApp()).get('/items/456');
    const metrics = await register.getMetricsAsJSON();
    const counter = metrics.find((m) => m.name === 'litho_api_http_requests_total') as any;
    const matching = counter.values.filter((v: any) => v.labels.route === '/items/:id');
    expect(matching.length).toBe(1); // single label-set, not two
    expect(matching[0].value).toBe(2);
  });

  it('labels failed responses with their actual status code', async () => {
    await request(makeApp()).get('/boom');
    const metrics = await register.getMetricsAsJSON();
    const counter = metrics.find((m) => m.name === 'litho_api_http_requests_total') as any;
    const boom = counter.values.find((v: any) => v.labels.route === '/boom');
    expect(boom).toBeDefined();
    expect(boom.labels.status_code).toBe('500');
  });

  it('falls back to <no-match> for unrouted requests', async () => {
    await request(makeApp()).get('/totally/unknown/path');
    const metrics = await register.getMetricsAsJSON();
    const counter = metrics.find((m) => m.name === 'litho_api_http_requests_total') as any;
    const fallback = counter.values.find((v: any) => v.labels.route?.includes('<no-match>'));
    expect(fallback).toBeDefined();
    expect(fallback?.labels.status_code).toBe('404');
  });
});
