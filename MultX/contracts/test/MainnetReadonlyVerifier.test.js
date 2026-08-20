const { expect } = require('chai');
const { verifyExactValidatorSet } = require('../scripts/mainnet/verify-deployment-readonly');

const validators = Array.from({ length: 7 }, (_, index) =>
  `0x${String(index + 1).padStart(40, '0')}`
);

const bridgeWith = (live) => ({
  getValidatorCount: async () => ({ toString: () => String(live.length) }),
  getValidators: async () => live,
});

async function expectReject(promise, pattern) {
  try {
    await promise;
    expect.fail('expected verifier to reject');
  } catch (error) {
    expect(error.message).to.match(pattern);
  }
}

describe('mainnet read-only validator verification', function () {
  it('accepts exactly the complete manifest validator set', async function () {
    expect(await verifyExactValidatorSet(bridgeWith(validators), validators, 'LITHO')).to.deep.equal(validators);
  });

  it('rejects seven expected validators plus one hidden live validator', async function () {
    const live = [...validators, '0x0000000000000000000000000000000000000008'];
    await expectReject(verifyExactValidatorSet(bridgeWith(live), validators, 'LITHO'), /live validator count 8/);
  });

  it('rejects seven expected validators plus five hidden live validators', async function () {
    const extra = Array.from({ length: 5 }, (_, index) =>
      `0x${String(index + 8).padStart(40, '0')}`
    );
    await expectReject(
      verifyExactValidatorSet(bridgeWith([...validators, ...extra]), validators, 'LITHO'),
      /live validator count 12/
    );
  });
});
