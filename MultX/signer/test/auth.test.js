import assert from 'node:assert/strict';
import test from 'node:test';
import { hasValidBearerToken, loadBearerToken } from '../src/auth.js';

const token = 'a-secure-test-token-that-is-at-least-32-characters';

test('accepts only an exact Bearer token', () => {
  assert.equal(hasValidBearerToken(`Bearer ${token}`, token), true);
  assert.equal(hasValidBearerToken(`bearer ${token}`, token), false);
  assert.equal(hasValidBearerToken(`Bearer ${token}x`, token), false);
  assert.equal(hasValidBearerToken('', token), false);
});

test('requires one bounded token source', () => {
  assert.equal(loadBearerToken({ env: { SIGNER_BEARER_TOKEN: token } }), token);
  assert.throws(() => loadBearerToken({ env: {} }), /required/);
  assert.throws(() => loadBearerToken({ env: { SIGNER_BEARER_TOKEN: 'short' } }), /32 to 512/);
  assert.throws(() => loadBearerToken({
    env: { SIGNER_BEARER_TOKEN: token, SIGNER_BEARER_TOKEN_FILE: '/tmp/token' },
  }), /never both/);
});
