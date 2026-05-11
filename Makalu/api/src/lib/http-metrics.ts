import { Counter, Histogram } from 'prom-client';
import type { Request, Response, NextFunction } from 'express';

/**
 * HTTP request metrics for SLO computation in Grafana.
 *
 * Cardinality is the main concern: labels must be a small finite set or
 * Prometheus storage explodes. So we use `req.route.path` (Express's
 * normalized pattern like "/api/blocks/:height"), NOT `req.originalUrl`
 * (which embeds the actual `:height` value).
 *
 * For requests that don't match a route (404s, the explorer-proxy fall-
 * through), we bucket under `<no-match>` so they're visible without
 * blowing up cardinality.
 */

const HISTOGRAM_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];

export const httpRequestsTotal = new Counter({
  name: 'litho_api_http_requests_total',
  help: 'Total HTTP requests handled by the api, labeled by method, route pattern, and status code.',
  labelNames: ['method', 'route', 'status_code'] as const,
});

export const httpRequestDurationSeconds = new Histogram({
  name: 'litho_api_http_request_duration_seconds',
  help: 'HTTP request handler duration in seconds, labeled by method, route pattern, and status code.',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: HISTOGRAM_BUCKETS,
});

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startNs = process.hrtime.bigint();
  res.on('finish', () => {
    const durationSec = Number(process.hrtime.bigint() - startNs) / 1e9;
    // route.path is populated by Express after the matcher runs; before
    // routing it's undefined. Falling back to "<no-match>" keeps 404s and
    // the explorer-proxy catchall visible without high cardinality from
    // raw URLs.
    const routePath = req.route?.path
      ?? (req.baseUrl ? `${req.baseUrl}<no-match>` : '<no-match>');
    const labels = {
      method: req.method,
      route: routePath,
      status_code: String(res.statusCode),
    };
    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durationSec);
  });
  next();
}
