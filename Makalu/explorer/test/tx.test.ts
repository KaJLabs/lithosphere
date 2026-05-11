import { describe, expect, it } from 'vitest';
import {
  getPreferredTxHash,
  isCosmosTxHash,
  isEvmTxHash,
  isValidTransactionHash,
  normalizeEvmTxHash,
} from '../lib/tx';

const cosmosLike = '005689E58968B21A95D2D115B87482E7AD104D9B636AD38C1DAA9985C6A95E02';
const evm0x = '0xf3df3dce8dce77d8b1172dc9d191e11caed85563f5b5a323f6ea4a18ab97077f';
const evmBare = 'f3df3dce8dce77d8b1172dc9d191e11caed85563f5b5a323f6ea4a18ab97077f';

describe('isCosmosTxHash', () => {
  it('accepts 64-char hex (uppercase or lowercase)', () => {
    expect(isCosmosTxHash(cosmosLike)).toBe(true);
    expect(isCosmosTxHash(cosmosLike.toLowerCase())).toBe(true);
  });

  it('rejects 0x-prefixed strings (those are EVM)', () => {
    // Note: the regex allows it, but the original Cosmos format is no-0x.
    // The regex literally matches the 64 chars only, so 0x-prefixed fails the length check.
    expect(isCosmosTxHash(evm0x)).toBe(false);
  });

  it('rejects strings of the wrong length', () => {
    expect(isCosmosTxHash('abc')).toBe(false);
    expect(isCosmosTxHash('')).toBe(false);
    expect(isCosmosTxHash(null)).toBe(false);
  });
});

describe('isEvmTxHash', () => {
  it('accepts 0x-prefixed 64-char hex', () => {
    expect(isEvmTxHash(evm0x)).toBe(true);
  });

  it('rejects bare hex (without 0x)', () => {
    expect(isEvmTxHash(evmBare)).toBe(false);
  });

  it('rejects malformed', () => {
    expect(isEvmTxHash('0x123')).toBe(false);
    expect(isEvmTxHash(null)).toBe(false);
  });
});

describe('normalizeEvmTxHash', () => {
  it('lowercases mixed-case hex while preserving the (literal-lowercase) 0x prefix', () => {
    // Note: the implementation accepts only lowercase `0x` (regex is /^0x[a-fA-F0-9]{64}$/).
    // Uppercase `0X...` falls through to null. So we test mixed-case AFTER the 0x.
    const mixedAfterPrefix = '0x' + evmBare.toUpperCase();
    expect(normalizeEvmTxHash(mixedAfterPrefix)).toBe(evm0x);
  });

  it('adds 0x prefix to bare hex', () => {
    expect(normalizeEvmTxHash(evmBare)).toBe(evm0x);
  });

  it('returns null for an uppercase 0X prefix (implementation is strict)', () => {
    // Guard against accidental relaxation of the regex.
    expect(normalizeEvmTxHash(evm0x.toUpperCase())).toBeNull();
  });

  it('returns null for invalid input', () => {
    expect(normalizeEvmTxHash('garbage')).toBeNull();
    expect(normalizeEvmTxHash(null)).toBeNull();
  });
});

describe('isValidTransactionHash', () => {
  it('accepts cosmos hashes', () => {
    expect(isValidTransactionHash(cosmosLike)).toBe(true);
  });

  it('accepts EVM hashes (0x and bare)', () => {
    expect(isValidTransactionHash(evm0x)).toBe(true);
    expect(isValidTransactionHash(evmBare)).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isValidTransactionHash('not-a-hash')).toBe(false);
    expect(isValidTransactionHash(null)).toBe(false);
  });
});

describe('getPreferredTxHash', () => {
  it('prefers the primary cosmos hash when present', () => {
    expect(getPreferredTxHash({ hash: cosmosLike, evmHash: evm0x })).toBe(cosmosLike);
  });

  it('returns a bare 64-char hex AS-IS (isCosmosTxHash matches first — same quirk as api/src/tx-utils.ts)', () => {
    // The isCosmosTxHash regex `/^[a-fA-F0-9]{64}$/` accepts bare hex regardless of case,
    // so a bare EVM-shaped hash is returned without 0x normalization. Mirrors the api side.
    expect(getPreferredTxHash({ hash: evmBare })).toBe(evmBare);
  });

  it('normalizes a primary EVM hash with 0x prefix to lowercase', () => {
    expect(getPreferredTxHash({ hash: evm0x.toUpperCase() })).toBeNull();
    // toUpperCase produces `0XF3DF...` which is not accepted by either regex → null.
    // For a mixed-case after-prefix input, normalization works:
    expect(getPreferredTxHash({ hash: '0x' + evmBare.toUpperCase() })).toBe(evm0x);
  });

  it('falls back to evmHash when primary is garbage', () => {
    expect(getPreferredTxHash({ hash: 'garbage', evmHash: evm0x })).toBe(evm0x);
  });

  it('returns null when both inputs are invalid', () => {
    expect(getPreferredTxHash({ hash: 'garbage', evmHash: 'also-garbage' })).toBeNull();
  });
});
