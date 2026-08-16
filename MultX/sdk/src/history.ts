/**
 * Pure helpers for displaying bridge transaction history. Framework-agnostic.
 */

const TX_HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/**
 * Strip a trailing `/bridge` segment and any trailing slashes. Used so callers
 * can pass either `https://bridge.litho.ai` or `https://bridge.litho.ai/bridge/`
 * and get a consistent base URL.
 */
export const normalizeBridgeApiBaseUrl = (value: string = ''): string => {
  const trimmed = String(value ?? '').trim().replace(/\/+$/, '');
  return trimmed.replace(/\/bridge$/i, '');
};

/** True iff `value` is a 32-byte hex transaction hash (`0x` + 64 hex chars). */
export const isBridgeTxHash = (value: string = ''): boolean =>
  TX_HASH_PATTERN.test(String(value ?? '').trim());

/**
 * Truncate a hash like `0x1234...abcd` for compact UI display. When the input
 * is shorter than `start + end + 3` (the ellipsis), it is returned unchanged.
 */
export const shortenBridgeTxHash = (
  value: string = '',
  start = 8,
  end = 6,
): string => {
  const input = String(value ?? '').trim();
  if (!input || input.length <= start + end + 3) {
    return input || '';
  }
  return `${input.slice(0, start)}...${input.slice(-end)}`;
};

export interface SplitTimestamp {
  primary: string;
  secondary: string;
}

/**
 * Split an ISO-8601 timestamp into two human-readable lines (date + time).
 *
 * - empty/falsy input → `{ primary: '--', secondary: '' }`
 * - unparseable input → `{ primary: <raw>, secondary: '' }`
 * - valid input → `{ primary: 'Apr 17, 2026', secondary: '10:03 AM' }`
 */
export const splitBridgeHistoryTimestamp = (value: unknown): SplitTimestamp => {
  if (!value) {
    return { primary: '--', secondary: '' };
  }

  const parsed = new Date(value as string | number | Date);
  if (Number.isNaN(parsed.getTime())) {
    return { primary: String(value), secondary: '' };
  }

  const formatted = dateTimeFormatter.format(parsed);
  const [primary = '', ...rest] = formatted.split(', ');

  return {
    primary,
    secondary: rest.join(', '),
  };
};
