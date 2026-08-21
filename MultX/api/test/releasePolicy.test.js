import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshValidatorPolicy } from '../src/services/releaseService.js';

test('release validator policy is refreshed from chain on every attempt', async () => {
  let generation = 0;
  const bridge = {
    signaturesRequired: async () => generation === 0 ? 5n : 4n,
    getValidators: async () => generation === 0
      ? ['0x1111111111111111111111111111111111111111']
      : ['0x2222222222222222222222222222222222222222'],
  };
  const ctx = { bridge, chainId: 1 };

  const first = await refreshValidatorPolicy(ctx);
  generation = 1;
  const second = await refreshValidatorPolicy(ctx);

  assert.equal(first.required, 5);
  assert.ok(first.validators.has('0x1111111111111111111111111111111111111111'));
  assert.equal(second.required, 4);
  assert.ok(second.validators.has('0x2222222222222222222222222222222222222222'));
});
