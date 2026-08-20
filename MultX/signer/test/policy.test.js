import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import {
  parseSignerPolicy,
  releaseMessageHash,
  resolvePolicy,
  validateAttestation,
} from '../src/policy.js';

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
  releaseBridge: '0x6666666666666666666666666666666666666666',
};

const policy = {
  sources: [{
    chainId: 9005,
    rpcUrl: 'https://rpc-mainnet.litho.ai',
    bridgeAddress: input.sourceBridge,
    confirmations: 12,
    routes: [{
      sourceToken: input.sourceToken,
      targetChain: 1,
      releaseToken: input.releaseToken,
      releaseBridge: input.releaseBridge,
    }],
  }],
};

test('accepts an allowlisted source bridge and token route', () => {
  const attestation = validateAttestation(input);
  const parsed = parseSignerPolicy(policy);
  assert.equal(resolvePolicy(parsed, attestation).source.chainId, 9005);
  assert.match(releaseMessageHash(attestation), /^0x[0-9a-f]{64}$/);
});

test('binds the signed release digest to the exact source bridge', () => {
  const attestation = validateAttestation(input);
  const otherSource = validateAttestation({
    ...input,
    sourceBridge: '0x7777777777777777777777777777777777777777',
  });
  assert.notEqual(releaseMessageHash(attestation), releaseMessageHash(otherSource));
});

test('rejects missing, malformed, and zero confirmation policy', () => {
  const source = policy.sources[0];
  assert.throws(
    () => parseSignerPolicy({ ...policy, sources: [{ ...source, confirmations: undefined }] }),
    /confirmations must be a positive integer/,
  );
  assert.throws(
    () => parseSignerPolicy({ ...policy, sources: [{ ...source, confirmations: 'not-a-number' }] }),
    /confirmations must be a positive integer/,
  );
  assert.throws(
    () => parseSignerPolicy({ ...policy, sources: [{ ...source, confirmations: 0 }] }),
    /confirmations must be a positive integer/,
  );
});

test('rejects unsafe RPC URLs, duplicate sources, and duplicate routes', () => {
  const source = policy.sources[0];
  assert.throws(
    () => parseSignerPolicy({ ...policy, sources: [{ ...source, rpcUrl: 'http://rpc.example.test' }] }),
    /must use HTTPS/,
  );
  assert.throws(
    () => parseSignerPolicy({ ...policy, sources: [source, source] }),
    /duplicates an earlier source/,
  );
  assert.throws(
    () => parseSignerPolicy({ ...policy, sources: [{ ...source, routes: [source.routes[0], source.routes[0]] }] }),
    /duplicates an earlier route/,
  );
  assert.throws(
    () => parseSignerPolicy({
      ...policy,
      sources: [{
        ...source,
        routes: [source.routes[0], {
          ...source.routes[0],
          releaseToken: ethers.Wallet.createRandom().address,
        }],
      }],
    }),
    /duplicates an earlier route/,
  );
});

test('rejects zero critical addresses in policy and attestations', () => {
  const source = policy.sources[0];
  assert.throws(
    () => parseSignerPolicy({ ...policy, sources: [{ ...source, bridgeAddress: ethers.ZeroAddress }] }),
    /must be non-zero/,
  );
  assert.throws(
    () => validateAttestation({ ...input, user: ethers.ZeroAddress }),
    /must be non-zero/,
  );
});

test('rejects a release token not in signer policy', () => {
  const attestation = validateAttestation({ ...input, releaseToken: ethers.Wallet.createRandom().address });
  assert.throws(() => resolvePolicy(policy, attestation), /route is not allowed/);
});

test('rejects a destination bridge not in signer policy', () => {
  const attestation = validateAttestation({ ...input, releaseBridge: ethers.Wallet.createRandom().address });
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
