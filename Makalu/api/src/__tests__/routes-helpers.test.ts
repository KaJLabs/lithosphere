import { describe, expect, it } from 'vitest';
import {
  clamp,
  clampOffset,
  classifyTxType,
  computeFeeUlitho,
  cosmosToEvm,
  decodeMethodName,
  decodeTransferAmount,
  evmToCosmos,
  hasNumericString,
  hasPositiveNumericString,
  hexTimestampToIso,
  hexToDec,
  normalizeContractAddress,
  normalizeFaucetAmountInput,
  parseHexInteger,
  parseIntSafe,
  preferString,
  toIsoString,
  weiToUlitho,
} from '../routes.js';

describe('weiToUlitho', () => {
  it('returns "0" for zero, null, undefined, empty', () => {
    expect(weiToUlitho('0')).toBe('0');
    expect(weiToUlitho(null)).toBe('0');
    expect(weiToUlitho(undefined)).toBe('0');
    expect(weiToUlitho('')).toBe('0');
  });

  it('passes through large numeric strings unchanged (1 wei = 1 ulitho)', () => {
    expect(weiToUlitho('19998999999999999882400000')).toBe('19998999999999999882400000');
  });

  it('returns "0" for non-numeric input', () => {
    expect(weiToUlitho('not-a-number')).toBe('0');
  });

  it('normalizes hex input via BigInt', () => {
    expect(weiToUlitho('0x3e8')).toBe('1000');
  });
});

describe('clamp', () => {
  it('returns DEFAULT_LIMIT (20) when value is falsy or non-numeric', () => {
    expect(clamp(undefined)).toBe(20);
    expect(clamp(null)).toBe(20);
    expect(clamp('')).toBe(20);
    expect(clamp('abc')).toBe(20);
    expect(clamp(0)).toBe(20);
  });

  it('returns DEFAULT_LIMIT when value is below 1', () => {
    expect(clamp(-5)).toBe(20);
    expect(clamp('-10')).toBe(20);
  });

  it('caps at MAX_LIMIT (100)', () => {
    expect(clamp(500)).toBe(100);
    expect(clamp('1000')).toBe(100);
  });

  it('accepts string-numeric values inside the range', () => {
    expect(clamp('50')).toBe(50);
  });

  it('respects the explicit default', () => {
    expect(clamp(undefined, 7)).toBe(7);
  });
});

describe('clampOffset', () => {
  it('returns 0 for negative, NaN, or non-numeric input', () => {
    expect(clampOffset(-5)).toBe(0);
    expect(clampOffset(undefined)).toBe(0);
    expect(clampOffset('xyz')).toBe(0);
    expect(clampOffset(Infinity)).toBe(0);
  });

  it('floors fractional input', () => {
    expect(clampOffset(3.9)).toBe(3);
    expect(clampOffset('42.7')).toBe(42);
  });

  it('passes positive integers through', () => {
    expect(clampOffset(100)).toBe(100);
  });
});

describe('normalizeFaucetAmountInput', () => {
  it('treats null/undefined as "not provided" (invalid: false, no value)', () => {
    expect(normalizeFaucetAmountInput(null)).toEqual({ invalid: false });
    expect(normalizeFaucetAmountInput(undefined)).toEqual({ invalid: false });
  });

  it('accepts positive finite numbers as strings', () => {
    expect(normalizeFaucetAmountInput(1)).toEqual({ value: '1', invalid: false });
    expect(normalizeFaucetAmountInput(2.5)).toEqual({ value: '2.5', invalid: false });
  });

  it('rejects zero, negative, and non-finite numbers', () => {
    expect(normalizeFaucetAmountInput(0)).toEqual({ invalid: true });
    expect(normalizeFaucetAmountInput(-5)).toEqual({ invalid: true });
    expect(normalizeFaucetAmountInput(NaN)).toEqual({ invalid: true });
  });

  it('accepts well-formed numeric strings', () => {
    expect(normalizeFaucetAmountInput('5')).toEqual({ value: '5', invalid: false });
    expect(normalizeFaucetAmountInput('  10.5  ')).toEqual({ value: '10.5', invalid: false });
  });

  it('rejects malformed strings', () => {
    expect(normalizeFaucetAmountInput('abc')).toEqual({ invalid: true });
    expect(normalizeFaucetAmountInput('1.2.3')).toEqual({ invalid: true });
    expect(normalizeFaucetAmountInput('')).toEqual({ invalid: true });
  });

  it('rejects non-string, non-number, non-nullish input', () => {
    expect(normalizeFaucetAmountInput({ amount: 5 })).toEqual({ invalid: true });
    expect(normalizeFaucetAmountInput([5])).toEqual({ invalid: true });
  });
});

