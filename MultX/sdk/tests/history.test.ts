/**
 * Ported from kamet-explorer/src/test/helpers/bridgeHistory.test.js.
 * Fixture inlined to keep the package self-contained.
 */
import { describe, expect, it } from 'vitest';
import {
  isBridgeTxHash,
  normalizeBridgeApiBaseUrl,
  shortenBridgeTxHash,
  splitBridgeHistoryTimestamp,
} from '../src/history.js';

const evmTxHash =
  '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

describe('bridgeHistory helpers', () => {
  it('normalizes the bridge API base url', () => {
    expect(normalizeBridgeApiBaseUrl('https://bridge.litho.ai/bridge/')).toBe(
      'https://bridge.litho.ai',
    );
    expect(normalizeBridgeApiBaseUrl(' https://bridge.litho.ai ')).toBe(
      'https://bridge.litho.ai',
    );
  });

  it('strips trailing slashes only (no double-strip)', () => {
    expect(normalizeBridgeApiBaseUrl('https://bridge.litho.ai///')).toBe(
      'https://bridge.litho.ai',
    );
  });

  it('returns empty string for empty input', () => {
    expect(normalizeBridgeApiBaseUrl('')).toBe('');
    expect(normalizeBridgeApiBaseUrl(undefined as unknown as string)).toBe('');
  });

  it('recognizes valid bridge tx hashes', () => {
    expect(isBridgeTxHash(evmTxHash)).toBe(true);
  });

  it('rejects malformed bridge tx hashes', () => {
    expect(isBridgeTxHash('0x1234')).toBe(false);
    expect(isBridgeTxHash('')).toBe(false);
    expect(isBridgeTxHash('not-a-hash')).toBe(false);
    expect(isBridgeTxHash(`${evmTxHash}ff`)).toBe(false); // too long
  });

  it('shortens hashes safely', () => {
    expect(shortenBridgeTxHash(evmTxHash, 6, 4)).toBe(
      `${evmTxHash.slice(0, 6)}...${evmTxHash.slice(-4)}`,
    );
    // Short input passed through unchanged
    expect(shortenBridgeTxHash('0xabc', 6, 4)).toBe('0xabc');
    // Empty input → empty string
    expect(shortenBridgeTxHash('')).toBe('');
  });

  it('splits timestamps into readable primary and secondary parts', () => {
    const { primary, secondary } = splitBridgeHistoryTimestamp(
      '2026-04-17T10:03:34.041Z',
    );
    expect(primary).toContain('Apr');
    expect(secondary).not.toBe('');
  });

  it('handles empty timestamps', () => {
    expect(splitBridgeHistoryTimestamp('')).toEqual({ primary: '--', secondary: '' });
    expect(splitBridgeHistoryTimestamp(null)).toEqual({ primary: '--', secondary: '' });
  });

  it('returns raw value for unparseable timestamp', () => {
    const result = splitBridgeHistoryTimestamp('not-a-date');
    expect(result.primary).toBe('not-a-date');
    expect(result.secondary).toBe('');
  });
});
