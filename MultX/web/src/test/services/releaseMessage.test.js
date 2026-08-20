import { describe, expect, it } from 'vitest';
import { ethers } from 'ethers5';
import { releaseMessageDigest, sortReleaseSignatures } from '../../services/releaseMessage';

const fields = {
  sourceTxHash: `0x${'11'.repeat(32)}`,
  sourceBridge: '0x5555555555555555555555555555555555555555',
  token: '0x1111111111111111111111111111111111111111',
  user: '0x2222222222222222222222222222222222222222',
  amount: '1000000000000000000',
  sourceChain: 9005,
  sourceNonce: 7,
  destinationChain: 1,
  destinationBridge: '0x3333333333333333333333333333333333333333',
};

describe('release message domain', () => {
  it('binds source bridge, destination chain, and destination bridge', () => {
    const digest = releaseMessageDigest(fields);
    expect(releaseMessageDigest({ ...fields, destinationChain: 56 })).not.toBe(digest);
    expect(releaseMessageDigest({
      ...fields,
      destinationBridge: '0x4444444444444444444444444444444444444444',
    })).not.toBe(digest);
    expect(releaseMessageDigest({
      ...fields,
      sourceBridge: '0x6666666666666666666666666666666666666666',
    })).not.toBe(digest);
  });

  it('sorts signatures by recovered validator address using the nine-field digest', async () => {
    const wallets = [
      new ethers.Wallet(`0x${'01'.repeat(32)}`),
      new ethers.Wallet(`0x${'02'.repeat(32)}`),
    ];
    const digest = releaseMessageDigest(fields);
    const signatures = await Promise.all(
      wallets.map((wallet) => wallet.signMessage(ethers.utils.arrayify(digest)))
    );
    const sorted = sortReleaseSignatures(signatures.reverse(), fields);
    const signedDigest = ethers.utils.hashMessage(ethers.utils.arrayify(digest));
    const recovered = sorted.map((signature) =>
      ethers.utils.recoverAddress(signedDigest, signature).toLowerCase()
    );
    expect(recovered).toEqual([...recovered].sort());
  });
});
