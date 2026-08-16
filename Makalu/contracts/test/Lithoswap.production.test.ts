import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";

describe("Lithoswap V2 production invariants", function () {
  const e18 = (value: bigint | number | string) => ethers.parseUnits(value.toString(), 18);

  async function fixture() {
    const [owner, feeCollector, lp, trader, other] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockERC20");
    const tokenA = await Mock.deploy("Token A", "AAA");
    const tokenB = await Mock.deploy("Token B", "BBB");
    const tokenC = await Mock.deploy("Token C", "CCC");
    const Factory = await ethers.getContractFactory("LithoswapV2Factory");
    const factory = await Factory.deploy(owner.address);
    const Router = await ethers.getContractFactory("LithoswapV2Router02");
    const router = await Router.deploy(await factory.getAddress(), await tokenB.getAddress());
    const routerAddress = await router.getAddress();
    for (const token of [tokenA, tokenB, tokenC]) {
      await token.mint(lp.address, e18(100_000));
      await token.mint(trader.address, e18(100_000));
      await token.connect(lp).approve(routerAddress, ethers.MaxUint256);
      await token.connect(trader).approve(routerAddress, ethers.MaxUint256);
    }
    return { owner, feeCollector, lp, trader, other, tokenA, tokenB, tokenC, factory, router };
  }

  async function addLiquidity(
    state: Awaited<ReturnType<typeof fixture>>,
    tokenA = state.tokenA,
    tokenB = state.tokenB,
    amountA = e18(1_000),
    amountB = e18(1_000),
  ) {
    const deadline = (await time.latest()) + 3600;
    await state.router.connect(state.lp).addLiquidity(
      await tokenA.getAddress(),
      await tokenB.getAddress(),
      amountA,
      amountB,
      amountA,
      amountB,
      state.lp.address,
      deadline,
    );
    const pairAddress = await state.factory.getPair(await tokenA.getAddress(), await tokenB.getAddress());
    return ethers.getContractAt("LithoswapV2Pair", pairAddress);
  }

  describe("deployment and administration", function () {
    it("rejects zero critical constructor addresses", async function () {
      const Factory = await ethers.getContractFactory("LithoswapV2Factory");
      await expect(Factory.deploy(ethers.ZeroAddress)).to.be.revertedWith("Lithoswap: ZERO_FEE_SETTER");
      const Router = await ethers.getContractFactory("LithoswapV2Router02");
      await expect(Router.deploy(ethers.ZeroAddress, ethers.ZeroAddress)).to.be.revertedWith("LithoswapRouter: ZERO_FACTORY");
      const state = await loadFixture(fixture);
      await expect(Router.deploy(await state.factory.getAddress(), ethers.ZeroAddress)).to.be.revertedWith("LithoswapRouter: ZERO_WLITHO");
    });

    it("creates a sorted deterministic pair and rejects invalid duplicates", async function () {
      const state = await loadFixture(fixture);
      const a = await state.tokenA.getAddress();
      const b = await state.tokenB.getAddress();
      await expect(state.factory.createPair(a, a)).to.be.revertedWith("Lithoswap: IDENTICAL_ADDRESSES");
      await expect(state.factory.createPair(ethers.ZeroAddress, a)).to.be.revertedWith("Lithoswap: ZERO_ADDRESS");
      await expect(state.factory.createPair(a, b)).to.emit(state.factory, "PairCreated");
      expect(await state.factory.getPair(a, b)).to.equal(await state.factory.getPair(b, a));
      expect(await state.factory.allPairs(0)).to.equal(await state.factory.getPair(a, b));
      await expect(state.factory.createPair(b, a)).to.be.revertedWith("Lithoswap: PAIR_EXISTS");
    });

    it("restricts fee configuration and safely rotates the controller", async function () {
      const state = await loadFixture(fixture);
      await expect(state.factory.connect(state.other).setFeeTo(state.feeCollector.address)).to.be.revertedWith("Lithoswap: FORBIDDEN");
      await state.factory.setFeeTo(state.feeCollector.address);
      expect(await state.factory.feeTo()).to.equal(state.feeCollector.address);
      await expect(state.factory.setFeeToSetter(ethers.ZeroAddress)).to.be.revertedWith("Lithoswap: ZERO_FEE_SETTER");
      await state.factory.setFeeToSetter(state.other.address);
      await expect(state.factory.setFeeTo(ethers.ZeroAddress)).to.be.revertedWith("Lithoswap: FORBIDDEN");
      await state.factory.connect(state.other).setFeeTo(ethers.ZeroAddress);
      expect(await state.factory.feeTo()).to.equal(ethers.ZeroAddress);
    });

    it("prevents unauthorized and repeated pair initialization", async function () {
      const state = await loadFixture(fixture);
      const Pair = await ethers.getContractFactory("LithoswapV2Pair", state.owner);
      const pair = await Pair.deploy();
      await expect(pair.connect(state.other).initialize(await state.tokenA.getAddress(), await state.tokenB.getAddress()))
        .to.be.revertedWith("Lithoswap: FORBIDDEN");
      await pair.initialize(await state.tokenA.getAddress(), await state.tokenB.getAddress());
      await expect(pair.initialize(await state.tokenA.getAddress(), await state.tokenC.getAddress()))
        .to.be.revertedWith("Lithoswap: ALREADY_INITIALIZED");
    });
  });

  describe("liquidity and LP accounting", function () {
    it("rejects expired liquidity operations and adverse existing-pool ratios", async function () {
      const state = await loadFixture(fixture);
      const a = await state.tokenA.getAddress();
      const b = await state.tokenB.getAddress();
      await expect(state.router.connect(state.lp).addLiquidity(a, b, e18(10), e18(10), 0, 0, state.lp.address, 1))
        .to.be.revertedWith("LithoswapRouter: EXPIRED");
      await addLiquidity(state);
      const deadline = (await time.latest()) + 3600;
      await expect(state.router.connect(state.lp).addLiquidity(a, b, e18(100), e18(80), e18(100), e18(80), state.lp.address, deadline))
        .to.be.revertedWith("LithoswapRouter: INSUFFICIENT_A_AMOUNT");
    });

    it("preserves infinite LP allowance and enforces removal minima", async function () {
      const state = await loadFixture(fixture);
      const pair = await addLiquidity(state);
      const pairAddress = await pair.getAddress();
      const liquidity = await pair.balanceOf(state.lp.address);
      await pair.connect(state.lp).approve(state.other.address, ethers.MaxUint256);
      await pair.connect(state.other).transferFrom(state.lp.address, state.other.address, liquidity / 10n);
      expect(await pair.allowance(state.lp.address, state.other.address)).to.equal(ethers.MaxUint256);
      const owned = await pair.balanceOf(state.other.address);
      await pair.connect(state.other).approve(await state.router.getAddress(), owned);
      const deadline = (await time.latest()) + 3600;
      await expect(state.router.connect(state.other).removeLiquidity(
        await state.tokenA.getAddress(),
        await state.tokenB.getAddress(),
        owned,
        e18(1_000),
        e18(1_000),
        state.other.address,
        deadline,
      )).to.be.revertedWith("LithoswapRouter: INSUFFICIENT_A_AMOUNT");
      expect(await pair.getAddress()).to.equal(pairAddress);
    });

    it("mints protocol fees only after fee-on K growth", async function () {
      const state = await loadFixture(fixture);
      await state.factory.setFeeTo(state.feeCollector.address);
      const pair = await addLiquidity(state);
      expect(await pair.kLast()).to.be.greaterThan(0n);
      const path = [await state.tokenA.getAddress(), await state.tokenB.getAddress()];
      const deadline = (await time.latest()) + 3600;
      const quote = await state.router.getAmountsOut(e18(100), path);
      await state.router.connect(state.trader).swapExactTokensForTokens(e18(100), quote[1], path, state.trader.address, deadline);
      await state.router.connect(state.lp).addLiquidity(path[0], path[1], e18(100), e18(100), 0, 0, state.lp.address, deadline);
      expect(await pair.balanceOf(state.feeCollector.address)).to.be.greaterThan(0n);
    });
  });

  describe("pricing and swaps", function () {
    it("executes exact-output swaps and rejects excessive input", async function () {
      const state = await loadFixture(fixture);
      await addLiquidity(state);
      const path = [await state.tokenA.getAddress(), await state.tokenB.getAddress()];
      const amountOut = e18(10);
      const amounts = await state.router.getAmountsIn(amountOut, path);
      const deadline = (await time.latest()) + 3600;
      await expect(state.router.connect(state.trader).swapTokensForExactTokens(
        amountOut,
        amounts[0] - 1n,
        path,
        state.trader.address,
        deadline,
      )).to.be.revertedWith("LithoswapRouter: EXCESSIVE_INPUT_AMOUNT");
      const before = await state.tokenB.balanceOf(state.trader.address);
      await state.router.connect(state.trader).swapTokensForExactTokens(
        amountOut,
        amounts[0],
        path,
        state.trader.address,
        deadline,
      );
      expect((await state.tokenB.balanceOf(state.trader.address)) - before).to.equal(amountOut);
    });

    it("routes and settles a two-pool multi-hop swap", async function () {
      const state = await loadFixture(fixture);
      await addLiquidity(state, state.tokenA, state.tokenB);
      await addLiquidity(state, state.tokenB, state.tokenC, e18(1_000), e18(2_000));
      const path = [await state.tokenA.getAddress(), await state.tokenB.getAddress(), await state.tokenC.getAddress()];
      const quote = await state.router.getAmountsOut(e18(10), path);
      const before = await state.tokenC.balanceOf(state.trader.address);
      await state.router.connect(state.trader).swapExactTokensForTokens(
        e18(10),
        quote[2],
        path,
        state.trader.address,
        (await time.latest()) + 3600,
      );
      expect((await state.tokenC.balanceOf(state.trader.address)) - before).to.equal(quote[2]);
    });

    it("rejects invalid paths, missing pairs, empty inputs, and impossible output", async function () {
      const state = await loadFixture(fixture);
      const a = await state.tokenA.getAddress();
      const b = await state.tokenB.getAddress();
      const c = await state.tokenC.getAddress();
      await addLiquidity(state);
      await expect(state.router.getAmountsOut(e18(1), [a])).to.be.revertedWith("LithoswapV2Library: INVALID_PATH");
      await expect(state.router.getAmountsOut(e18(1), [a, c])).to.be.revertedWith("LithoswapV2Library: PAIR_NOT_FOUND");
      await expect(state.router.getAmountOut(0, e18(1), e18(1))).to.be.revertedWith("LithoswapV2Library: INSUFFICIENT_INPUT_AMOUNT");
      await expect(state.router.getAmountIn(e18(1), e18(1), e18(1))).to.be.reverted;
      expect(await state.router.quote(e18(2), e18(4), e18(10))).to.equal(e18(5));
      expect(b).not.to.equal(c);
    });

    it("rejects a direct pair withdrawal with no input", async function () {
      const state = await loadFixture(fixture);
      const pair = await addLiquidity(state);
      await expect(pair.swap(1, 0, state.other.address, "0x")).to.be.revertedWith("Lithoswap: INSUFFICIENT_INPUT_AMOUNT");
    });
  });

  describe("pair safety and accounting", function () {
    it("skims only surplus and syncs reserves without changing LP supply", async function () {
      const state = await loadFixture(fixture);
      const pair = await addLiquidity(state);
      const pairAddress = await pair.getAddress();
      const supply = await pair.totalSupply();
      const before = await state.tokenA.balanceOf(state.other.address);
      await state.tokenA.connect(state.lp).transfer(pairAddress, e18(7));
      await pair.skim(state.other.address);
      expect((await state.tokenA.balanceOf(state.other.address)) - before).to.equal(e18(7));
      await state.tokenA.connect(state.lp).transfer(pairAddress, e18(3));
      await pair.sync();
      const [reserve0, reserve1] = await pair.getReserves();
      const token0 = await pair.token0();
      expect(token0 === await state.tokenA.getAddress() ? reserve0 : reserve1).to.equal(e18(1_003));
      expect(await pair.totalSupply()).to.equal(supply);
    });

    it("advances cumulative prices after elapsed time", async function () {
      const state = await loadFixture(fixture);
      const pair = await addLiquidity(state);
      await time.increase(60);
      await pair.sync();
      expect(await pair.price0CumulativeLast()).to.be.greaterThan(0n);
      expect(await pair.price1CumulativeLast()).to.be.greaterThan(0n);
    });

    it("blocks flash-swap reentrancy while allowing a correctly repaid flash swap", async function () {
      const state = await loadFixture(fixture);
      const pair = await addLiquidity(state);
      const token0Address = await pair.token0();
      const token0 = token0Address === await state.tokenA.getAddress() ? state.tokenA : state.tokenB;
      const amountOut = e18(10);
      const repay = (amountOut * 1000n) / 997n + 1n;
      const Callee = await ethers.getContractFactory("MockFlashSwapCallee");
      const callee = await Callee.deploy();
      await token0.mint(await callee.getAddress(), repay);
      await callee.start(await pair.getAddress(), amountOut, 0, token0Address, repay);
      expect(await callee.reentrySucceeded()).to.equal(false);
    });
  });
});
