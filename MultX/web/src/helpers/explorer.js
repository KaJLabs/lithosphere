import { bech32 } from 'bech32';
import { ethers } from 'ethers5';
import { CHAIN_CONFIG } from '../config/api';

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short'
});

const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2
});

const ETHERSCAN_SAFE_PREFIXES = [
  CHAIN_CONFIG.bech32Prefix,
  CHAIN_CONFIG.validatorPrefix,
  `${CHAIN_CONFIG.bech32Prefix}valcons`
];

const addThousandsSeparators = (value = '0') => value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const safeBigInt = (value, fallback = 0n) => {
  if (typeof value === 'bigint') {
    return value;
  }

  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  try {
    if (typeof value === 'string' && /^0x[0-9a-f]+$/i.test(value.trim())) {
      return BigInt(value.trim());
    }

    if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
      return BigInt(value.trim());
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return BigInt(Math.trunc(value));
    }
  } catch {
    return fallback;
  }

  return fallback;
};

const getEventAttribute = (events = [], eventType, key) => {
  const target = events.find((event) => event.type === eventType);
  return target?.attributes?.find((attribute) => attribute.key === key)?.value || '';
};

const getLargestEventAmount = (events = [], eventType) => {
  let maxVal = BigInt(-1);
  let maxRaw = '';
  for (const event of events) {
    if (event.type !== eventType) continue;
    for (const attr of (event.attributes || [])) {
      if (attr.key !== 'amount') continue;
      const raw = attr.value || '';
      const digits = raw.match(/^(\d+)/)?.[1];
      if (!digits) continue;
      try {
        const big = BigInt(digits);
        if (big > maxVal) { maxVal = big; maxRaw = raw; }
      } catch { /* ignore */ }
    }
  }
  return maxRaw;
};

const findMessageField = (message = {}, keys = []) => {
  const matchKey = keys.find((key) => message?.[key]);
  return matchKey ? message[matchKey] : '';
};