describe('evmToCosmos / cosmosToEvm', () => {
  const evm = '0x22d279d24f0b7ca5d49c5a7a7f032da416f72387';
  const cosmos = 'litho1ytf8n5j0pd72t4yutfa87qed5st0wgu8lvvmtr';

  it('converts EVM 0x address to bech32 litho1...', () => {
    expect(evmToCosmos(evm)).toBe(cosmos);
  });

  it('round-trips a cosmos address back to its EVM form (lowercase)', () => {
    expect(cosmosToEvm(cosmos)).toBe(evm);
  });

  it('returns undefined for missing or malformed EVM addresses', () => {
    expect(evmToCosmos(null)).toBeUndefined();
    expect(evmToCosmos(undefined)).toBeUndefined();
    expect(evmToCosmos('0x123')).toBeUndefined();
    expect(evmToCosmos('not-an-address')).toBeUndefined();
  });

  it('returns undefined for invalid bech32 strings', () => {
    expect(cosmosToEvm(null)).toBeUndefined();
    expect(cosmosToEvm('')).toBeUndefined();
    expect(cosmosToEvm('not-bech32')).toBeUndefined();
  });

  it('rejects bech32 addresses with the wrong prefix', () => {
    // valid bech32 payload, but cosmos1... prefix instead of litho1...
    expect(cosmosToEvm('cosmos1ytf8n5j0pd72t4yutfa87qed5st0wgu8c0qcs7')).toBeUndefined();
  });
});

describe('classifyTxType', () => {
  it('returns "create" when toAddr is empty and contractAddr is set', () => {
    expect(classifyTxType('0x60806040', null, '0xcontract')).toBe('create');
  });

  it('returns "call" when inputData has function call data', () => {
    expect(classifyTxType('0xa9059cbb000000...', '0xto', null)).toBe('call');
  });

  it('returns "transfer" when inputData is "0x" or empty', () => {
    expect(classifyTxType('0x', '0xto', null)).toBe('transfer');
    expect(classifyTxType(null, '0xto', null)).toBe('transfer');
    expect(classifyTxType(undefined, '0xto', null)).toBe('transfer');
  });

  it('contract creation takes precedence over call data', () => {
    // When toAddr is null AND contractAddr is set, it's always a create
    expect(classifyTxType('0xa9059cbb', null, '0xcontract')).toBe('create');
  });
});

describe('decodeMethodName', () => {
  it('decodes well-known ERC20 selectors', () => {
    expect(decodeMethodName('0xa9059cbb000000000000000000000000aaa')).toBe('Transfer');
    expect(decodeMethodName('0x095ea7b3000000000000000000000000bbb')).toBe('Approve');
    expect(decodeMethodName('0x70a08231')).toBe('Balance Of');
  });

  it('returns the raw selector for unknown method', () => {
    expect(decodeMethodName('0xdeadbeef00000000')).toBe('0xdeadbeef');
  });

  it('returns undefined for missing or empty input data', () => {
    expect(decodeMethodName(undefined)).toBeUndefined();
    expect(decodeMethodName(null)).toBeUndefined();
    expect(decodeMethodName('0x')).toBeUndefined();
    expect(decodeMethodName('0xabc')).toBeUndefined(); // too short
  });

  it('is case-insensitive on the selector', () => {
    expect(decodeMethodName('0xA9059CBB000000000000000000000000aaa')).toBe('Transfer');
  });
});

