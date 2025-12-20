import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import { z } from 'zod';
import { getConfig, type Config } from './config.js';
import {
  getMetrics,
  getContentType,
  createTimer,
  recordHttpRequest,
  initAppInfo,
  activeConnections,
} from './metrics.js';

/**
 * Health check response schema
 */
const healthResponseSchema = z.object({
  status: z.enum(['healthy', 'unhealthy']),
  timestamp: z.string(),
  uptime: z.number(),
  version: z.string(),
});

type HealthResponse = z.infer<typeof healthResponseSchema>;

/**
 * Readiness check response schema
 */
const readyResponseSchema = z.object({
  status: z.enum(['ready', 'not_ready']),
  timestamp: z.string(),
  checks: z.record(z.enum(['pass', 'fail'])),
});

type ReadyResponse = z.infer<typeof readyResponseSchema>;

/**
 * Application state for readiness checks
 */
interface AppState {
  isReady: boolean;
  startTime: Date;
  dependencies: Map<string, boolean>;
}

const appState: AppState = {
  isReady: false,
  startTime: new Date(),
  dependencies: new Map(),
};

/**
 * Creates and configures the Fastify application
 */
export async function buildApp(): Promise<FastifyInstance> {
  const config = getConfig();

  // Build logger options
  const loggerOptions: Record<string, unknown> = {
    level: config.LOG_LEVEL,
  };

  if (config.LOG_PRETTY) {
    loggerOptions.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    };
  }

  // Create Fastify instance with Pino logger
  const app = Fastify({
    logger: loggerOptions as Parameters<typeof Fastify>[0]['logger'],
    trustProxy: true,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
  });

  // Register plugins
  await app.register(cors, {
    origin: config.NODE_ENV === 'production' ? false : true,
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: config.NODE_ENV === 'production',
  });

  await app.register(sensible);

  // Request metrics hook
  app.addHook('onRequest', async (request: FastifyRequest) => {
    activeConnections.inc();
    (request as unknown as { startTimer: () => number }).startTimer = createTimer();
  });

  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    activeConnections.dec();
    const timer = (request as unknown as { startTimer: () => number }).startTimer;
    if (timer) {
      const duration = timer();
      const route = request.routeOptions?.url ?? request.url;
      recordHttpRequest(
        request.method,
        route,
        reply.statusCode,
        duration,
        Number(request.headers['content-length'] ?? 0),
        Number(reply.getHeader('content-length') ?? 0)
      );
    }
  });

  // Initialize app info metric
  initAppInfo();

  // Register routes
  registerHealthRoutes(app as unknown as FastifyInstance, config);

  return app as unknown as FastifyInstance;
}

/**
 * Register health and observability routes
 */
function registerHealthRoutes(app: FastifyInstance, config: Config): void {
  /**
   * Health check endpoint (Kubernetes liveness probe)
   * Returns 200 if the service is running
   */
  app.get('/health', async (_request, reply): Promise<HealthResponse> => {
    const response: HealthResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: (Date.now() - appState.startTime.getTime()) / 1000,
      version: config.SERVICE_VERSION,
    };

    return reply.status(200).send(response);
  });

  /**
   * Readiness check endpoint (Kubernetes readiness probe)
   * Returns 200 only when the service is ready to accept traffic
   */
  app.get('/ready', async (_request, reply): Promise<ReadyResponse> => {
    const checks: Record<string, 'pass' | 'fail'> = {};

    // Check all dependencies
    for (const [name, status] of appState.dependencies) {
      checks[name] = status ? 'pass' : 'fail';
    }

    const allPassed = Array.from(appState.dependencies.values()).every(Boolean);
    const isReady = appState.isReady && allPassed;

    const response: ReadyResponse = {
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks,
    };

    return reply.status(isReady ? 200 : 503).send(response);
  });

  /**
   * Prometheus metrics endpoint
   * Exposes all metrics in Prometheus format
   */
  app.get('/metrics', async (_request, reply) => {
    if (!config.METRICS_ENABLED) {
      return reply.status(404).send({ error: 'Metrics disabled' });
    }

    const metrics = await getMetrics();
    return reply
      .header('Content-Type', getContentType())
      .status(200)
      .send(metrics);
  });

  /**
   * Service info endpoint
   */
  app.get('/', async (_request, reply) => {
    return reply.send({
      service: config.SERVICE_NAME,
      version: config.SERVICE_VERSION,
      environment: config.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  });
}

/**
 * Set a dependency status for readiness checks
 */
export function setDependencyStatus(name: string, status: boolean): void {
  appState.dependencies.set(name, status);
}

/**
 * Mark the application as ready
 */
export function setReady(ready: boolean): void {
  appState.isReady = ready;
}

/**
 * Get current app state (for testing)
 */
export function getAppState(): Readonly<AppState> {
  return appState;
}

export default { buildApp, setReady, setDependencyStatus, getAppState };
