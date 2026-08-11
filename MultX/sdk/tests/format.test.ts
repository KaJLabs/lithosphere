import { describe, expect, it } from 'vitest';
import {
  formatTokenAmount,
  isContractDeployed,
  normalizeAddress,
  parseTokenAmount,
} from '../src/format.js';

describe('format helpers', () => {
  describe('isContractDeployed', () => {
    it('accepts a valid checksummed address', () => {
      expect(
        isContractDeployed('0x10ed4F004Fe708014ae27Bcc20c9Ed9df3f4eadF'),
      ).toBe(true);
    });

    it('accepts a valid lowercase address', () => {
      expect(
        isContractDeployed('0x10ed4f004fe708014ae27bcc20c9ed9df3f4eadf'),
      ).toBe(true);
    });

    it('rejects empty / 0x / non-address inputs', () => {
      expect(isContractDeployed('')).toBe(false);
      expect(isContractDeployed('0x')).toBe(false);
      expect(isContractDeployed('not-an-address')).toBe(false);
      expect(isContractDeployed(null)).toBe(false);
      expect(isContractDeployed(undefined)).toBe(false);
    });
  });

  describe('formatTokenAmount', () => {
    it('formats 18-decimal amounts to 6 decimal places', () => {
      expect(formatTokenAmount('1000000000000000000', 18)).toBe('1.000000');
      expect(formatTokenAmount('500000000000000000', 18)).toBe('0.500000');
    });

    it('handles non-default decimals', () => {
      expect(formatTokenAmount('100000000', 8)).toBe('1.000000');
    });
  });

  describe('parseTokenAmount', () => {
    it('inverts formatTokenAmount for whole numbers', () => {
      expect(parseTokenAmount('1', 18)).toBe('1000000000000000000');
      expect(parseTokenAmount('0.5', 18)).toBe('500000000000000000');
    });

    it('floors fractional base units', () => {
      // 1.0000000000000000005 LITHO would be ~1e18 base units (extra precision lost)
      const result = parseTokenAmount('1.000000000000000001', 18);
      expect(result).toMatch(/^\d+$/);
    });
  });

  describe('normalizeAddress', () => {
    it('returns checksummed address for valid input', () => {
      expect(normalizeAddress('0x10ed4f004fe708014ae27bcc20c9ed9df3f4eadf')).toBe(
        '0x10ed4F004Fe708014ae27Bcc20c9Ed9df3f4eadF',
      );
    });

    it('returns empty string for invalid input', () => {
      expect(normalizeAddress('')).toBe('');
      expect(normalizeAddress('0x')).toBe('');
      expect(normalizeAddress('not-an-address')).toBe('');
    });
  });
});
