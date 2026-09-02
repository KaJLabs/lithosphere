import test from 'node:test';
import assert from 'node:assert/strict';

import {
  positiveSafeInteger,
  validateProductionSignerEnvironment,
  validateValidatorSet,
  verifyLiveValidatorTopology,
} from '../src/services/validatorPolicy.js';

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

const productionEnv = () => Object.fromEntries([
  ['SIGNATURES_REQUIRED', '5'],
  ...Array.from({ length: 7 }, (_, index) => [
    [`VALIDATOR_SIGNER_URL_${index}`, `https://signer-${index}.internal`],
    [`VALIDATOR_SIGNER_ADDRESS_${index}`, `0x${String(index + 1).padStart(40, '0')}`],
  ]).flat(),
]);

test('production signer environment is exactly contiguous 5-of-7', () => {
  assert.equal(validateProductionSignerEnvironment(productionEnv()).length, 7);
  const gap = productionEnv(); delete gap.VALIDATOR_SIGNER_URL_3;
  assert.throws(() => validateProductionSignerEnvironment(gap), /signer 3/);
  const extra = productionEnv(); extra.VALIDATOR_SIGNER_URL_7 = 'https://extra.internal';
  assert.throws(() => validateProductionSignerEnvironment(extra), /exactly signer indices/);
  const wrongThreshold = productionEnv(); wrongThreshold.SIGNATURES_REQUIRED = '4';
  assert.throws(() => validateProductionSignerEnvironment(wrongThreshold), /exactly 5/);
});

test('startup topology must match the exact live on-chain 5-of-7 set', async () => {
  const expected = Array.from({ length: 7 }, (_, i) => `0x${String(i + 1).padStart(40, '0')}`);
  const provider = {
    getNetwork: async () => ({ chainId: 9005 }),
    call: async ({ data }) => {
      const iface = new (await import('ethers')).ethers.Interface([
        'function signaturesRequired() view returns (uint256)',
        'function getValidatorCount() view returns (uint256)',
        'function getValidators() view returns (address[])',
      ]);
      const selector = data.slice(0, 10);
      if (selector === iface.getFunction('signaturesRequired').selector) return iface.encodeFunctionResult('signaturesRequired', [5]);
      if (selector === iface.getFunction('getValidatorCount').selector) return iface.encodeFunctionResult('getValidatorCount', [7]);
      return iface.encodeFunctionResult('getValidators', [expected]);
    },
    resolveName: async (name) => name,
  };
  await verifyLiveValidatorTopology(
    [{ name: 'LITHO', chainId: 9005, rpc: 'https://rpc.example', bridge: A }],
    expected.map((item) => item.toLowerCase()),
    () => provider,
  );
});
