import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { releaseMessageHash, resolvePolicy, validateAttestation } from '../src/policy.js';

const input = {
  version: 1,
  sourceTxHash: `0x${'11'.repeat(32)}`,
  sourceChain: 9005,
  sourceNonce: '7',
  sourceBlock: 100,
  sourceBridge: '0x2222222222222222222222222222222222222222',
  sourceToken: '0x3333333333333333333333333333333333333333',
  releaseToken: '0x4444444444444444444444444444444444444444',
  user: '0x5555555555555555555555555555555555555555',
  amount: '1000',
  targetChain: 1,
};

const policy = {
  sources: [{
    chainId: 9005,
    bridgeAddress: input.sourceBridge,
    routes: [{ sourceToken: input.sourceToken, targetChain: 1, releaseToken: input.releaseToken }],
  }],
};

test('accepts an allowlisted source bridge and token route', () => {
  const attestation = validateAttestation(input);
  assert.equal(resolvePolicy(policy, attestation).source.chainId, 9005);
  assert.match(releaseMessageHash(attestation), /^0x[0-9a-f]{64}$/);
});

test('rejects a release token not in signer policy', () => {
  const attestation = validateAttestation({ ...input, releaseToken: ethers.Wallet.createRandom().address });
  assert.throws(() => resolvePolicy(policy, attestation), /route is not allowed/);
});

test('rejects zero and malformed amounts', () => {
  assert.throws(() => validateAttestation({ ...input, amount: '0' }), /positive integer/);
  assert.throws(() => validateAttestation({ ...input, amount: '1.5' }), /positive integer/);
});

test('rejects chain and block identifiers outside the safe integer range', () => {
  assert.throws(
    () => validateAttestation({ ...input, sourceBlock: '9007199254740992' }),
    /safe integer range/,
  );
  assert.throws(
    () => validateAttestation({ ...input, targetChain: '9007199254740992' }),
    /safe integer range/,
  );
});
