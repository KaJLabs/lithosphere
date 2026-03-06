import { expect } from "chai";
import { ethers } from "hardhat";

describe("Lep100", function () {
  it("should deploy with correct name and symbol", async function () {
    const Lep100 = await ethers.getContractFactory("Lep100");
    const token = await Lep100.deploy("Lithosphere Token", "LITHO", "https://litho.ai/metadata/");

    expect(await token.name()).to.equal("Lithosphere Token");
    expect(await token.symbol()).to.equal("LITHO");
  });

  it("should start unpaused", async function () {
    const Lep100 = await ethers.getContractFactory("Lep100");
    const token = await Lep100.deploy("Lithosphere Token", "LITHO", "https://litho.ai/metadata/");

    expect(await token.paused()).to.equal(false);
  });

  it("should return correct URI for token ID", async function () {
    const Lep100 = await ethers.getContractFactory("Lep100");
    const token = await Lep100.deploy("Lithosphere Token", "LITHO", "https://litho.ai/metadata/");

    expect(await token.uri(1)).to.equal("https://litho.ai/metadata/1");
    expect(await token.uri(42)).to.equal("https://litho.ai/metadata/42");
  });

  it("should allow admin to pause and unpause", async function () {
    const [owner] = await ethers.getSigners();
    const Lep100 = await ethers.getContractFactory("Lep100");
    const token = await Lep100.deploy("Lithosphere Token", "LITHO", "https://litho.ai/metadata/");

    await token.pause();
    expect(await token.paused()).to.equal(true);

    await token.unpause();
    expect(await token.paused()).to.equal(false);
  });

  it("should allow minting and check balance", async function () {
    const [owner, recipient] = await ethers.getSigners();
    const Lep100 = await ethers.getContractFactory("Lep100");
    const token = await Lep100.deploy("Lithosphere Token", "LITHO", "https://litho.ai/metadata/");

    await token.mint(recipient.address, 1, 100, "0x");
    expect(await token.balanceOf(recipient.address, 1)).to.equal(100);
    expect(await token.totalSupply(1)).to.equal(100);
  });
});
