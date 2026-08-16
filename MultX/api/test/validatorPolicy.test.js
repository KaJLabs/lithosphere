import test from 'node:test';
import assert from 'node:assert/strict';

import { positiveSafeInteger, validateValidatorSet } from '../src/services/validatorPolicy.js';

const A = '0x1111111111111111111111111111111111111111';
const B = '0x2222222222222222222222222222222222222222';

test('accepts a unique signer set at or above threshold', () => {
  const result = validateValidatorSet([{ address: A }, { address: B }], 2);
  assert.equal(result.required, 2);
  assert.deepEqual(result.addresses, [A, B]);
});

test('rejects duplicate signer identities and a threshold above the unique set', () => {
  assert.throws(
    () => validateValidatorSet([{ address: A }, { address: A }], 2),
    /must be unique/,
  );
  assert.throws(
    () => validateValidatorSet([{ address: A }], 2),
    /below configured threshold/,
  );
  assert.throws(
    () => validateValidatorSet([{ address: '0x0000000000000000000000000000000000000000' }], 1),
    /invalid address/,
  );
});

test('rejects malformed, zero, negative, and unsafe operational integers', () => {
  for (const value of ['', '0', '-1', '1.5', 'abc', '9007199254740992']) {
    assert.throws(() => positiveSafeInteger(value, 'value'));
  }
  assert.equal(positiveSafeInteger('8000', 'value'), 8000);
});
