import { z } from 'zod';

/**
 * Environment configuration schema using Zod
 * Validates all required environment variables at startup
 */
const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),

  // Metrics Configuration
  METRICS_PORT: z.coerce.number().int().min(1).max(65535).default(9090),
  METRICS_ENABLED: z.coerce.boolean().default(true),

  // Logging Configuration
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(false),

  // Service Identification
  SERVICE_NAME: z.string().default('lithosphere-service'),
  SERVICE_VERSION: z.string().default('0.1.0'),

  // Database (optional, for future use)
  DATABASE_URL: z.string().url().optional(),

  // External Services (optional)
  RPC_URL: z.string().url().optional(),

  // Graceful Shutdown
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(0).default(30000),
});

/**
 * Inferred TypeScript type from the Zod schema
 */
export type Config = z.infer<typeof envSchema>;

/**
 * Validated configuration object
 * Throws ZodError if validation fails
 */
let config: Config;

/**
 * Loads and validates environment configuration
 * Should be called once at application startup
 */
export function loadConfig(): Config {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment configuration:');
    console.error(result.error.format());
    process.exit(1);
  }

  config = result.data;
  return config;
}

/**
 * Gets the validated configuration
 * Throws if loadConfig() hasn't been called
 */
export function getConfig(): Config {
  if (!config) {
    throw new Error('Configuration not loaded. Call loadConfig() first.');
  }
  return config;
}

/**
 * Type-safe environment check helpers
 */
export const isDevelopment = (): boolean => getConfig().NODE_ENV === 'development';
export const isStaging = (): boolean => getConfig().NODE_ENV === 'staging';
export const isProduction = (): boolean => getConfig().NODE_ENV === 'production';

export default { loadConfig, getConfig, isDevelopment, isStaging, isProduction };
