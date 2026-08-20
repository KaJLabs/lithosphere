const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WrappedLEP100", function () {
  let wrapped, admin, bridge, other, recipient;
  const NAME = "Wrapped wLITHO";
  const SYMBOL = "wwLITHO";
  const DECIMALS = 18;
  const ORIGIN_TOKEN = "0xC0FC628e3aB128fe387e7ed5e729bD809C017888"; // placeholder LITHO-side token
  const ORIGIN_CHAIN_ID = 9005;

  beforeEach(async function () {
    [admin, bridge, other, recipient] = await ethers.getSigners();

    const Wrapped = await ethers.getContractFactory("WrappedLEP100");
    wrapped = await Wrapped.deploy(
      NAME,
      SYMBOL,
      DECIMALS,
      bridge.address,
      ORIGIN_TOKEN,
      ORIGIN_CHAIN_ID
    );
    await wrapped.deployed();
  });

  describe("constructor", function () {
    it("Sets immutable metadata", async function () {
      expect(await wrapped.name()).to.equal(NAME);
      expect(await wrapped.symbol()).to.equal(SYMBOL);
      expect(await wrapped.decimals()).to.equal(DECIMALS);
      expect(await wrapped.bridge()).to.equal(bridge.address);
      expect(await wrapped.originToken()).to.equal(ORIGIN_TOKEN);
      expect(await wrapped.originChainId()).to.equal(ORIGIN_CHAIN_ID);
    });

    it("Has no administrator or mutable role interface", async function () {
      expect(wrapped.interface.functions["grantRole(bytes32,address)"]).to.equal(undefined);
      expect(wrapped.interface.functions["revokeRole(bytes32,address)"]).to.equal(undefined);
      expect(wrapped.interface.functions["transferOwnership(address)"]).to.equal(undefined);
    });

    it("Reverts on zero bridge address", async function () {
      const Wrapped = await ethers.getContractFactory("WrappedLEP100");
      await expect(
        Wrapped.deploy(NAME, SYMBOL, DECIMALS, ethers.constants.AddressZero, ORIGIN_TOKEN, ORIGIN_CHAIN_ID)
      ).to.be.revertedWith("Bridge address required");
    });

    it("Reverts on zero origin token", async function () {
      const Wrapped = await ethers.getContractFactory("WrappedLEP100");
      await expect(
        Wrapped.deploy(NAME, SYMBOL, DECIMALS, bridge.address, ethers.constants.AddressZero, ORIGIN_CHAIN_ID)
      ).to.be.revertedWith("Origin token required");
    });

    it("Reverts on zero origin chain id", async function () {
      const Wrapped = await ethers.getContractFactory("WrappedLEP100");
      await expect(
        Wrapped.deploy(NAME, SYMBOL, DECIMALS, bridge.address, ORIGIN_TOKEN, 0)
      ).to.be.revertedWith("Origin chain id required");
    });
  });

  describe("bridgeMint", function () {
    it("Mints tokens when called by the immutable bridge", async function () {
      const amount = ethers.utils.parseEther("100");
      await wrapped.connect(bridge).bridgeMint(recipient.address, amount);

      expect(await wrapped.balanceOf(recipient.address)).to.equal(amount);
      expect(await wrapped.totalSupply()).to.equal(amount);
    });

    it("Emits BridgeMint event", async function () {
      const amount = ethers.utils.parseEther("50");
      await expect(wrapped.connect(bridge).bridgeMint(recipient.address, amount))
        .to.emit(wrapped, "BridgeMint")
        .withArgs(recipient.address, amount);
    });

    it("Reverts when called by a non-bridge account", async function () {
      const amount = ethers.utils.parseEther("100");
      await expect(
        wrapped.connect(other).bridgeMint(recipient.address, amount)
      ).to.be.revertedWith("Only bridge");
    });

    it("Reverts when called by the deployer instead of the bridge", async function () {
      const amount = ethers.utils.parseEther("100");
      await expect(
        wrapped.connect(admin).bridgeMint(recipient.address, amount)
      ).to.be.revertedWith("Only bridge");
    });

    it("Accumulates supply across multiple mints", async function () {
      await wrapped.connect(bridge).bridgeMint(recipient.address, ethers.utils.parseEther("10"));
      await wrapped.connect(bridge).bridgeMint(recipient.address, ethers.utils.parseEther("20"));
      await wrapped.connect(bridge).bridgeMint(other.address, ethers.utils.parseEther("5"));

      expect(await wrapped.balanceOf(recipient.address)).to.equal(ethers.utils.parseEther("30"));
      expect(await wrapped.balanceOf(other.address)).to.equal(ethers.utils.parseEther("5"));
      expect(await wrapped.totalSupply()).to.equal(ethers.utils.parseEther("35"));
    });
  });

  describe("burn / burnFrom", function () {
    beforeEach(async function () {
      // Pre-mint some balance for the holder
      await wrapped.connect(bridge).bridgeMint(recipient.address, ethers.utils.parseEther("100"));
    });

    it("Holder can burn their own balance", async function () {
      const amount = ethers.utils.parseEther("30");
      await wrapped.connect(recipient).burn(amount);

      expect(await wrapped.balanceOf(recipient.address)).to.equal(ethers.utils.parseEther("70"));
      expect(await wrapped.totalSupply()).to.equal(ethers.utils.parseEther("70"));
    });

    it("burnFrom requires allowance", async function () {
      const amount = ethers.utils.parseEther("10");
      await expect(
        wrapped.connect(other).burnFrom(recipient.address, amount)
      ).to.be.reverted; // ERC20InsufficientAllowance
    });

    it("Bridge can burnFrom after approval (reverse-bridge flow)", async function () {
      const amount = ethers.utils.parseEther("40");
      await wrapped.connect(recipient).approve(bridge.address, amount);
      await wrapped.connect(bridge).burnFrom(recipient.address, amount);

      expect(await wrapped.balanceOf(recipient.address)).to.equal(ethers.utils.parseEther("60"));
      expect(await wrapped.totalSupply()).to.equal(ethers.utils.parseEther("60"));
    });

    it("Cannot burn more than balance", async function () {
      const amount = ethers.utils.parseEther("1000");
      await expect(wrapped.connect(recipient).burn(amount)).to.be.reverted;
    });
  });

  describe("immutable mint authority", function () {
    it("Cannot introduce or replace a second minter", async function () {
      expect(await wrapped.bridge()).to.equal(bridge.address);
      expect(wrapped.interface.functions["setBridge(address)"]).to.equal(undefined);
      await expect(
        wrapped.connect(other).bridgeMint(recipient.address, ethers.utils.parseEther("1"))
      ).to.be.revertedWith("Only bridge");
    });
  });

  describe("ERC20 standard transfers", function () {
    beforeEach(async function () {
      await wrapped.connect(bridge).bridgeMint(recipient.address, ethers.utils.parseEther("100"));
    });

    it("Holder can transfer wrapped tokens", async function () {
      await wrapped.connect(recipient).transfer(other.address, ethers.utils.parseEther("25"));
      expect(await wrapped.balanceOf(recipient.address)).to.equal(ethers.utils.parseEther("75"));
      expect(await wrapped.balanceOf(other.address)).to.equal(ethers.utils.parseEther("25"));
    });

    it("approve + transferFrom works", async function () {
      await wrapped.connect(recipient).approve(other.address, ethers.utils.parseEther("40"));
      await wrapped.connect(other).transferFrom(recipient.address, other.address, ethers.utils.parseEther("40"));
      expect(await wrapped.balanceOf(other.address)).to.equal(ethers.utils.parseEther("40"));
    });
  });
});
