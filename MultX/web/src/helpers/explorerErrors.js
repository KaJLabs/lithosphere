import axios from 'axios';
import { CHAIN_CONFIG } from '../config/api';
import {
  looksLikeAddress,
  looksLikeBlockHash,
  looksLikeHeight,
  looksLikeHexAddress,
  looksLikeTxHash,
  looksLikeValidatorConsensus,
  looksLikeValidatorOperator,
  sanitizeSearchInput
} from './explorer';

const RESOURCE_FALLBACK = 'resource';
const INVALID_INPUT_STATUS_CODES = new Set([400, 422]);
const TIMEOUT_STATUS_CODES = new Set([408, 504, 522, 524]);
const UNAVAILABLE_STATUS_CODES = new Set([429, 500, 502, 503, 520, 521, 523, 525]);
const REACHABILITY_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ERR_NETWORK',
  'ERR_INTERNET_DISCONNECTED',
  'ERR_CONNECTION_REFUSED',
  'ERR_NAME_NOT_RESOLVED'
]);
const REACHABILITY_MESSAGE = /network error|failed to fetch|load failed|connection refused|name not resolved|network request failed|socket hang up|dns|offline|refused to connect|could not reach/i;
const INVALID_INPUT_MESSAGE =
  /invalid (address|hash|height|argument|input|request|bech32|hex|query|parameter|checksum)|malformed|failed to decode|decode error|incorrect data length|non-hexadecimal|missing 0x prefix|invalid length|unable to decode|could not parse|parse error|hex string has length/i;
const RATE_LIMIT_MESSAGE = /rate limit|too many requests|quota exceeded/i;
const NOT_FOUND_MESSAGE = /not found|does not exist|unknown resource|resource missing/i;
const UNSUPPORTED_OBJECT_MESSAGE =
  /unsupported object type|not directly supported|consensus addresses are not directly browsable|unsupported validator/i;

const defaultMessages = {
  invalid_input: {
    title: 'Bad input format',
    message: 'Check the value and retry with a supported block, transaction, address, validator, token, or contract identifier.',
    retryable: false
  },
  not_found: {
    title: 'Resource not found',
    message: 'The requested object did not resolve on the current Kamet public endpoints.',
    retryable: false
  },
  timeout: {
    title: 'Request timed out',
    message: 'The request timed out before the explorer received a response. Retry in a moment.',
    retryable: true
  },
  indexer_unavailable: {
    title: 'Indexer unavailable',
    message: 'Explorer data is temporarily unavailable. The indexer or public API may be delayed.',
    retryable: true
  },
  unsupported_object_type: {
    title: 'Unsupported object type',
    message: 'The requested object type is not directly supported by the current public explorer APIs.',
    retryable: false
  },
  generic: {
    title: 'Unable to load data',
    message: 'The explorer could not load this data right now. Retry in a moment.',
    retryable: true
  }
};

const startsWithInsensitive = (value, prefix) =>
  String(value || '').toLowerCase().startsWith(String(prefix || '').toLowerCase());

const normalizeResourceLabel = (resourceLabel = RESOURCE_FALLBACK) =>
  String(resourceLabel || RESOURCE_FALLBACK).trim().toLowerCase();

const getErrorMessage = (error) =>
  [error?.message, error?.cause?.message, error?.response?.data?.message, error?.response?.data?.error]
    .filter(Boolean)
    .join(' ')
    .trim();

const getStructuredErrorHints = (error) => {
  const data = error?.response?.data;
  const details = Array.isArray(data?.details) ? data.details : [];

  return [
    data?.kind,
    data?.code,
    data?.type,
    data?.reason,
    data?.status,
    data?.error?.code,
    data?.error?.type,
    data?.error?.reason,
    ...details.flatMap((detail) => [detail?.kind, detail?.code, detail?.type, detail?.reason, detail?.message])
  ]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join(' ');
};

