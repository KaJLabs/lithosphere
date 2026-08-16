import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ethers } from 'ethers';
import {
  releaseMessageHash,
  resolveRemoteSignerAuth,
  validateSignerUrl,
  verifyReleaseSignature,
} from '../src/services/remoteSigner.js';

const attestation = {
  sourceTxHash: `0x${'11'.repeat(32)}`,
  releaseToken: '0x2222222222222222222222222222222222222222',
  user: '0x3333333333333333333333333333333333333333',
  amount: '1000000000000000000',
  sourceChain: 9005,
  sourceNonce: 7,
  sourceBlock: 123,
  sourceBridge: '0x4444444444444444444444444444444444444444',
  sourceToken: '0x5555555555555555555555555555555555555555',
  targetChain: 1,
  releaseBridge: '0x6666666666666666666666666666666666666666',
};

test('accepts a signature from the configured validator', async () => {
  const wallet = ethers.Wallet.createRandom();
  const hash = releaseMessageHash(attestation);
  const signature = await wallet.signMessage(ethers.getBytes(hash));

  assert.equal(
    verifyReleaseSignature({ attestation, signature, expectedAddress: wallet.address }),
    signature,
  );
});

test('accepts only credential-free HTTPS signer origins', () => {
  assert.equal(validateSignerUrl('https://signer-0.internal:9443'), 'https://signer-0.internal:9443');
  for (const url of [
    'http://signer-0.internal:9443',
    'https://user:pass@signer-0.internal:9443',
    'https://signer-0.internal:9443/path',
    'https://signer-0.internal:9443?token=secret',
  ]) {
    assert.throws(() => validateSignerUrl(url));
  }
});

test('loads a bearer token from a file without requiring client key material', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'multx-remote-auth-'));
  const tokenFile = path.join(directory, 'token');
  fs.writeFileSync(tokenFile, 'a-secure-test-token-that-is-at-least-32-characters');
  try {
    const auth = resolveRemoteSignerAuth({ index: 0, tokenFile });
    assert.equal(auth.mode, 'bearer');
    assert.match(auth.token, /^a-secure-test-token/);
    assert.deepEqual(auth.tls, {});
    assert.throws(() => resolveRemoteSignerAuth({ index: 0, tokenFile, certFile: tokenFile }), /not both/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects a signature if any signed release field changes', async () => {
  const wallet = ethers.Wallet.createRandom();
  const hash = releaseMessageHash(attestation);
  const signature = await wallet.signMessage(ethers.getBytes(hash));

  assert.throws(() => verifyReleaseSignature({
    attestation: { ...attestation, amount: '1000000000000000001' },
    signature,
    expectedAddress: wallet.address,
  }), /expected/);
});

test('rejects replay on a different destination chain or bridge', async () => {
  const wallet = ethers.Wallet.createRandom();
  const signature = await wallet.signMessage(ethers.getBytes(releaseMessageHash(attestation)));

  assert.throws(() => verifyReleaseSignature({
    attestation: { ...attestation, targetChain: 8453 },
    signature,
    expectedAddress: wallet.address,
  }), /expected/);
  assert.throws(() => verifyReleaseSignature({
    attestation: { ...attestation, releaseBridge: ethers.Wallet.createRandom().address },
    signature,
    expectedAddress: wallet.address,
  }), /expected/);
});

test('rejects a valid signature from an unexpected validator', async () => {
  const signer = ethers.Wallet.createRandom();
  const expected = ethers.Wallet.createRandom();
  const hash = releaseMessageHash(attestation);
  const signature = await signer.signMessage(ethers.getBytes(hash));

  assert.throws(() => verifyReleaseSignature({
    attestation,
    signature,
    expectedAddress: expected.address,
  }), /expected/);
});
