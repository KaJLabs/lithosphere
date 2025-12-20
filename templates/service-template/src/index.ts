/**
 * Lithosphere Service Template
 *
 * A minimal Express.js service template for building blockchain microservices.
 * This template provides:
 * - Health check endpoint
 * - Graceful shutdown handling
 * - Docker-optimized configuration
 */

import express, { Application, Request, Response, NextFunction } from 'express';

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─────────────────────────────────────────────────────────────
// Health Check Endpoint
// Used by Docker HEALTHCHECK and Kubernetes probes
// ─────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'lithosphere-service-template',
    version: process.env.npm_package_version || '0.1.0',
  });
});

// ─────────────────────────────────────────────────────────────
// Readiness Check Endpoint
// Indicates if service is ready to accept traffic
// ─────────────────────────────────────────────────────────────
app.get('/ready', (_req: Request, res: Response) => {
  // Add any dependency checks here (database, cache, etc.)
  res.status(200).json({
    ready: true,
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────
// Root Endpoint
// ─────────────────────────────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Lithosphere Service Template',
    version: process.env.npm_package_version || '0.1.0',
    description: 'A starting point for building blockchain microservices',
    endpoints: {
      health: '/health',
      ready: '/ready',
    },
  });
});

// ─────────────────────────────────────────────────────────────
// 404 Handler
// ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource does not exist',
  });
});

// ─────────────────────────────────────────────────────────────
// Error Handler
// ─────────────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message,
  });
});

// ─────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`🚀 Lithosphere Service Template running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
});

// ─────────────────────────────────────────────────────────────
// Graceful Shutdown
// ─────────────────────────────────────────────────────────────
const shutdown = (signal: string) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
