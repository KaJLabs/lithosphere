import express from 'express';
import { register, collectDefaultMetrics, Counter, Histogram } from 'prom-client';

const router = express.Router();

collectDefaultMetrics({ prefix: 'bridge_api_' });

export const httpRequestsTotal = new Counter({
  name: 'bridge_api_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const httpRequestDuration = new Histogram({
  name: 'bridge_api_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

export const bridgeTxTotal = new Counter({
  name: 'bridge_tx_locked_total',
  help: 'Total TokensLocked events processed',
});

// GET /metrics
router.get('/', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

export default router;
