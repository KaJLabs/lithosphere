import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSignerPolicy } from '../src/runtimeConfig.js';

test('disabled signer can start without a bridge policy', () => {
  assert.equal(loadSignerPolicy({ signingEnabled: false }), null);
});

test('enabled signer fails closed without a bridge policy', () => {
  assert.throws(
    () => loadSignerPolicy({ signingEnabled: true }),
    /required when signing is enabled/,
  );
});

test('policy sources remain mutually exclusive while disabled', () => {
  assert.throws(
    () => loadSignerPolicy({
      signingEnabled: false,
      policyFile: 'policy.json',
      policyJson: '{}',
    }),
    /never both/,
  );
});
