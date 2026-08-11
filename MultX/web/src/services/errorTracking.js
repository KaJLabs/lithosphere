import * as Sentry from '@sentry/browser';
import { CHAIN_CONFIG } from '../config/api';

const DEFAULT_ALLOWED_HOSTS = ['localhost', '127.0.0.1'];
const IGNORED_ERROR_MESSAGE =
  /script error\.?|non-error promise rejection captured|extension context invalidated|chrome-extension:|moz-extension:|safari-web-extension:/i;

let initialized = false;
let configWarningsLogged = false;
let cachedRuntimeConfig = null;

const normalizeBoolean = (value) =>
  ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());

const normalizeList = (value = '') =>
  String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseHostname = (value = '') => {
  try {
    return new URL(String(value).trim()).host;
  } catch {
    return '';
  }
};

const normalizeSampleRate = (value, fallback = 0) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, numeric));
};

const isValidSentryDsn = (dsn = '') => {
  try {
    const parsed = new URL(String(dsn || '').trim());
    const pathSegments = parsed.pathname.split('/').filter(Boolean);

    return ['http:', 'https:'].includes(parsed.protocol) && Boolean(parsed.host) && pathSegments.length > 0;
  } catch {
    return false;
  }
};

const resolveAllowedHosts = (env = import.meta.env) => {
  const configuredHosts = normalizeList(env?.VITE_SENTRY_ALLOWED_HOSTS);
  const defaultHosts = [
    ...DEFAULT_ALLOWED_HOSTS,
    parseHostname(env?.VITE_EXPLORER_URL),
    typeof window !== 'undefined' ? window.location.host : ''
  ];

  return [...new Set([...configuredHosts, ...defaultHosts].filter(Boolean))];
};

const buildAllowUrlPatterns = (hosts = []) =>
  hosts.map((host) => new RegExp(`^https?:\\/\\/(?:[^/]+\\.)?${escapeRegExp(host)}(?:[/:]|$)`, 'i'));

const getErrorMessage = (value) =>
  [value?.message, value?.cause?.message, value?.reason?.message]
    .filter(Boolean)
    .join(' ')
    .trim();

const shouldIgnoreError = (value) => {
  const message = getErrorMessage(value);
  return IGNORED_ERROR_MESSAGE.test(message);
};

export const resolveErrorTrackingConfig = (env = import.meta.env) => {
  const dsn = String(env?.VITE_SENTRY_DSN || '').trim();
  const appEnv = String(env?.VITE_APP_ENV || env?.MODE || 'development').trim() || 'development';
  const release = String(env?.VITE_APP_VERSION || env?.VITE_SENTRY_RELEASE || '').trim();
  const debug = normalizeBoolean(env?.VITE_SENTRY_DEBUG);
  const tracesSampleRate = normalizeSampleRate(env?.VITE_SENTRY_TRACES_SAMPLE_RATE, 0);
  const allowedHosts = resolveAllowedHosts(env);
  const allowUrls = buildAllowUrlPatterns(allowedHosts);
  const warnings = [];
  const dsnValid = Boolean(dsn) && isValidSentryDsn(dsn);

  if (!dsn) {
    warnings.push('VITE_SENTRY_DSN is not configured.');
  } else if (!dsnValid) {
    warnings.push('VITE_SENTRY_DSN is invalid and Sentry will remain disabled.');
  }

  if (!release && appEnv !== 'development') {
    warnings.push('VITE_APP_VERSION or VITE_SENTRY_RELEASE is not configured.');
  }

  if (!allowedHosts.length) {
    warnings.push('No Sentry allowlist hosts were resolved from the current environment.');
  }

  return {
    dsn,
    dsnValid,
    enabled: dsnValid,
    configured: Boolean(dsn),
    appEnv,
    release,
    debug,
    tracesSampleRate,
    allowedHosts,
    allowUrls,
    warnings
  };
};

const getRuntimeErrorTrackingConfig = () => {
  if (!cachedRuntimeConfig) {
    cachedRuntimeConfig = resolveErrorTrackingConfig(import.meta.env);
  }

  return cachedRuntimeConfig;
};

const logConfigWarnings = (config) => {
  if (configWarningsLogged || !config.warnings.length) {
    return;
  }

  configWarningsLogged = true;

  if (import.meta.env.DEV || config.appEnv !== 'production') {
    console.warn('[errorTracking]', config.warnings.join(' '));
  }
};

export const getErrorTrackingStatus = () => {
  const config = getRuntimeErrorTrackingConfig();

  return {
    enabled: config.enabled,
    configured: config.configured,
    appEnv: config.appEnv,
    release: config.release,
    warnings: [...config.warnings]
  };
};

export const initErrorTracking = (configOverride = null, sentryImpl = Sentry) => {
  const config = configOverride || getRuntimeErrorTrackingConfig();

  if (initialized) {
    return config;
  }

  initialized = true;

  if (!config.enabled) {
    logConfigWarnings(config);
    return config;
  }

  sentryImpl.init({
    dsn: config.dsn,
    enabled: true,
    environment: config.appEnv,
    release: config.release || undefined,
    tracesSampleRate: config.tracesSampleRate,
    debug: config.debug,
    integrations: [],
    allowUrls: config.allowUrls,
    beforeSend(event, hint) {
      if (shouldIgnoreError(hint?.originalException)) {
        return null;
      }

      return event;
    },
    initialScope: {
      tags: {
        app: 'kamet-explorer',
        chain_id: CHAIN_CONFIG.chainId,
        evm_chain_id: String(CHAIN_CONFIG.evmChainId)
      }
    }
  });

  logConfigWarnings(config);
  return config;
};

export const captureExplorerError = (error, context = {}) => {
  const config = getRuntimeErrorTrackingConfig();

  if (config.enabled) {
    Sentry.captureException(error, {
      extra: context
    });
    return;
  }

  if (import.meta.env.DEV) {
    console.error('[explorer]', error, context);
  }
};

export const captureExplorerMessage = (message, context = {}) => {
  const config = getRuntimeErrorTrackingConfig();

  if (config.enabled) {
    Sentry.captureMessage(message, {
      level: 'info',
      extra: context
    });
    return;
  }

  if (import.meta.env.DEV) {
    console.info('[explorer]', message, context);
  }
};

export const resetErrorTrackingForTests = () => {
  initialized = false;
  configWarningsLogged = false;
  cachedRuntimeConfig = null;
};
