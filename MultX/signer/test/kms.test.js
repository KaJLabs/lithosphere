import assert from 'node:assert/strict';
import test from 'node:test';
import { ethers } from 'ethers';
import { createKmsSigner, decodeDerSignature } from '../src/kms.js';

test('decodes a canonical DER ECDSA signature', () => {
  const der = Buffer.from('3006020101020102', 'hex');
  assert.deepEqual(decodeDerSignature(der), { r: 1n, s: 2n });
});

test('rejects malformed DER', () => {
  assert.throws(() => decodeDerSignature(Buffer.from('0101ff', 'hex')), /DER sequence/);
});

const derInteger = (hex) => {
  let value = Buffer.from(hex.slice(2).replace(/^00+/u, ''), 'hex');
  if (value[0] & 0x80) value = Buffer.concat([Buffer.from([0]), value]);
  return Buffer.concat([Buffer.from([0x02, value.length]), value]);
};

test('produces an ethers-compatible EIP-191 signature through KMS', async () => {
  const wallet = new ethers.Wallet(`0x${'11'.repeat(32)}`);
  const point = Buffer.from(wallet.signingKey.publicKey.slice(2), 'hex');
  const spkiPrefix = Buffer.from('3056301006072a8648ce3d020106052b8104000a034200', 'hex');
  const client = {
    async send(command) {
      if (command.constructor.name === 'GetPublicKeyCommand') {
        return { PublicKey: Buffer.concat([spkiPrefix, point]), KeySpec: 'ECC_SECG_P256K1', KeyUsage: 'SIGN_VERIFY' };
      }
      const digest = ethers.hexlify(command.input.Message);
      const signature = wallet.signingKey.sign(digest);
      const r = derInteger(signature.r);
      const s = derInteger(signature.s);
      return { Signature: Buffer.concat([Buffer.from([0x30, r.length + s.length]), r, s]) };
    },
  };
  const signer = await createKmsSigner({ keyId: 'test-key', region: 'us-east-1', expectedAddress: wallet.address, client });
  const message = ethers.getBytes(`0x${'ab'.repeat(32)}`);
  const signature = await signer.signMessage(message);
  assert.equal(ethers.verifyMessage(message, signature), wallet.address);
});
