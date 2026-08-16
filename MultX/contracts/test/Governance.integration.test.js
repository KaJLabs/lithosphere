const { expect } = require("chai");
const { ethers } = require("hardhat");

// End-to-end proof of the approved bridge governance design:
//   bridge.owner       = TimelockController (48h delay)
//     proposer/executor = "Safe" (an EOA stand-in here; the delay mechanic is
//                          identical whether the proposer is a Safe or an EOA)
//   bridge.pauseGuardian = fast ops key (instant pause, cannot unpause/config)
//
// Demonstrates: guardian pauses instantly; resume + validator rotation are
// gated behind the 48h timelock; nobody outside the timelock can change config.
describe("Bridge governance (Safe-stand-in + Timelock + guardian)", function () {
  const DELAY = 48 * 60 * 60; // 48h
  const ZERO = ethers.constants.HashZero;
  let bridge, timelock, deployer, safe, guardian, v1, v2, v3, v4, user;

  async function warp(seconds) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
  }

  beforeEach(async function () {
    [deployer, safe, guardian, v1, v2, v3, v4, user] = await ethers.getSigners();

    const MultXBridge = await ethers.getContractFactory("MultXBridge");
    bridge = await MultXBridge.deploy([v1.address, v2.address, v3.address], 2);
    await bridge.deployed();

    // Timelock: "safe" is the sole proposer + executor; no admin (self-governed).
    const GovTimelock = await ethers.getContractFactory("GovTimelock");
    timelock = await GovTimelock.deploy(DELAY, [safe.address], [safe.address], ethers.constants.AddressZero);
    await timelock.deployed();

    // Wire governance: guardian first (needs owner), then hand owner to timelock.
    await bridge.setPauseGuardian(guardian.address);
    await bridge.transferOwnership(timelock.address);
  });

  it("owner is the timelock; guardian is the ops key", async function () {
    expect(await bridge.owner()).to.equal(timelock.address);
    expect(await bridge.pauseGuardian()).to.equal(guardian.address);
  });

  it("guardian pauses instantly (no delay)", async function () {
    await bridge.connect(guardian).pause();
    expect(await bridge.paused()).to.equal(true);
  });

  it("nobody outside the timelock can rotate validators directly", async function () {
    // deployer (former owner), guardian, and a random user all rejected.
    await expect(bridge.connect(deployer).setValidatorSet([v1.address], 1)).to.be.reverted;
    await expect(bridge.connect(guardian).setValidatorSet([v1.address], 1)).to.be.reverted;
    await expect(bridge.connect(user).setValidatorSet([v1.address], 1)).to.be.reverted;
  });

  it("validator rotation only executes after the 48h timelock delay", async function () {
    const newSet = [v1.address, v2.address, v3.address, v4.address];
    const data = bridge.interface.encodeFunctionData("setValidatorSet", [newSet, 3]);
    const salt = ethers.utils.id("rotate-to-4");

    // Safe schedules the operation.
    await timelock.connect(safe).schedule(bridge.address, 0, data, ZERO, salt, DELAY);

    // Executing before the delay elapses must revert.
    await expect(
      timelock.connect(safe).execute(bridge.address, 0, data, ZERO, salt)
    ).to.be.reverted;

    // Warp past the delay, then execute.
    await warp(DELAY + 1);
    await timelock.connect(safe).execute(bridge.address, 0, data, ZERO, salt);

    expect(await bridge.signaturesRequired()).to.equal(3);
    expect(await bridge.getValidatorCount()).to.equal(4);
    expect(await bridge.isValidator(v4.address)).to.equal(true);
  });

  it("resume (unpause) is also gated behind the timelock", async function () {
    await bridge.connect(guardian).pause();
    expect(await bridge.paused()).to.equal(true);

    const data = bridge.interface.encodeFunctionData("unpause", []);
    const salt = ethers.utils.id("resume");
    await timelock.connect(safe).schedule(bridge.address, 0, data, ZERO, salt, DELAY);

    await expect(
      timelock.connect(safe).execute(bridge.address, 0, data, ZERO, salt)
    ).to.be.reverted;

    await warp(DELAY + 1);
    await timelock.connect(safe).execute(bridge.address, 0, data, ZERO, salt);
    expect(await bridge.paused()).to.equal(false);
  });

  it("a scheduled operation can be cancelled by the Safe before execution", async function () {
    const data = bridge.interface.encodeFunctionData("setDailyCap", [v1.address, 1]);
    const salt = ethers.utils.id("cap");
    await timelock.connect(safe).schedule(bridge.address, 0, data, ZERO, salt, DELAY);
    const opId = await timelock.hashOperation(bridge.address, 0, data, ZERO, salt);
    expect(await timelock.isOperationPending(opId)).to.equal(true);

    await timelock.connect(safe).cancel(opId);
    expect(await timelock.isOperation(opId)).to.equal(false);
  });
});