export const shortenMiddle = (value = '', start = 10, end = 6) => {
  if (!value || value.length <= start + end + 3) {
    return value || '';
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`;
};

export const sanitizeSearchInput = (value = '') => String(value || '').trim();

export const looksLikeTxHash = (value = '') => /^(0x)?[a-fA-F0-9]{64}$/.test(sanitizeSearchInput(value));

export const looksLikeBlockHash = looksLikeTxHash;

export const looksLikeHeight = (value = '') => /^\d+$/.test(sanitizeSearchInput(value));

export const looksLikeHexAddress = (value = '') => /^0x[a-fA-F0-9]{40}$/.test(sanitizeSearchInput(value));

export const looksLikeValidatorOperator = (value = '') =>
  new RegExp(`^${CHAIN_CONFIG.validatorPrefix}1[0-9a-z]{10,}$`, 'i').test(sanitizeSearchInput(value));

export const looksLikeValidatorConsensus = (value = '') =>
  new RegExp(`^${CHAIN_CONFIG.bech32Prefix}valcons1[0-9a-z]{10,}$`, 'i').test(
    sanitizeSearchInput(value)
  );

export const looksLikeBech32Account = (value = '') =>
  new RegExp(`^${CHAIN_CONFIG.bech32Prefix}1[0-9a-z]{10,}$`, 'i').test(sanitizeSearchInput(value));

export const looksLikeAddress = (value = '') =>
  looksLikeHexAddress(value) || looksLikeBech32Account(value);

export const detectAddressType = (value = '') => {
  const input = sanitizeSearchInput(value);

  if (looksLikeHexAddress(input)) {
    return 'EVM';
  }

  if (looksLikeValidatorOperator(input)) {
    return 'VALIDATOR';
  }

  if (looksLikeValidatorConsensus(input)) {
    return 'CONSENSUS';
  }

  if (looksLikeBech32Account(input)) {
    return 'COSMOS';
  }

  return '';
};

export const normalizeTxHash = (value = '') => sanitizeSearchInput(value).replace(/^0x/i, '').toUpperCase();

export const toEvmHash = (value = '') => {
  const hash = normalizeTxHash(value);
  return hash ? `0x${hash.toLowerCase()}` : '';
};

export const toChecksumAddress = (value = '') => {
  const input = sanitizeSearchInput(value);

  if (!looksLikeHexAddress(input)) {
    return '';
  }

  try {
    return ethers.utils.getAddress(input);
  } catch {
    return '';
  }
};

export const toHexAddress = (value = '') => {
  const input = sanitizeSearchInput(value);

  if (!input) {
    return '';
  }

  if (looksLikeHexAddress(input)) {
    return toChecksumAddress(input);
  }

  const detectedType = detectAddressType(input);
  if (!detectedType || detectedType === 'EVM') {
    return '';
  }

  try {
    const decoded = bech32.decode(input.toLowerCase(), 1023);
    const bytes = Uint8Array.from(bech32.fromWords(decoded.words));
    return ethers.utils.getAddress(ethers.utils.hexlify(bytes));
  } catch {
    return '';
  }
};

export const toBech32Address = (value = '', prefix = CHAIN_CONFIG.bech32Prefix) => {
  const hexAddress = toHexAddress(value);

  if (!hexAddress) {
    return '';
  }

  try {
    const bytes = ethers.utils.arrayify(hexAddress);
    return bech32.encode(prefix, bech32.toWords(bytes));
  } catch {
    return '';
  }
};

export const normalizeAddress = (value = '') => {
  const input = sanitizeSearchInput(value);
  const detectedType = detectAddressType(input);

  if (!detectedType) {
    return '';
  }

  if (detectedType === 'EVM') {
    return toChecksumAddress(input);
  }

  return input.toLowerCase();
};

export const isSameAddress = (left = '', right = '') => {
  const leftHex = toHexAddress(left);
  const rightHex = toHexAddress(right);

  if (leftHex && rightHex) {
    return leftHex.toLowerCase() === rightHex.toLowerCase();
  }

  const normalizedLeft = normalizeAddress(left);
  const normalizedRight = normalizeAddress(right);
  return normalizedLeft && normalizedLeft === normalizedRight;
};

export const parseHexNumber = (value = '') => {
  const normalized = String(value || '').trim();

  if (!/^0x[0-9a-f]+$/i.test(normalized)) {
    return 0;
  }

  return Number.parseInt(normalized, 16);
};

export const hexToDecimalString = (value = '') => {
  const normalized = String(value || '').trim();

  if (!/^0x[0-9a-f]+$/i.test(normalized)) {
    return '0';
  }

  try {
    return BigInt(normalized).toString();
  } catch {
    return '0';
  }
};

export const formatNumber = (value) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return '--';
  }

  return numeric.toLocaleString('en-US');
};

export const formatCompactNumber = (value) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return '--';
  }

  return compactNumberFormatter.format(numeric);
};

export const formatPercent = (value, fractionDigits = 2) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return '--';
  }

  return `${numeric.toFixed(fractionDigits)}%`;
};

export const formatTokenAmount = (amount, decimals = CHAIN_CONFIG.decimals, fractionDigits = 4) => {
  if (amount === null || amount === undefined || amount === '') {
    return '--';
  }

  const raw = String(amount).trim();
  const isNegative = raw.startsWith('-');
  const digits = isNegative ? raw.slice(1) : raw;

  if (!/^\d+$/.test(digits)) {
    return '--';
  }

  const padded = digits.padStart(decimals + 1, '0');
  const whole = padded.slice(0, -decimals) || '0';
  const fraction = padded.slice(-decimals).replace(/0+$/, '').slice(0, fractionDigits);

  return `${isNegative ? '-' : ''}${addThousandsSeparators(whole)}${fraction ? `.${fraction}` : ''}`;
};

// Strat formatter: 1 Strat = 100 base units (matches operator/UX convention where the
// chain's "ulitho" base unit is treated as micro-LITHO for fee/gas-price display).
// Verified from on-chain data: fee=147000 base / gas_used=21000 → gas_price=7 → "0.07 Strat".
const BASE_UNITS_PER_STRAT = 100n;

const formatBaseUnitsAsStrat = (raw) => {
  const big = safeBigInt(raw, null);
  if (big === null) return '--';
  const whole = big / BASE_UNITS_PER_STRAT;
  const rem = (big % BASE_UNITS_PER_STRAT).toString().padStart(2, '0').replace(/0+$/, '');
  const wholeStr = addThousandsSeparators(whole.toString());
  return rem ? `${wholeStr}.${rem} Strat` : `${wholeStr} Strat`;
};

export const formatFeeCoin = (coin) => {
  if (!coin) return '--';
  let amount, denom;
  if (typeof coin === 'string') {
    const match = coin.match(/^(\d+)([a-zA-Z].*)?$/);
    if (!match) return coin;
    amount = match[1];
    denom = match[2] || '';
  } else {
    amount = String(coin.amount || '0');
    denom = coin.denom || '';
  }
  if (denom === CHAIN_CONFIG.baseDenom || denom === '') {
    return formatBaseUnitsAsStrat(amount);
  }
  return formatCoin(coin);
};

export const formatGasPrice = (value, unit = 'wei') => {
  const bigIntValue = safeBigInt(value, null);

  if (bigIntValue === null) {
    return '--';
  }

  if (unit === 'strat' || unit === 'fee') {
    return formatBaseUnitsAsStrat(bigIntValue.toString());
  }

  if (unit === 'gwei') {
    return `${formatTokenAmount((bigIntValue / 1_000_000_000n).toString(), 0)} gwei`;
  }

  if (unit === 'litho') {
    return `${formatTokenAmount(bigIntValue.toString(), CHAIN_CONFIG.decimals, 6)} ${CHAIN_CONFIG.denom}`;
  }

  return `${formatNumber(bigIntValue.toString())} wei`;
};

export const formatBytes = (value) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric < 0) {
    return '--';
  }

  if (numeric < 1024) {
    return `${numeric} B`;
  }

  if (numeric < 1024 ** 2) {
    return `${(numeric / 1024).toFixed(2)} KB`;
  }

  if (numeric < 1024 ** 3) {
    return `${(numeric / 1024 ** 2).toFixed(2)} MB`;
  }

  return `${(numeric / 1024 ** 3).toFixed(2)} GB`;
};

export const formatDurationSeconds = (value) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return '--';
  }

  if (numeric < 0.001) {
    return `${Math.round(numeric * 1000)} ms`;
  }

  if (numeric < 60) {
    return `${numeric.toFixed(2)} s`;
  }

  const minutes = Math.floor(numeric / 60);
  const seconds = Math.round(numeric % 60);
  return `${minutes}m ${seconds}s`;
};

export const formatDateTime = (timestamp) => {
  if (!timestamp) {
    return '--';
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return dateTimeFormatter.format(date);
};

export const formatRelativeTime = (timestamp) => {
  if (!timestamp) {
    return '--';
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  const diffInSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  }

  if (diffInSeconds < 3600) {
    return `${Math.floor(diffInSeconds / 60)}m ago`;
  }

  if (diffInSeconds < 86400) {
    return `${Math.floor(diffInSeconds / 3600)}h ago`;
  }

  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

export const mapDenomToSymbol = (denom = '') => {
  if (denom === CHAIN_CONFIG.baseDenom) {
    return CHAIN_CONFIG.denom;
  }

  return denom || '--';
};

export const formatCoin = (coin) => {
  if (!coin) {
    return '--';
  }

  if (Array.isArray(coin)) {
    return coin.map((item) => formatCoin(item)).join(', ');
  }

  if (typeof coin === 'string') {
    if (coin.includes(',')) {
      return coin.split(',').map((c) => formatCoin(c.trim())).join(', ');
    }
    const match = coin.match(/^(\d+)([a-zA-Z].*)$/);
    if (match) {
      return `${formatTokenAmount(match[1])} ${mapDenomToSymbol(match[2])}`;
    }
    return coin;
  }

  if (!coin.amount) {
    return coin.denom || '--';
  }

  return `${formatTokenAmount(coin.amount)} ${mapDenomToSymbol(coin.denom)}`;
};

// Show tiny amounts (< 0.00001 LITHO) in their raw denom rather than rounding to 0
const DISPLAY_THRESHOLD = BigInt(10) ** BigInt(13); // 1e13 ulitho = 0.00001 LITHO

export const formatCoinSmart = (coin) => {
  if (!coin) return '--';

  const raw = typeof coin === 'string' ? coin : null;
  if (!raw) return formatCoin(coin);

  if (raw.includes(',')) {
    return raw.split(',').map((c) => formatCoinSmart(c.trim())).join(', ');
  }

  const match = raw.match(/^(\d+)([a-zA-Z].*)$/);
  if (!match) return formatCoin(raw);

  try {
    const big = BigInt(match[1]);
    if (big < DISPLAY_THRESHOLD) {
      return `${Number(match[1]).toLocaleString()} ${match[2]}`;
    }
  } catch { /* fall through */ }

  return formatCoin(raw);
};

export const getMessageType = (txResponse) => {
  const type = txResponse?.tx?.body?.messages?.[0]?.['@type'];

  if (!type) {
    return 'Transaction';
  }

  const lastSegment = type.split('.').pop() || type;
  return lastSegment.replace(/^Msg/, '') || 'Transaction';
};

export const extractTxParticipants = (txResponse) => {
  const message = txResponse?.tx?.body?.messages?.[0] || {};
  const events = txResponse?.events || [];

  const from =
    findMessageField(message, [
      'from_address',
      'sender',
      'delegator_address',
      'granter',
      'voter',
      'depositor',
      'authority'
    ]) ||
    message.from ||  // MsgEthereumTx top-level from field
    getEventAttribute(events, 'transfer', 'sender') ||
    getEventAttribute(events, 'coin_spent', 'spender') ||
    getEventAttribute(events, 'message', 'sender') ||
    getEventAttribute(events, 'tx', 'fee_payer');

  const to =
    findMessageField(message, ['to_address', 'recipient', 'validator_address', 'withdraw_address']) ||
    message.data?.to ||  // MsgEthereumTx: to is nested under data, not top-level
    getEventAttribute(events, 'transfer', 'recipient') ||
    getEventAttribute(events, 'coin_received', 'receiver') ||
    getEventAttribute(events, 'create_validator', 'validator');

  return { from, to };
};

export const extractTxAmount = (txResponse) => {
  const message = txResponse?.tx?.body?.messages?.[0] || {};
  const events = txResponse?.events || [];

  if (message.amount) {
    return formatCoin(message.amount);
  }

  if (message.value) {
    return formatCoin(message.value);
  }

  const eventAmount =
    getLargestEventAmount(events, 'transfer') ||
    getLargestEventAmount(events, 'coin_received') ||
    getEventAttribute(events, 'create_validator', 'amount');

  return eventAmount ? formatCoin(eventAmount) : '--';
};

export const extractFee = (txResponse) => {
  const fee = txResponse?.tx?.auth_info?.fee?.amount || txResponse?.tx?.auth_info?.fee?.amounts;

  if (Array.isArray(fee) && fee.length > 0) {
    return fee.map((coin) => formatFeeCoin(coin)).join(', ');
  }

  const eventFee = getEventAttribute(txResponse?.events || [], 'tx', 'fee');
  if (eventFee) return formatFeeCoin(eventFee);
  return '--';
};

export const safeJsonParse = (value, fallback = null) => {
  if (!value || typeof value !== 'string') {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const computeTxHash = async (base64Tx) => {
  if (!base64Tx || !globalThis.crypto?.subtle) {
    return '';
  }

  const binary = atob(base64Tx);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer), (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
};

export const isSupportedBech32Prefix = (value = '') =>
  ETHERSCAN_SAFE_PREFIXES.some((prefix) =>
    new RegExp(`^${prefix}1[0-9a-z]{10,}$`, 'i').test(sanitizeSearchInput(value))
  );
