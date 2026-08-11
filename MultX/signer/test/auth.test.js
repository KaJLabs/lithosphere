import assert from 'node:assert/strict';
import test from 'node:test';
import { bearerAuthorised } from '../src/auth.js';

test('accepts only an exact bearer token', () => {
  assert.equal(bearerAuthorised('Bearer correct-token', 'correct-token'), true);
  assert.equal(bearerAuthorised('Bearer wrong-token', 'correct-token'), false);
  assert.equal(bearerAuthorised('Basic correct-token', 'correct-token'), false);
  assert.equal(bearerAuthorised(undefined, 'correct-token'), false);
});