describe('decodeTransferAmount', () => {
  it('decodes ERC20 transfer(to, amount) calldata', () => {
    // selector + to (32 bytes) + amount (32 bytes = 0x3e8 = 1000)
    const calldata =
      '0xa9059cbb' +
      '000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' +
      '00000000000000000000000000000000000000000000000000000000000003e8';
    expect(decodeTransferAmount(calldata)).toBe('1000');
  });

  it('returns null for non-transfer selectors', () => {
    const calldata =
      '0xdeadbeef' +
      '000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' +
      '00000000000000000000000000000000000000000000000000000000000003e8';
    expect(decodeTransferAmount(calldata)).toBeNull();
  });

  it('returns null for short or missing calldata', () => {
    expect(decodeTransferAmount(undefined)).toBeNull();
    expect(decodeTransferAmount('0xa9059cbb')).toBeNull(); // no args
  });
});

describe('computeFeeUlitho', () => {
  it('multiplies gasUsed × gasPriceWei as BigInts', () => {
    expect(computeFeeUlitho(21000, '20000000000')).toBe('420000000000000');
    expect(computeFeeUlitho('21000', '20000000000')).toBe('420000000000000');
  });

  it('returns null when gasPrice is 0 or missing', () => {
    expect(computeFeeUlitho(21000, '0')).toBeNull();
    expect(computeFeeUlitho(21000, null)).toBeNull();
    expect(computeFeeUlitho(0, '20000000000')).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(computeFeeUlitho('not-a-number', '20000000000')).toBeNull();
  });
});

describe('hexToDec', () => {
  it('converts hex to decimal string', () => {
    expect(hexToDec('0x3e8')).toBe('1000');
    expect(hexToDec('0xff')).toBe('255');
  });

  it('handles large values without precision loss', () => {
    expect(hexToDec('0xffffffffffffffffffffffffffffffff')).toBe('340282366920938463463374607431768211455');
  });

  it('returns "0" for sentinel zero values', () => {
    expect(hexToDec('0x0')).toBe('0');
    expect(hexToDec('0x')).toBe('0');
    expect(hexToDec(null)).toBe('0');
    expect(hexToDec(undefined)).toBe('0');
  });

  it('returns "0" for malformed hex', () => {
    expect(hexToDec('0xnotahex')).toBe('0');
  });
});

describe('parseIntSafe', () => {
  it('preserves numbers', () => {
    expect(parseIntSafe(42)).toBe(42);
  });

  it('parses numeric strings', () => {
    expect(parseIntSafe('123')).toBe(123);
  });

  it('returns 0 for nullish and non-numeric input', () => {
    expect(parseIntSafe(null)).toBe(0);
    expect(parseIntSafe(undefined)).toBe(0);
    expect(parseIntSafe('xyz')).toBe(0);
  });
});

describe('parseHexInteger', () => {
  it('converts hex string to a JS number', () => {
    expect(parseHexInteger('0x3e8')).toBe(1000);
  });

  it('returns null for missing or malformed input', () => {
    expect(parseHexInteger(null)).toBeNull();
    expect(parseHexInteger('')).toBeNull();
    expect(parseHexInteger('0xnotahex')).toBeNull();
  });
});

describe('toIsoString', () => {
  it('formats a Date object', () => {
    expect(toIsoString(new Date('2026-05-11T12:00:00Z'))).toBe('2026-05-11T12:00:00.000Z');
  });

  it('parses ISO-like strings', () => {
    expect(toIsoString('2026-05-11T12:00:00Z')).toBe('2026-05-11T12:00:00.000Z');
  });

  it('returns null for invalid dates and nullish input', () => {
    expect(toIsoString('not-a-date')).toBeNull();
    expect(toIsoString(null)).toBeNull();
    expect(toIsoString(undefined)).toBeNull();
  });
});

