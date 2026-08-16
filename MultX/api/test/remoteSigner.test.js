import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { releaseMessageHash, verifyReleaseSignature } from '../src/services/remoteSigner.js';

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
