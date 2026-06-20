import 'dotenv/config';
// IMPORTANT: tracing must be imported BEFORE any other modules (express, pg,
// fetch wrappers) so OpenTelemetry's auto-instrumentation can patch them at
// load time. Moving this import lower silently produces empty traces.
import './tracing.js';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { ApolloServer } from 'apollo-server-express';
import { typeDefs, resolvers } from './schema.js';
import { lithoRouter } from './litho.js';
import { explorerRouter } from './routes.js';
import { register, collectDefaultMetrics, Gauge } from 'prom-client';
import { readBuildInfo, buildVersionResponse } from './lib/build-info.js';
import {
  logger,
  requestIdStore,
  resolveRequestId,
} from './lib/logger.js';
import { metricsMiddleware } from './lib/http-metrics.js';
import { ensurePerformanceIndexes } from './lib/ensure-indexes.js';

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({ prefix: 'litho_api_' });

// Build metadata — exposed via /version and as a Prometheus gauge so an
// operator can join a metric or alert back to the commit that produced the
// running binary. Standard Prometheus build-info pattern: value is always 1;
// the labels carry the data so PromQL can group/join across services.
const BUILD_INFO = readBuildInfo();

new Gauge({
  name: 'litho_api_build_info',
  help: 'API build metadata. Value is always 1; labels carry git_sha / build_time / version.',
  labelNames: ['git_sha', 'build_time', 'version', 'node_version'],
}).set(
  {
    git_sha: BUILD_INFO.gitSha,
    build_time: BUILD_INFO.buildTime,
    version: BUILD_INFO.version,
    node_version: BUILD_INFO.nodeVersion,
  },
  1,
);

const app = express();
const EXPLORER_INTERNAL_URL = process.env.EXPLORER_INTERNAL_URL || 'http://explorer:3000';
const EXPLORER_PROXY_TIMEOUT_MS = 15_000;
const STRIPPED_PROXY_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function buildExplorerProxyHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) continue;
    headers[key] = Array.isArray(value) ? value.join(', ') : value;
  }

  const forwardedHost = typeof req.headers.host === 'string' ? req.headers.host : 'makalu.litho.ai';
  const forwardedFor = req.headers['x-forwarded-for'];

  headers['x-forwarded-host'] = forwardedHost;
  headers['x-forwarded-proto'] = req.protocol;

  if (req.ip) {
    headers['x-forwarded-for'] =
      typeof forwardedFor === 'string' && forwardedFor.length > 0
        ? `${forwardedFor}, ${req.ip}`
        : req.ip;
  }

  return headers;
}

// Resolved at module load; reused as the SSRF origin allow-list below.
const EXPLORER_ALLOWED_ORIGIN = new URL(EXPLORER_INTERNAL_URL).origin;

async function proxyExplorerRequest(req: Request, res: Response) {
  // Two-layer SSRF defence:
  //   1. Pre-construction path check — `req.originalUrl` MUST be a true
  //      single-slash absolute path. `//evil.com/x` would parse as an
  //      authority change in the URL constructor; reject it before we
  //      compose the upstream URL. CodeQL's js/request-forgery query
  //      recognises this `startsWith('/')` + double-slash exclusion as
  //      a sanitizer.
  //   2. Post-resolution origin allow-list — the resolved upstream MUST
  //      match EXPLORER_ALLOWED_ORIGIN exactly. Catches any future
  //      URL-constructor quirk that bypasses (1).
  const path = req.originalUrl;
  if (!path.startsWith('/') || path.startsWith('//')) {
    res.status(400).type('text/plain').send('Bad proxy target');
    return;
  }
  const target = new URL(path, EXPLORER_INTERNAL_URL);
  if (target.origin !== EXPLORER_ALLOWED_ORIGIN) {
    res.status(400).type('text/plain').send('Bad proxy target');
    return;
  }
  const upstream = await fetch(target, {
    method: req.method,
    headers: buildExplorerProxyHeaders(req),
    redirect: 'manual',
    signal: AbortSignal.timeout(EXPLORER_PROXY_TIMEOUT_MS),
  });

  res.status(upstream.status);
  upstream.headers.forEach((value, key) => {
    if (!STRIPPED_PROXY_HEADERS.has(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  const body = Buffer.from(await upstream.arrayBuffer());
  res.end(body);
}

app.use(cors());
app.use(express.json());

// HTTP request metrics — records counter + histogram on every response so
// SLO dashboards can compute availability + latency over real traffic.
// Mounted before the request-id middleware so the timer starts before any
// downstream middleware adds overhead.
app.use(metricsMiddleware);

// Request ID middleware — read X-Request-Id from the client or generate a
// fresh UUID. Store it in AsyncLocalStorage so any downstream `await` (db
// queries, fetch calls, logger.* calls) can read the same id without
// threading it through arguments. Echo it back as a response header so
// callers can include it in bug reports.
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = resolveRequestId(req.headers['x-request-id']);
  res.setHeader('X-Request-Id', requestId);
  requestIdStore.run({ requestId }, () => {
    const start = Date.now();
    res.on('finish', () => {
      logger.info(
        {
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          durationMs: Date.now() - start,
        },
        'request_completed',
      );
    });
    next();
  });
});

const PROCESS_START = Date.now();

// Health check endpoint for deployment verification
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'lithosphere-api',
    timestamp: new Date().toISOString(),
    version: BUILD_INFO.version,
    environment: process.env.NODE_ENV || 'development',
  });
});

// Build metadata endpoint — surfaces what's deployed so an operator can join
// "production is broken" to a specific commit without SSH-and-git-log dancing.
app.get('/version', (_req, res) => {
  res.status(200).json(buildVersionResponse('lithosphere-api', PROCESS_START, BUILD_INFO));
});

// Readiness probe (checks dependencies)
app.get('/ready', async (_req, res) => {
  try {
    // Add database connectivity check here if needed
    res.status(200).json({ ready: true });
  } catch (error) {
    res.status(503).json({ ready: false, error: 'Dependencies not ready' });
  }
});

app.use('/api/litho', lithoRouter());
app.use('/api', explorerRouter());

// Metrics server on port 9090
const metricsApp = express();
metricsApp.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

const metricsPort = process.env.METRICS_PORT || 9090;
metricsApp.listen(metricsPort, () => {
  logger.info({ port: metricsPort }, 'metrics_server_listening');
});

async function start() {
  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();
  server.applyMiddleware({ app: app as any, path: '/graphql' });

  // The public edge currently reaches the API for non-API routes.
  // Proxy those GET/HEAD requests to the explorer so makalu.litho.ai still serves the site.
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }

    try {
      await proxyExplorerRequest(req, res);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        {
          err: error,
          module: 'explorer-proxy',
          method: req.method,
          url: req.originalUrl,
        },
        `explorer_proxy_failed: ${message}`,
      );
      const isTimeout = error instanceof Error && error.name === 'TimeoutError';
      res.status(isTimeout ? 504 : 502).json({
        error: 'Explorer unavailable',
        message: isTimeout
          ? 'Explorer frontend timed out.'
          : 'Could not reach the explorer frontend.',
      });
    }
  });

  const port = process.env.API_PORT || 4000;
  app.listen(port, () => logger.info({ port, build: BUILD_INFO }, 'api_listening'));

  // Fire-and-forget: ensure DB performance indexes exist. Non-blocking so the
  // server starts serving immediately while any (one-time) index build runs in
  // the background. Idempotent — a fast no-op once the indexes are present.
  void ensurePerformanceIndexes();
}
start();
