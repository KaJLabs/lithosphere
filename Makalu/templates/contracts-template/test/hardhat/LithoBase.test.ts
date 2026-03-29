import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import type { MockLithoBase } from '../../typechain-types';

describe('LithoBase', function () {
  // Fixture for deployment
  async function deployLithoBaseFixture() {
    const [owner, user, newOwner] = await ethers.getSigners();

    const MockLithoBase = await ethers.getContractFactory('MockLithoBase');
    const lithoBase = await MockLithoBase.deploy(owner.address);

    return { lithoBase, owner, user, newOwner };
  }

  describe('Deployment', function () {
    it('Should set the right owner', async function () {
      const { lithoBase, owner } = await loadFixture(deployLithoBaseFixture);
      expect(await lithoBase.owner()).to.equal(owner.address);
    });

    it('Should not be paused initially', async function () {
      const { lithoBase } = await loadFixture(deployLithoBaseFixture);
      expect(await lithoBase.isPaused()).to.be.false;
    });

    it('Should return correct version', async function () {
      const { lithoBase } = await loadFixture(deployLithoBaseFixture);
      expect(await lithoBase.version()).to.equal('1.0.0');
    });

    it('Should revert if deployed with zero address', async function () {
      const MockLithoBase = await ethers.getContractFactory('MockLithoBase');
      await expect(MockLithoBase.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        MockLithoBase,
        'OwnableInvalidOwner'
      );
    });
  });

  describe('Ownership', function () {
    it('Should transfer ownership', async function () {
      const { lithoBase, owner, newOwner } = await loadFixture(deployLithoBaseFixture);

      await expect(lithoBase.connect(owner).transferOwnership(newOwner.address))
        .to.emit(lithoBase, 'OwnershipTransferred')
        .withArgs(owner.address, newOwner.address);

      expect(await lithoBase.owner()).to.equal(newOwner.address);
    });

    it('Should revert if non-owner tries to transfer', async function () {
      const { lithoBase, user, newOwner } = await loadFixture(deployLithoBaseFixture);

      await expect(
        lithoBase.connect(user).transferOwnership(newOwner.address)
      ).to.be.revertedWithCustomError(lithoBase, 'OwnableUnauthorizedAccount');
    });

    it('Should allow owner to renounce ownership', async function () {
      const { lithoBase, owner } = await loadFixture(deployLithoBaseFixture);

      await lithoBase.connect(owner).renounceOwnership();
      expect(await lithoBase.owner()).to.equal(ethers.ZeroAddress);
    });
  });

  describe('Pausability', function () {
    it('Should allow owner to pause', async function () {
      const { lithoBase, owner } = await loadFixture(deployLithoBaseFixture);

      await expect(lithoBase.connect(owner).pause())
        .to.emit(lithoBase, 'Paused')
        .withArgs(owner.address);

      expect(await lithoBase.isPaused()).to.be.true;
    });

    it('Should allow owner to unpause', async function () {
      const { lithoBase, owner } = await loadFixture(deployLithoBaseFixture);

      await lithoBase.connect(owner).pause();
      await expect(lithoBase.connect(owner).unpause())
        .to.emit(lithoBase, 'Unpaused')
        .withArgs(owner.address);

      expect(await lithoBase.isPaused()).to.be.false;
    });

    it('Should revert if non-owner tries to pause', async function () {
      const { lithoBase, user } = await loadFixture(deployLithoBaseFixture);

      await expect(lithoBase.connect(user).pause()).to.be.revertedWithCustomError(
        lithoBase,
        'OwnableUnauthorizedAccount'
      );
    });

    it('Should emit EmergencyAction event on pause', async function () {
      const { lithoBase, owner } = await loadFixture(deployLithoBaseFixture);

      await expect(lithoBase.connect(owner).pause())
        .to.emit(lithoBase, 'EmergencyAction')
        .withArgs('pause', owner.address);
    });

    it('Should emit EmergencyAction event on unpause', async function () {
      const { lithoBase, owner } = await loadFixture(deployLithoBaseFixture);

      await lithoBase.connect(owner).pause();
      await expect(lithoBase.connect(owner).unpause())
        .to.emit(lithoBase, 'EmergencyAction')
        .withArgs('unpause', owner.address);
    });
  });

  describe('When Paused', function () {
    it('Should block actions when paused', async function () {
      const { lithoBase, owner } = await loadFixture(deployLithoBaseFixture);

      await lithoBase.connect(owner).pause();
      await expect(lithoBase.performAction()).to.be.revertedWithCustomError(
        lithoBase,
        'EnforcedPause'
      );
    });

    it('Should allow actions after unpause', async function () {
      const { lithoBase, owner } = await loadFixture(deployLithoBaseFixture);

      await lithoBase.connect(owner).pause();
      await lithoBase.connect(owner).unpause();

      await expect(lithoBase.performAction()).to.not.be.reverted;
      expect(await lithoBase.actionCount()).to.equal(1);
    });
  });
});
