const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultXBridgeDest", function () {
  let bridge, wrapped, owner, v1, v2, v3, user;
  const ORIGIN_TOKEN = "0xC0FC628e3aB128fe387e7ed5e729bD809C017888";
  const ORIGIN_CHAIN_ID = 900523; // Kamet
  const TARGET_CHAIN = ORIGIN_CHAIN_ID; // Reverse-bridge target is always source (Kamet)
  const HARDHAT_CHAIN_ID = 700777; // Default hardhat chainId per repo config

  async function getSortedSignatures(signers, msgHash) {
    const signed = [];
    for (const signer of signers) {
      const sig = await signer.signMessage(ethers.utils.arrayify(msgHash));
      signed.push({ address: signer.address, sig });
    }
    signed.sort((a, b) => a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1);
    return signed.map((s) => s.sig);
  }

  beforeEach(async function () {
    [owner, v1, v2, v3, user] = await ethers.getSigners();

    const MultXBridgeDest = await ethers.getContractFactory("MultXBridgeDest");
    bridge = await MultXBridgeDest.deploy([v1.address, v2.address, v3.address], 2);
    await bridge.deployed();

    const WrappedLEP100 = await ethers.getContractFactory("WrappedLEP100");
    wrapped = await WrappedLEP100.deploy(
      "Wrapped wLITHO",
      "wwLITHO",
      18,
      bridge.address,
      ORIGIN_TOKEN,
      ORIGIN_CHAIN_ID
    );
    await wrapped.deployed();

    await bridge.addSupportedToken(wrapped.address);

    // Pre-mint the user some wrapped tokens (simulates a prior bridge-in)
    // BRIDGE_ROLE was granted to the bridge contract by the WrappedLEP100 ctor,
    // so we go through the bridge — but for test simplicity we'll grant the owner
    // BRIDGE_ROLE temporarily to seed balances directly.
    const BRIDGE_ROLE = ethers.utils.id("BRIDGE_ROLE");
    await wrapped.grantRole(BRIDGE_ROLE, owner.address);
    await wrapped.bridgeMint(user.address, ethers.utils.parseEther("1000"));
    await wrapped.revokeRole(BRIDGE_ROLE, owner.address);
  });

  describe("constructor", function () {
    it("Stores validators and threshold", async function () {
      expect(await bridge.getValidators()).to.deep.equal([v1.address, v2.address, v3.address]);
      expect(await bridge.signaturesRequired()).to.equal(2);
    });

    it("Reverts on empty validator set", async function () {
      const Bridge = await ethers.getContractFactory("MultXBridgeDest");
      await expect(Bridge.deploy([], 1)).to.be.revertedWith("At least one validator required");
    });

    it("Reverts on threshold > validators.length", async function () {
      const Bridge = await ethers.getContractFactory("MultXBridgeDest");
      await expect(Bridge.deploy([v1.address], 2)).to.be.revertedWith("Invalid signatures required");
    });

    it("Reverts on zero validator address", async function () {
      const Bridge = await ethers.getContractFactory("MultXBridgeDest");
      await expect(
        Bridge.deploy([v1.address, ethers.constants.AddressZero], 1)
      ).to.be.revertedWith("Invalid validator address");
    });
  });

  describe("lockTokens (reverse direction — burn wrapped, target Kamet)", function () {
    it("Burns the user's wrapped balance and emits TokensLocked", async function () {
      const amount = ethers.utils.parseEther("50");
      await wrapped.connect(user).approve(bridge.address, amount);

      const tx = await bridge.connect(user).lockTokens(wrapped.address, amount, TARGET_CHAIN);
      const receipt = await tx.wait();

      const event = receipt.events.find((e) => e.event === "TokensLocked");
      expect(event).to.exist;
      expect(event.args.token).to.equal(wrapped.address);
      expect(event.args.user).to.equal(user.address);
      expect(event.args.amount).to.equal(amount);
      expect(event.args.targetChain).to.equal(TARGET_CHAIN);

      // User's wrapped balance dropped
      expect(await wrapped.balanceOf(user.address)).to.equal(ethers.utils.parseEther("950"));
      // Bridge does NOT hold wrapped tokens — they are burned, not transferred
      expect(await wrapped.balanceOf(bridge.address)).to.equal(0);
      // Total supply decreased
      expect(await wrapped.totalSupply()).to.equal(ethers.utils.parseEther("950"));
    });

    it("Rejects unsupported tokens", async function () {
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const unsupported = await MockERC20.deploy("Random", "RAND", 18);
      await unsupported.deployed();

      await expect(
        bridge.connect(user).lockTokens(unsupported.address, ethers.utils.parseEther("1"), TARGET_CHAIN)
      ).to.be.revertedWith("Token not supported");
    });

    it("Rejects zero amount", async function () {
      await expect(
        bridge.connect(user).lockTokens(wrapped.address, 0, TARGET_CHAIN)
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Rejects targetChain == current chain", async function () {
      await wrapped.connect(user).approve(bridge.address, ethers.utils.parseEther("1"));
      await expect(
        bridge.connect(user).lockTokens(wrapped.address, ethers.utils.parseEther("1"), HARDHAT_CHAIN_ID)
      ).to.be.revertedWith("Target chain cannot be current chain");
    });

    it("Requires the bridge to have a burn allowance", async function () {
      // No approve called
      await expect(
        bridge.connect(user).lockTokens(wrapped.address, ethers.utils.parseEther("1"), TARGET_CHAIN)
      ).to.be.reverted;
    });
  });

  describe("releaseTokens (forward direction — mint wrapped via bridgeMint)", function () {
    it("Mints wrapped tokens with valid sigs", async function () {
      const amount = ethers.utils.parseEther("75");
      const sourceTxHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("source-tx-1"));
      const sourceChain = ORIGIN_CHAIN_ID; // Kamet lock observed here
      const sourceNonce = 1;

      const msgHash = ethers.utils.solidityKeccak256(
        ["bytes32", "address", "address", "uint256", "uint256", "uint256"],
        [sourceTxHash, wrapped.address, user.address, amount, sourceChain, sourceNonce]
      );
      const signatures = await getSortedSignatures([v1, v2], msgHash);

      const tx = await bridge.releaseTokens(
        wrapped.address, user.address, amount, sourceChain, sourceNonce, sourceTxHash, signatures
      );
      const receipt = await tx.wait();

      const event = receipt.events.find((e) => e.event === "TokensReleased");
      expect(event).to.exist;
      expect(event.args.user).to.equal(user.address);
      expect(event.args.amount).to.equal(amount);

      // User received freshly-minted wrapped tokens (plus the 1000 pre-existing)
      expect(await wrapped.balanceOf(user.address)).to.equal(ethers.utils.parseEther("1075"));
      // Total supply went up
      expect(await wrapped.totalSupply()).to.equal(ethers.utils.parseEther("1075"));
    });

    it("Rejects duplicate sourceNonce on the same sourceChain", async function () {
      const amount = ethers.utils.parseEther("10");
      const sourceTxHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("source-tx-dup"));
      const sourceChain = ORIGIN_CHAIN_ID;
      const sourceNonce = 7;

      const msgHash = ethers.utils.solidityKeccak256(
        ["bytes32", "address", "address", "uint256", "uint256", "uint256"],
        [sourceTxHash, wrapped.address, user.address, amount, sourceChain, sourceNonce]
      );
      const sigs = await getSortedSignatures([v1, v2], msgHash);

      await bridge.releaseTokens(wrapped.address, user.address, amount, sourceChain, sourceNonce, sourceTxHash, sigs);

      await expect(
        bridge.releaseTokens(wrapped.address, user.address, amount, sourceChain, sourceNonce, sourceTxHash, sigs)
      ).to.be.revertedWith("Nonce already processed");
    });

    it("Rejects fewer signatures than required", async function () {
      const amount = ethers.utils.parseEther("5");
      const sourceTxHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("source-tx-2"));
      const msgHash = ethers.utils.solidityKeccak256(
        ["bytes32", "address", "address", "uint256", "uint256", "uint256"],
        [sourceTxHash, wrapped.address, user.address, amount, ORIGIN_CHAIN_ID, 2]
      );
      const sig1 = await v1.signMessage(ethers.utils.arrayify(msgHash));

      await expect(
        bridge.releaseTokens(wrapped.address, user.address, amount, ORIGIN_CHAIN_ID, 2, sourceTxHash, [sig1])
      ).to.be.revertedWith("Insufficient signatures");
    });

    it("Rejects out-of-order signatures (non-ascending signer address)", async function () {
      const amount = ethers.utils.parseEther("5");
      const sourceTxHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("source-tx-3"));
      const msgHash = ethers.utils.solidityKeccak256(
        ["bytes32", "address", "address", "uint256", "uint256", "uint256"],
        [sourceTxHash, wrapped.address, user.address, amount, ORIGIN_CHAIN_ID, 3]
      );

      // Get sorted, then reverse — guarantees out-of-order
      const sortedSigs = await getSortedSignatures([v1, v2], msgHash);
      const reversed = [...sortedSigs].reverse();

      await expect(
        bridge.releaseTokens(wrapped.address, user.address, amount, ORIGIN_CHAIN_ID, 3, sourceTxHash, reversed)
      ).to.be.revertedWith("Signatures must be in ascending order");
    });

    it("Rejects signatures from unknown signer", async function () {
      const amount = ethers.utils.parseEther("5");
      const sourceTxHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("source-tx-4"));
      const msgHash = ethers.utils.solidityKeccak256(
        ["bytes32", "address", "address", "uint256", "uint256", "uint256"],
        [sourceTxHash, wrapped.address, user.address, amount, ORIGIN_CHAIN_ID, 4]
      );

      // `user` is NOT a validator
      const sigs = await getSortedSignatures([v1, user], msgHash);

      await expect(
        bridge.releaseTokens(wrapped.address, user.address, amount, ORIGIN_CHAIN_ID, 4, sourceTxHash, sigs)
      ).to.be.revertedWith("Invalid signer");
    });
  });

  describe("pause / unpause", function () {
    it("Owner can pause and unpause", async function () {
      expect(await bridge.paused()).to.equal(false);
      await bridge.pause();
      expect(await bridge.paused()).to.equal(true);
      await bridge.unpause();
      expect(await bridge.paused()).to.equal(false);
    });

    it("Non-owner cannot pause", async function () {
      await expect(bridge.connect(user).pause()).to.be.reverted;
    });

    it("lockTokens reverts when paused", async function () {
      await bridge.pause();
      await wrapped.connect(user).approve(bridge.address, ethers.utils.parseEther("1"));
      await expect(
        bridge.connect(user).lockTokens(wrapped.address, ethers.utils.parseEther("1"), TARGET_CHAIN)
      ).to.be.revertedWith("EnforcedPause");
    });

    it("releaseTokens reverts when paused", async function () {
      await bridge.pause();
      const amount = ethers.utils.parseEther("1");
      const sourceTxHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("paused-test"));
      const msgHash = ethers.utils.solidityKeccak256(
        ["bytes32", "address", "address", "uint256", "uint256", "uint256"],
        [sourceTxHash, wrapped.address, user.address, amount, ORIGIN_CHAIN_ID, 99]
      );
      const sigs = await getSortedSignatures([v1, v2], msgHash);
      await expect(
        bridge.releaseTokens(wrapped.address, user.address, amount, ORIGIN_CHAIN_ID, 99, sourceTxHash, sigs)
      ).to.be.revertedWith("EnforcedPause");
    });
  });

  describe("setValidatorSet", function () {
    it("Owner can rotate the validator set atomically", async function () {
      const [, , , , , v4, v5, v6, v7] = await ethers.getSigners();
      const newSet = [v1.address, v4.address, v5.address, v6.address, v7.address];
      await bridge.setValidatorSet(newSet, 3);

      expect(await bridge.getValidators()).to.deep.equal(newSet);
      expect(await bridge.signaturesRequired()).to.equal(3);
      // Old validators v2, v3 should no longer be recognized
      expect(await bridge.isValidator(v2.address)).to.equal(false);
      expect(await bridge.isValidator(v3.address)).to.equal(false);
      // New ones are
      expect(await bridge.isValidator(v4.address)).to.equal(true);
    });

    it("Emits ValidatorSetUpdated", async function () {
      const [, , , , , v4] = await ethers.getSigners();
      const newSet = [v1.address, v4.address];
      await expect(bridge.setValidatorSet(newSet, 2))
        .to.emit(bridge, "ValidatorSetUpdated")
        .withArgs(newSet, 2);
    });

    it("Rejects empty set", async function () {
      await expect(bridge.setValidatorSet([], 0)).to.be.revertedWith("At least one validator required");
    });

    it("Rejects threshold > validator count", async function () {
      await expect(bridge.setValidatorSet([v1.address], 2)).to.be.revertedWith("Invalid signatures required");
    });

    it("Non-owner cannot call", async function () {
      await expect(bridge.connect(user).setValidatorSet([v1.address], 1)).to.be.reverted;
    });
  });

  describe("daily caps", function () {
    const CAP = ethers.utils.parseEther("100");

    beforeEach(async function () {
      await bridge.setDailyCap(wrapped.address, CAP);
    });

    it("getDailyRemaining returns the cap before any locks", async function () {
      expect(await bridge.getDailyRemaining(wrapped.address)).to.equal(CAP);
    });

    it("Tracks cumulative volume within the 24h window", async function () {
      await wrapped.connect(user).approve(bridge.address, ethers.constants.MaxUint256);
      await bridge.connect(user).lockTokens(wrapped.address, ethers.utils.parseEther("30"), TARGET_CHAIN);
      expect(await bridge.getDailyRemaining(wrapped.address)).to.equal(ethers.utils.parseEther("70"));
      await bridge.connect(user).lockTokens(wrapped.address, ethers.utils.parseEther("20"), TARGET_CHAIN);
      expect(await bridge.getDailyRemaining(wrapped.address)).to.equal(ethers.utils.parseEther("50"));
    });

    it("Reverts when cap exceeded", async function () {
      await wrapped.connect(user).approve(bridge.address, ethers.constants.MaxUint256);
      await bridge.connect(user).lockTokens(wrapped.address, ethers.utils.parseEther("80"), TARGET_CHAIN);
      await expect(
        bridge.connect(user).lockTokens(wrapped.address, ethers.utils.parseEther("30"), TARGET_CHAIN)
      ).to.be.revertedWith("Daily cap exceeded");
    });

    it("cap == 0 means unlimited", async function () {
      await bridge.setDailyCap(wrapped.address, 0);
      // getDailyRemaining returns max-uint when cap is 0
      expect(await bridge.getDailyRemaining(wrapped.address)).to.equal(ethers.constants.MaxUint256);

      await wrapped.connect(user).approve(bridge.address, ethers.constants.MaxUint256);
      // Large lock succeeds
      await bridge.connect(user).lockTokens(wrapped.address, ethers.utils.parseEther("500"), TARGET_CHAIN);
    });

    it("Resets after 24h", async function () {
      await wrapped.connect(user).approve(bridge.address, ethers.constants.MaxUint256);
      await bridge.connect(user).lockTokens(wrapped.address, ethers.utils.parseEther("90"), TARGET_CHAIN);
      expect(await bridge.getDailyRemaining(wrapped.address)).to.equal(ethers.utils.parseEther("10"));

      // Advance time by >24h
      await ethers.provider.send("evm_increaseTime", [86400 + 1]);
      await ethers.provider.send("evm_mine");

      expect(await bridge.getDailyRemaining(wrapped.address)).to.equal(CAP);
    });

    it("Emits DailyCapSet", async function () {
      await expect(bridge.setDailyCap(wrapped.address, ethers.utils.parseEther("250")))
        .to.emit(bridge, "DailyCapSet")
        .withArgs(wrapped.address, ethers.utils.parseEther("250"));
    });
  });

  describe("Pause guardian", function () {
    it("Owner can set and clear the pause guardian", async function () {
      await expect(bridge.setPauseGuardian(v1.address))
        .to.emit(bridge, "PauseGuardianUpdated")
        .withArgs(ethers.constants.AddressZero, v1.address);
      expect(await bridge.pauseGuardian()).to.equal(v1.address);

      await bridge.setPauseGuardian(ethers.constants.AddressZero);
      expect(await bridge.pauseGuardian()).to.equal(ethers.constants.AddressZero);
    });

    it("Non-owner cannot set the pause guardian", async function () {
      await expect(bridge.connect(user).setPauseGuardian(user.address)).to.be.reverted;
    });

    it("Guardian can pause but NOT unpause", async function () {
      await bridge.setPauseGuardian(v1.address);
      await bridge.connect(v1).pause();
      expect(await bridge.paused()).to.equal(true);
      await expect(bridge.connect(v1).unpause()).to.be.reverted;
      await bridge.unpause();
      expect(await bridge.paused()).to.equal(false);
    });

    it("A random address (neither owner nor guardian) cannot pause", async function () {
      await bridge.setPauseGuardian(v1.address);
      await expect(bridge.connect(user).pause()).to.be.revertedWith("Not owner or guardian");
    });

    it("Guardian cannot touch config (setValidatorSet / setDailyCap)", async function () {
      await bridge.setPauseGuardian(v1.address);
      await expect(bridge.connect(v1).setDailyCap(wrapped.address, 1)).to.be.reverted;
      await expect(bridge.connect(v1).setValidatorSet([v1.address], 1)).to.be.reverted;
    });

    it("A guardian pause halts lockTokens", async function () {
      await bridge.setPauseGuardian(v1.address);
      await bridge.connect(v1).pause();
      await wrapped.connect(user).approve(bridge.address, ethers.utils.parseEther("1"));
      await expect(
        bridge.connect(user).lockTokens(wrapped.address, ethers.utils.parseEther("1"), TARGET_CHAIN)
      ).to.be.revertedWith("EnforcedPause");
    });
  });
});
