import { ethers } from 'ethers5';

export const releaseMessageDigest = ({
  sourceTxHash,
  sourceBridge,
  token,
  user,
  amount,
  sourceChain,
  sourceNonce,
  destinationChain,
  destinationBridge,
}) => ethers.utils.solidityKeccak256(
  ['bytes32', 'address', 'address', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'address'],
  [
    sourceTxHash,
    sourceBridge,
    token,
    user,
    amount,
    sourceChain,
    sourceNonce,
    destinationChain,
    destinationBridge,
  ]
);

export const sortReleaseSignatures = (signatures, fields) => {
  const digest = releaseMessageDigest(fields);
  const signedDigest = ethers.utils.hashMessage(ethers.utils.arrayify(digest));
  return [...signatures]
    .map((signature) => ({
      signature,
      signer: ethers.utils.recoverAddress(signedDigest, signature).toLowerCase(),
    }))
    .sort((left, right) => (left.signer < right.signer ? -1 : 1))
    .map(({ signature }) => signature);
};
