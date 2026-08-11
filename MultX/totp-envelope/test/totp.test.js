import assert from 'node:assert/strict';
import test from 'node:test';
import { currentTotp } from '../src/totp.js';

test('matches RFC 6238 SHA-1 vector', () => {
  assert.equal(currentTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59_000, 30, 8).code, '94287082');
});
