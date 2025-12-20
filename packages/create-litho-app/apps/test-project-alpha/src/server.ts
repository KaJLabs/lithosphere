import { loadConfig } from './config.js';
import { buildApp, setReady } from './app.js';

/**
 * Lithosphere Service Entry Point
 *
 * This module handles:
 * - Configuration loading and validation
 * - Application initialization
 * - Graceful startup and shutdown
 * - Signal handling (SIGTERM, SIGINT)
 */

async function main(): Promise<void> {
  // Load and validate configuration first
  const config = loadConfig();

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           Lithosphere Service Starting                     ║
╠═══════════════════════════════════════════════════════════╣
║  Service: ${config.SERVICE_NAME.padEnd(46)}║
║  Version: ${config.SERVICE_VERSION.padEnd(46)}║
║  Environment: ${config.NODE_ENV.padEnd(42)}║
╚═══════════════════════════════════════════════════════════╝
`);

  // Build the Fastify application
  const app = await buildApp();

  // Graceful shutdown handler
  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`Received ${signal}, starting graceful shutdown...`);

    // Mark as not ready for Kubernetes
    setReady(false);

    // Give time for load balancer to stop sending traffic
    await new Promise((resolve) => setTimeout(resolve, 5000));

    try {
      // Close the server
      await app.close();
      app.log.info('Server closed successfully');
      process.exit(0);
    } catch (error) {
      app.log.error(error, 'Error during shutdown');
      process.exit(1);
    }
  };

  // Register signal handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    app.log.fatal(error, 'Uncaught exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    app.log.fatal({ reason }, 'Unhandled rejection');
    process.exit(1);
  });

  try {
    // Start the server
    await app.listen({
      host: config.HOST,
      port: config.PORT,
    });

    app.log.info(`Server listening on http://${config.HOST}:${config.PORT}`);
    app.log.info(`Health check: http://${config.HOST}:${config.PORT}/health`);
    app.log.info(`Readiness check: http://${config.HOST}:${config.PORT}/ready`);
    app.log.info(`Metrics: http://${config.HOST}:${config.PORT}/metrics`);

    // Mark service as ready
    setReady(true);
    app.log.info('Service is ready to accept traffic');
  } catch (error) {
    app.log.fatal(error, 'Failed to start server');
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  console.error('Fatal error during startup:', error);
  process.exit(1);
});
