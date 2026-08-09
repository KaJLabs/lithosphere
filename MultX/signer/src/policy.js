import { ethers } from 'ethers';

const positiveIntegerString = (value, label) => {
  const text = String(value ?? '');
  if (!/^[1-9][0-9]*$/.test(text)) throw new Error(`${label} must be a positive integer`);
  return text;
};

const safePositiveInteger = (value, label) => {
  const text = positiveIntegerString(value, label);
  const number = Number(text);
  if (!Number.isSafeInteger(number)) throw new Error(`${label} exceeds JavaScript's safe integer range`);
  return number;
};

export const validateAttestation = (input) => ({
  version: Number(input?.version),
  sourceTxHash: /^0x[0-9a-fA-F]{64}$/.test(input?.sourceTxHash || '')
    ? input.sourceTxHash
    : (() => { throw new Error('sourceTxHash must be bytes32'); })(),
  sourceChain: safePositiveInteger(input?.sourceChain, 'sourceChain'),
  sourceNonce: positiveIntegerString(input?.sourceNonce, 'sourceNonce'),
  sourceBlock: safePositiveInteger(input?.sourceBlock, 'sourceBlock'),
  sourceBridge: ethers.getAddress(input?.sourceBridge || ''),
  sourceToken: ethers.getAddress(input?.sourceToken || ''),
  releaseToken: ethers.getAddress(input?.releaseToken || ''),
  user: ethers.getAddress(input?.user || ''),
  amount: positiveIntegerString(input?.amount, 'amount'),
  targetChain: safePositiveInteger(input?.targetChain, 'targetChain'),
});

export const releaseMessageHash = (attestation) => ethers.solidityPackedKeccak256(
  ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
  [
    attestation.sourceTxHash,
    attestation.releaseToken,
    attestation.user,
    attestation.amount,
    attestation.sourceChain,
    attestation.sourceNonce,
  ],
);

export const resolvePolicy = (policy, attestation) => {
  if (attestation.version !== 1) throw new Error('unsupported attestation version');
  const source = policy.sources?.find((item) => Number(item.chainId) === attestation.sourceChain);
  if (!source) throw new Error(`source chain ${attestation.sourceChain} is not allowed`);
  if (ethers.getAddress(source.bridgeAddress) !== attestation.sourceBridge) {
    throw new Error('source bridge does not match policy');
  }
  const route = source.routes?.find((item) =>
    ethers.getAddress(item.sourceToken) === attestation.sourceToken &&
    Number(item.targetChain) === attestation.targetChain &&
    ethers.getAddress(item.releaseToken) === attestation.releaseToken
  );
  if (!route) throw new Error('token route is not allowed');
  return { source, route };
};

export const assertLockEvent = (event, attestation) => {
  const args = event?.args;
  if (!args) throw new Error('lock event is missing');
  const matches =
    String(args.txHash).toLowerCase() === attestation.sourceTxHash.toLowerCase() &&
    ethers.getAddress(args.token) === attestation.sourceToken &&
    ethers.getAddress(args.user) === attestation.user &&
    args.amount.toString() === attestation.amount &&
    args.targetChain.toString() === String(attestation.targetChain) &&
    args.nonce.toString() === attestation.sourceNonce;
  if (!matches) throw new Error('source lock event does not match attestation');
};