describe('hexTimestampToIso', () => {
  it('converts an EVM hex timestamp (seconds) to ISO string', () => {
    // 0x3e8 = 1000 seconds since epoch
    expect(hexTimestampToIso('0x3e8')).toBe('1970-01-01T00:16:40.000Z');
  });

  it('round-trips a known recent timestamp', () => {
    const seconds = 1778457600; // 2026-05-11T00:00:00Z (round value)
    const hex = '0x' + seconds.toString(16);
    expect(hexTimestampToIso(hex)).toBe(new Date(seconds * 1000).toISOString());
  });

  it('returns undefined for missing or malformed input', () => {
    expect(hexTimestampToIso(null)).toBeUndefined();
    expect(hexTimestampToIso('')).toBeUndefined();
    expect(hexTimestampToIso('not-hex')).toBeUndefined();
  });
});

describe('hasNumericString / hasPositiveNumericString', () => {
  it('hasNumericString accepts non-negative integer strings only', () => {
    expect(hasNumericString('0')).toBe(true);
    expect(hasNumericString('42')).toBe(true);
    expect(hasNumericString('')).toBe(false);
    expect(hasNumericString('1.5')).toBe(false);
    expect(hasNumericString('-1')).toBe(false);
    expect(hasNumericString(null)).toBe(false);
    expect(hasNumericString(undefined)).toBe(false);
  });

  it('hasPositiveNumericString rejects zero', () => {
    expect(hasPositiveNumericString('0')).toBe(false);
    expect(hasPositiveNumericString('1')).toBe(true);
    expect(hasPositiveNumericString('')).toBe(false);
  });
});

describe('preferString', () => {
  it('returns primary when present and non-empty', () => {
    expect(preferString('a', 'b')).toBe('a');
  });

  it('falls back when primary is null, undefined, or empty', () => {
    expect(preferString(null, 'b')).toBe('b');
    expect(preferString(undefined, 'b')).toBe('b');
    expect(preferString('', 'b')).toBe('b');
  });

  it('returns the fallback unchanged when both are nullish', () => {
    expect(preferString(null, null)).toBeNull();
    expect(preferString(undefined, undefined)).toBeUndefined();
  });
});

describe('normalizeContractAddress', () => {
  // The FGPT LEP-100 contract on Makalu — the pair that exposed the bug:
  // /tokens/litho1… returned "Token contract not found" while /tokens/0x…
  // returned 230 holders and 304 transfers for the same contract.
  const EVM = '0x151ef362ea96853702cc5e7728107e3961fbd22e';
  const LITHO = 'litho1z500xch2j6znwqkvtemjsyr789slh53wstcpq4';

  it('converts a bech32 contract address to the stored EVM form', () => {
    expect(normalizeContractAddress(LITHO)).toBe(EVM);
  });

  it('is case-insensitive on the bech32 input', () => {
    expect(normalizeContractAddress(LITHO.toUpperCase().replace('LITHO1', 'litho1'))).toBe(EVM);
  });

  it('passes an EVM address through untouched', () => {
    expect(normalizeContractAddress(EVM)).toBe(EVM);
  });

  it('preserves the `native` sentinel', () => {
    expect(normalizeContractAddress('native')).toBe('native');
  });

  it('passes through undecodable input rather than throwing', () => {
    expect(normalizeContractAddress('litho1notavalidbech32')).toBe('litho1notavalidbech32');
    expect(normalizeContractAddress('')).toBe('');
    expect(normalizeContractAddress('not-an-address')).toBe('not-an-address');
  });

  it('does not touch a validator address that merely starts with litho', () => {
    // lithovaloper1… does not begin with the litho1 prefix, so it passes through.
    const val = 'lithovaloper1abcdef';
    expect(normalizeContractAddress(val)).toBe(val);
  });
});
