import {
  Counter,
  Histogram,
  Gauge,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

import { getConfig } from './config.js';


/**
 * Prometheus Metrics Module
 * Provides structured metrics for observability
 */

// Create a custom registry
export const registry = new Registry();

// Set default labels for all metrics
registry.setDefaultLabels({
  app: 'lithosphere-service',
});

// Collect default Node.js metrics (CPU, memory, event loop, etc.)
collectDefaultMetrics({ register: registry });

/*//////////////////////////////////////////////////////////////
                        HTTP METRICS
//////////////////////////////////////////////////////////////*/

/**
 * HTTP request counter
 * Labels: method, route, status_code
 */
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [registry],
});

/**
 * HTTP request duration histogram
 * Labels: method, route, status_code
 */
export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

/**
 * HTTP request size histogram
 */
export const httpRequestSizeBytes = new Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'] as const,
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [registry],
});

/**
 * HTTP response size histogram
 */
export const httpResponseSizeBytes = new Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route'] as const,
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [registry],
});

/*//////////////////////////////////////////////////////////////
                      APPLICATION METRICS
//////////////////////////////////////////////////////////////*/

/**
 * Active connections gauge
 */
export const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  registers: [registry],
});

/**
 * Application info gauge (for version tracking)
 */
export const appInfo = new Gauge({
  name: 'app_info',
  help: 'Application information',
  labelNames: ['version', 'node_env'] as const,
  registers: [registry],
});

/*//////////////////////////////////////////////////////////////
                       BUSINESS METRICS
//////////////////////////////////////////////////////////////*/

/**
 * Custom business operation counter
 * Use this pattern for your domain-specific metrics
 */
export const businessOperationsTotal = new Counter({
  name: 'business_operations_total',
  help: 'Total number of business operations',
  labelNames: ['operation', 'status'] as const,
  registers: [registry],
});

/**
 * External service call duration
 */
export const externalServiceDuration = new Histogram({
  name: 'external_service_duration_seconds',
  help: 'Duration of external service calls',
  labelNames: ['service', 'operation'] as const,
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [registry],
});

/*//////////////////////////////////////////////////////////////
                         HELPER FUNCTIONS
//////////////////////////////////////////////////////////////*/

/**
 * Records HTTP request metrics
 */
export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  durationSeconds: number,
  requestSize: number,
  responseSize: number
): void {
  httpRequestsTotal.inc({ method, route, status_code: statusCode.toString() });
  httpRequestDurationSeconds.observe(
    { method, route, status_code: statusCode.toString() },
    durationSeconds
  );
  httpRequestSizeBytes.observe({ method, route }, requestSize);
  httpResponseSizeBytes.observe({ method, route }, responseSize);
}

/**
 * Records a business operation metric
 */
export function recordBusinessOperation(
  operation: string,
  status: 'success' | 'error'
): void {
  businessOperationsTotal.inc({ operation, status });
}

/**
 * Timer helper for measuring durations
 */
export function createTimer(): () => number {
  const start = process.hrtime.bigint();
  return () => {
    const end = process.hrtime.bigint();
    return Number(end - start) / 1e9; // Convert to seconds
  };
}

/**
 * Initialize application info metric
 */
export function initAppInfo(): void {
  const config = getConfig();
  appInfo.set(
    {
      version: config.SERVICE_VERSION,
      node_env: config.NODE_ENV,
    },
    1
  );
}

/**
 * Get metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return registry.metrics();
}

/**
 * Get content type for metrics endpoint
 */
export function getContentType(): string {
  return registry.contentType;
}

export default {
  registry,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  activeConnections,
  appInfo,
  businessOperationsTotal,
  recordHttpRequest,
  recordBusinessOperation,
  createTimer,
  initAppInfo,
  getMetrics,
  getContentType,
};
