const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultXBridge", function () {
  let bridge, token, owner, validator1, validator2, validator3, user;

  // Helper: sort signatures by signer address (ascending) as required by contract
  async function getSortedSignatures(signers, msgHash) {
    const signed = [];
    for (const signer of signers) {
      const sig = await signer.signMessage(ethers.utils.arrayify(msgHash));
      signed.push({ address: signer.address, sig });
    }
    signed.sort((a, b) => a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1);
    return signed.map(s => s.sig);
  }

  async function getReleaseHash(sourceTxHash, amount, sourceChain, sourceNonce) {
    const { chainId } = await ethers.provider.getNetwork();
    return ethers.utils.solidityKeccak256(
      ["bytes32", "address", "address", "uint256", "uint256", "uint256", "uint256", "address"],
      [sourceTxHash, token.address, user.address, amount, sourceChain, sourceNonce, chainId, bridge.address]
    );
  }

  beforeEach(async function () {
    [owner, validator1, validator2, validator3, user] = await ethers.getSigners();

    // Deploy MockERC20
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy("Lithosphere", "LITHO", 18);
    await token.deployed();

    // Deploy MultXBridge
    const MultXBridge = await ethers.getContractFactory("MultXBridge");
    const validators = [validator1.address, validator2.address, validator3.address];
    bridge = await MultXBridge.deploy(validators, 2);
    await bridge.deployed();

    // Add token to supported list
    await bridge.addSupportedToken(token.address);

    // Mint tokens to user
    await token.mint(user.address, ethers.utils.parseEther("1000"));
  });

  it("Should lock tokens", async function () {
    const amount = ethers.utils.parseEther("100");
    const targetChain = 1;

    await token.connect(user).approve(bridge.address, amount);

    const tx = await bridge.connect(user).lockTokens(token.address, amount, targetChain);
    const receipt = await tx.wait();

    const event = receipt.events.find(e => e.event === "TokensLocked");
    expect(event).to.exist;
    expect(event.args.token).to.equal(token.address);
    expect(event.args.user).to.equal(user.address);
    expect(event.args.amount).to.equal(amount);
    expect(event.args.targetChain).to.equal(targetChain);

    const bridgeBalance = await token.balanceOf(bridge.address);
    expect(bridgeBalance).to.equal(amount);
  });

  it("Should release tokens with valid signatures", async function () {
    const amount = ethers.utils.parseEther("100");
    const targetChain = 1;

    // Lock tokens first
    await token.connect(user).approve(bridge.address, amount);
    const lockTx = await bridge.connect(user).lockTokens(token.address, amount, targetChain);
    const lockReceipt = await lockTx.wait();
    const lockEvent = lockReceipt.events.find(e => e.event === "TokensLocked");
    const sourceTxHash = lockEvent.args.txHash;
    const sourceNonce = lockEvent.args.nonce;
    const sourceChain = 700777;

    // Create message hash
    const msgHash = await getReleaseHash(sourceTxHash, amount, sourceChain, sourceNonce);

    // Get sorted signatures from 2 validators
    const signatures = await getSortedSignatures([validator1, validator2], msgHash);

    // Release tokens
    const releaseTx = await bridge.releaseTokens(
      token.address,
      user.address,
      amount,
      sourceChain,
      sourceNonce,
      sourceTxHash,
      signatures
    );
    const releaseReceipt = await releaseTx.wait();

    const releaseEvent = releaseReceipt.events.find(e => e.event === "TokensReleased");
    expect(releaseEvent).to.exist;
    expect(releaseEvent.args.token).to.equal(token.address);
    expect(releaseEvent.args.user).to.equal(user.address);

    const userBalance = await token.balanceOf(user.address);
    expect(userBalance).to.equal(ethers.utils.parseEther("1000"));
  });

  it("Should reject duplicate nonce", async function () {
    const amount = ethers.utils.parseEther("100");
    const targetChain = 1;

    // Lock tokens
    await token.connect(user).approve(bridge.address, amount.mul(2));
    const lockTx = await bridge.connect(user).lockTokens(token.address, amount, targetChain);
    const lockReceipt = await lockTx.wait();
    const lockEvent = lockReceipt.events.find(e => e.event === "TokensLocked");
    const sourceTxHash = lockEvent.args.txHash;
    const sourceNonce = lockEvent.args.nonce;
    const sourceChain = 700777;

    const msgHash = await getReleaseHash(sourceTxHash, amount, sourceChain, sourceNonce);

    const signatures = await getSortedSignatures([validator1, validator2], msgHash);

    // Release tokens once
    await bridge.releaseTokens(
      token.address,
      user.address,
      amount,
      sourceChain,
      sourceNonce,
      sourceTxHash,
      signatures
    );

    // Try to release again with same nonce
    await expect(
      bridge.releaseTokens(
        token.address,
        user.address,
        amount,
        sourceChain,
        sourceNonce,
        sourceTxHash,
        signatures
      )
    ).to.be.revertedWith("Nonce already processed");
  });

  it("Should reject insufficient signatures", async function () {
    const amount = ethers.utils.parseEther("100");
    const targetChain = 1;

    await token.connect(user).approve(bridge.address, amount);
    const lockTx = await bridge.connect(user).lockTokens(token.address, amount, targetChain);
    const lockReceipt = await lockTx.wait();
    const lockEvent = lockReceipt.events.find(e => e.event === "TokensLocked");
    const sourceTxHash = lockEvent.args.txHash;
    const sourceNonce = lockEvent.args.nonce;
    const sourceChain = 700777;

    const msgHash = await getReleaseHash(sourceTxHash, amount, sourceChain, sourceNonce);

    const sig1 = await validator1.signMessage(ethers.utils.arrayify(msgHash));

    await expect(
      bridge.releaseTokens(
        token.address,
        user.address,
        amount,
        sourceChain,
        sourceNonce,
        sourceTxHash,
        [sig1]
      )
    ).to.be.revertedWith("Insufficient signatures");
  });

  it("Should reject signatures replayed on another destination bridge", async function () {
    const amount = ethers.utils.parseEther("10");
    const sourceTxHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("domain-replay"));
    const sourceChain = 9005;
    const sourceNonce = 44;
    const msgHash = await getReleaseHash(sourceTxHash, amount, sourceChain, sourceNonce);
    const signatures = await getSortedSignatures([validator1, validator2], msgHash);

    const MultXBridge = await ethers.getContractFactory("MultXBridge");
    const secondBridge = await MultXBridge.deploy(
      [validator1.address, validator2.address, validator3.address],
      2
    );
    await secondBridge.deployed();
    await token.transfer(secondBridge.address, amount);

    await expect(
      secondBridge.releaseTokens(
        token.address,
        user.address,
        amount,
        sourceChain,
        sourceNonce,
        sourceTxHash,
        signatures
      )
    ).to.be.revertedWith("Invalid signer");
  });

  describe("Pause guardian", function () {
    it("Owner can set and clear the pause guardian", async function () {
      await expect(bridge.setPauseGuardian(validator1.address))
        .to.emit(bridge, "PauseGuardianUpdated")
        .withArgs(ethers.constants.AddressZero, validator1.address);
      expect(await bridge.pauseGuardian()).to.equal(validator1.address);

      await bridge.setPauseGuardian(ethers.constants.AddressZero);
      expect(await bridge.pauseGuardian()).to.equal(ethers.constants.AddressZero);
    });

    it("Non-owner cannot set the pause guardian", async function () {
      await expect(
        bridge.connect(user).setPauseGuardian(user.address)
      ).to.be.reverted;
    });

    it("Guardian can pause but NOT unpause", async function () {
      await bridge.setPauseGuardian(validator1.address);

      await bridge.connect(validator1).pause();
      expect(await bridge.paused()).to.equal(true);

      // Guardian cannot resume — that's owner-only.
      await expect(
        bridge.connect(validator1).unpause()
      ).to.be.reverted;

      // Owner resumes.
      await bridge.unpause();
      expect(await bridge.paused()).to.equal(false);
    });

    it("Owner can still pause and unpause", async function () {
      await bridge.pause();
      expect(await bridge.paused()).to.equal(true);
      await bridge.unpause();
      expect(await bridge.paused()).to.equal(false);
    });

    it("A random address (neither owner nor guardian) cannot pause", async function () {
      await bridge.setPauseGuardian(validator1.address);
      await expect(
        bridge.connect(user).pause()
      ).to.be.revertedWith("Not owner or guardian");
    });

    it("Guardian cannot touch config (setValidatorSet / setDailyCap)", async function () {
      await bridge.setPauseGuardian(validator1.address);
      await expect(
        bridge.connect(validator1).setDailyCap(token.address, 1)
      ).to.be.reverted;
      await expect(
        bridge.connect(validator1).setValidatorSet([validator1.address], 1)
      ).to.be.reverted;
    });

    it("A guardian pause halts lockTokens", async function () {
      await bridge.setPauseGuardian(validator1.address);
      await bridge.connect(validator1).pause();
      const amount = ethers.utils.parseEther("1");
      await token.connect(user).approve(bridge.address, amount);
      await expect(
        bridge.connect(user).lockTokens(token.address, amount, 700777)
      ).to.be.revertedWith("EnforcedPause");
    });
  });
});