const isReachabilityError = (error, message = '') => {
  const code = String(error?.code || '').trim().toUpperCase();

  return (
    REACHABILITY_ERROR_CODES.has(code) ||
    REACHABILITY_MESSAGE.test(message) ||
    globalThis.navigator?.onLine === false
  );
};

const isInvalidInputError = (error, message = '', statusCode = null) =>
  INVALID_INPUT_STATUS_CODES.has(statusCode) ||
  (String(error?.code || '').trim().toUpperCase() === 'ERR_BAD_REQUEST' &&
    INVALID_INPUT_MESSAGE.test(message)) ||
  INVALID_INPUT_MESSAGE.test(message);

export const createExplorerError = (kind = 'generic', overrides = {}) => {
  const defaults = defaultMessages[kind] || defaultMessages.generic;

  return {
    kind,
    title: overrides.title || defaults.title,
    message: overrides.message || defaults.message,
    retryable: overrides.retryable ?? defaults.retryable,
    statusCode: overrides.statusCode ?? null
  };
};

export const createNotFoundError = (resourceLabel = RESOURCE_FALLBACK, message = '') =>
  createExplorerError('not_found', {
    title: `${String(resourceLabel || RESOURCE_FALLBACK).trim()} not found`,
    message:
      message ||
      `The requested ${normalizeResourceLabel(resourceLabel)} did not resolve on the current Kamet public endpoints.`
  });

export const classifyExplorerError = (error, { resourceLabel = RESOURCE_FALLBACK } = {}) => {
  if (error?.kind) {
    return error;
  }

  const statusCode = error?.response?.status || error?.status || null;
  const message = getErrorMessage(error);
  const structuredHints = getStructuredErrorHints(error);
  const resource = normalizeResourceLabel(resourceLabel);

  if (
    ['invalid_input', 'not_found', 'timeout', 'indexer_unavailable', 'unsupported_object_type', 'generic'].includes(
      String(error?.response?.data?.kind || '').trim()
    )
  ) {
    return createExplorerError(error.response.data.kind, {
      statusCode,
      message: error.response.data.message || error.response.data.error || undefined,
      title: error.response.data.title || undefined
    });
  }

  if (statusCode === 404 || NOT_FOUND_MESSAGE.test(`${message} ${structuredHints}`)) {
    return createNotFoundError(resourceLabel);
  }

  if (statusCode === 501 || UNSUPPORTED_OBJECT_MESSAGE.test(`${message} ${structuredHints}`)) {
    return createExplorerError('unsupported_object_type', {
      message: `The current public APIs do not support this ${resource} object type.`,
      statusCode
    });
  }

  if (isInvalidInputError(error, `${message} ${structuredHints}`, statusCode)) {
    return createExplorerError('invalid_input', {
      message:
        message ||
        `The public ${resource} endpoint rejected the requested identifier. Check the format and retry.`,
      statusCode
    });
  }

  const errorName = String(error?.name || '').trim();

  if (
    error?.code === 'ECONNABORTED' ||
    errorName === 'AbortError' ||
    errorName === 'TimeoutError' ||
    TIMEOUT_STATUS_CODES.has(statusCode) ||
    /timeout|timed out|deadline exceeded/i.test(`${message} ${structuredHints}`)
  ) {
    return createExplorerError('timeout', {
      message: `The ${resource} request timed out before the explorer received a response. Retry in a moment.`,
      statusCode
    });
  }

  if (statusCode === 429 || RATE_LIMIT_MESSAGE.test(`${message} ${structuredHints}`)) {
    return createExplorerError('indexer_unavailable', {
      title: 'Rate limited',
      message: `The public ${resource} endpoint is rate-limiting explorer requests. Retry in a moment.`,
      statusCode
    });
  }

  if (
    UNAVAILABLE_STATUS_CODES.has(statusCode) ||
    /indexer|temporarily degraded|temporarily unavailable|service unavailable|gateway|maintenance/i.test(
      `${message} ${structuredHints}`
    )
  ) {
    return createExplorerError('indexer_unavailable', {
      message: `The ${resource} data is temporarily unavailable. The network or indexer may be delayed.`,
      statusCode
    });
  }

  if (
    (axios.isAxiosError(error) && !error.response) ||
    errorName === 'NetworkError' ||
    isReachabilityError(error, message)
  ) {
    return createExplorerError('indexer_unavailable', {
      message: `The explorer could not reach the public ${resource} endpoint. The network, API, or indexer may be unavailable.`,
      statusCode
    });
  }

  return createExplorerError('generic', {
    message: message || `The explorer could not load ${resource} data right now. Retry in a moment.`,
    statusCode
  });
};

