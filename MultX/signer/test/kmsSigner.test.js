import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeKmsSignature, kmsKeyAddress } from '../src/kmsSigner.js';

test('decodes a minimal valid DER ECDSA signature', () => {
  const decoded = decodeKmsSignature(Buffer.from('3006020101020102', 'hex'));
  assert.equal(decoded.r, 1n);
  assert.equal(decoded.s, 2n);
});

test('rejects malformed or zero DER values', () => {
  assert.throws(() => decodeKmsSignature(Buffer.from('0000', 'hex')), /sequence/);
  assert.throws(() => decodeKmsSignature(Buffer.from('3006020100020102', 'hex')), /values/);
});

test('rejects a KMS key with the wrong cryptographic specification', async () => {
  const client = { async send() { return { PublicKey: Buffer.from([1]), KeySpec: 'RSA_2048' }; } };
  await assert.rejects(() => kmsKeyAddress('test-key', { client }), /ECC_SECG_P256K1/);
});