export const detectMalformedSearchInput = (value = '') => {
  const input = sanitizeSearchInput(value);

  if (!input) {
    return null;
  }

  if (startsWithInsensitive(input, '0x') && !looksLikeHexAddress(input) && !looksLikeTxHash(input)) {
    return createExplorerError('invalid_input', {
      title: 'Bad hash or address format',
      message: '0x identifiers must be a full transaction hash or a 20-byte address.'
    });
  }

  if (
    startsWithInsensitive(input, `${CHAIN_CONFIG.bech32Prefix}valcons1`) &&
    looksLikeValidatorConsensus(input)
  ) {
    return createExplorerError('unsupported_object_type', {
      message: 'Validator consensus addresses are not directly browsable yet. Use a validator operator address instead.'
    });
  }

  if (
    startsWithInsensitive(input, `${CHAIN_CONFIG.validatorPrefix}1`) &&
    !looksLikeValidatorOperator(input)
  ) {
    return createExplorerError('invalid_input', {
      title: 'Bad validator address format',
      message: 'Use a full validator operator address to open validator detail pages.'
    });
  }

  if (startsWithInsensitive(input, `${CHAIN_CONFIG.bech32Prefix}1`) && !looksLikeAddress(input)) {
    return createExplorerError('invalid_input', {
      title: 'Bad address format',
      message: `Use a full ${CHAIN_CONFIG.bech32Prefix}1... or 0x... address.`
    });
  }

  return null;
};

export const validateBlockRouteParam = (value = '') =>
  looksLikeHeight(value) || looksLikeBlockHash(value)
    ? null
    : createExplorerError('invalid_input', {
        title: 'Bad block identifier',
        message: 'Use a numeric block height or a full block hash in the URL.'
      });

export const validateTransactionRouteParam = (value = '') =>
  looksLikeTxHash(value)
    ? null
    : createExplorerError('invalid_input', {
        title: 'Bad transaction hash',
        message: 'Use a full transaction hash in the URL.'
      });

export const validateAddressRouteParam = (value = '') =>
  looksLikeAddress(value)
    ? null
    : createExplorerError('invalid_input', {
        title: 'Bad address format',
        message: `Use a full ${CHAIN_CONFIG.bech32Prefix}1... or 0x... address in the URL.`
      });

export const validateTokenRouteParam = (value = '') =>
  sanitizeSearchInput(value).toLowerCase() === 'native' || looksLikeHexAddress(value)
    ? null
    : createExplorerError('invalid_input', {
        title: 'Bad token identifier',
        message: 'Use `native` or a 0x token contract address in the URL.'
      });

export const validateValidatorRouteParam = (value = '') => {
  if (looksLikeValidatorConsensus(value)) {
    return createExplorerError('unsupported_object_type', {
      message: 'Validator consensus addresses are not directly browsable yet. Use a validator operator address instead.'
    });
  }

  return looksLikeValidatorOperator(value)
    ? null
    : createExplorerError('invalid_input', {
        title: 'Bad validator identifier',
        message: 'Use a validator operator address in the URL.'
      });
};

export const validateContractRouteParam = (value = '') =>
  looksLikeHexAddress(value)
    ? null
    : createExplorerError('invalid_input', {
        title: 'Bad contract address',
        message: 'Use a 0x contract address in the URL.'
      });
