import { expect } from "chai";
import { ethers } from "hardhat";

// End-to-end test of the Lithoswap V2 DEX: deploy factory + router + two ERC-20s,
// add liquidity, quote via getAmountsOut, execute a swap, and assert the
// constant-product math (0.30% fee) and balance deltas.
describe("Lithoswap V2", function () {
  const DEADLINE = Math.floor(Date.now() / 1000) + 3600;
  const e18 = (n: bigint | number) => ethers.parseUnits(n.toString(), 18);

  async function deploy() {
    const [owner, lp, trader] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory("MockERC20");
    const tokenA = await Mock.deploy("Token A", "AAA");
    const tokenB = await Mock.deploy("Token B", "BBB");

    const Factory = await ethers.getContractFactory("LithoswapV2Factory");
    const factory = await Factory.deploy(owner.address);

    const Router = await ethers.getContractFactory("LithoswapV2Router02");
    // WLITHO address is irrelevant for pure ERC20↔ERC20 tests; pass tokenA.
    const router = await Router.deploy(await factory.getAddress(), await tokenA.getAddress());

    return { owner, lp, trader, tokenA, tokenB, factory, router };
  }

  it("creates a pair and mints LP on first addLiquidity", async function () {
    const { lp, tokenA, tokenB, factory, router } = await deploy();
    const routerAddr = await router.getAddress();

    await tokenA.mint(lp.address, e18(1000));
    await tokenB.mint(lp.address, e18(1000));
    await tokenA.connect(lp).approve(routerAddr, e18(1000));
    await tokenB.connect(lp).approve(routerAddr, e18(1000));

    await router
      .connect(lp)
      .addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        e18(100),
        e18(400),
        0,
        0,
        lp.address,
        DEADLINE,
      );

    const pairAddr = await factory.getPair(await tokenA.getAddress(), await tokenB.getAddress());
    expect(pairAddr).to.not.equal(ethers.ZeroAddress);
    expect(await factory.allPairsLength()).to.equal(1n);

    const pair = await ethers.getContractAt("LithoswapV2Pair", pairAddr);
    // sqrt(100e18 * 400e18) = 200e18; minus MINIMUM_LIQUIDITY(1000).
    expect(await pair.balanceOf(lp.address)).to.equal(e18(200) - 1000n);
  });

  it("quotes and swaps with the 0.30% fee (getAmountsOut matches on-chain)", async function () {
    const { lp, trader, tokenA, tokenB, router } = await deploy();
    const routerAddr = await router.getAddress();
    const [addrA, addrB] = [await tokenA.getAddress(), await tokenB.getAddress()];

    // Seed a 100 A : 400 B pool.
    await tokenA.mint(lp.address, e18(100));
    await tokenB.mint(lp.address, e18(400));
    await tokenA.connect(lp).approve(routerAddr, e18(100));
    await tokenB.connect(lp).approve(routerAddr, e18(400));
    await router
      .connect(lp)
      .addLiquidity(addrA, addrB, e18(100), e18(400), 0, 0, lp.address, DEADLINE);

    // Trader swaps 10 A -> B.
    await tokenA.mint(trader.address, e18(10));
    await tokenA.connect(trader).approve(routerAddr, e18(10));

    // Expected out by the V2 formula: 10*997*400 / (100*1000 + 10*997).
    const amountIn = e18(10);
    const amountInWithFee = amountIn * 997n;
    const expectedOut = (amountInWithFee * e18(400)) / (e18(100) * 1000n + amountInWithFee);

    const quoted = await router.getAmountsOut(amountIn, [addrA, addrB]);
    expect(quoted[1]).to.equal(expectedOut);

    const beforeB = await tokenB.balanceOf(trader.address);
    await router
      .connect(trader)
      .swapExactTokensForTokens(amountIn, expectedOut, [addrA, addrB], trader.address, DEADLINE);
    const afterB = await tokenB.balanceOf(trader.address);

    expect(afterB - beforeB).to.equal(expectedOut);
  });

  it("reverts a swap whose min-out exceeds the quote (slippage guard)", async function () {
    const { lp, trader, tokenA, tokenB, router } = await deploy();
    const routerAddr = await router.getAddress();
    const [addrA, addrB] = [await tokenA.getAddress(), await tokenB.getAddress()];

    await tokenA.mint(lp.address, e18(100));
    await tokenB.mint(lp.address, e18(400));
    await tokenA.connect(lp).approve(routerAddr, e18(100));
    await tokenB.connect(lp).approve(routerAddr, e18(400));
    await router
      .connect(lp)
      .addLiquidity(addrA, addrB, e18(100), e18(400), 0, 0, lp.address, DEADLINE);

    await tokenA.mint(trader.address, e18(10));
    await tokenA.connect(trader).approve(routerAddr, e18(10));

    await expect(
      router
        .connect(trader)
        .swapExactTokensForTokens(e18(10), e18(40), [addrA, addrB], trader.address, DEADLINE),
    ).to.be.revertedWith("LithoswapRouter: INSUFFICIENT_OUTPUT_AMOUNT");
  });

  it("removes liquidity back to the underlying tokens", async function () {
    const { lp, tokenA, tokenB, factory, router } = await deploy();
    const routerAddr = await router.getAddress();
    const [addrA, addrB] = [await tokenA.getAddress(), await tokenB.getAddress()];

    await tokenA.mint(lp.address, e18(100));
    await tokenB.mint(lp.address, e18(400));
    await tokenA.connect(lp).approve(routerAddr, e18(100));
    await tokenB.connect(lp).approve(routerAddr, e18(400));
    await router
      .connect(lp)
      .addLiquidity(addrA, addrB, e18(100), e18(400), 0, 0, lp.address, DEADLINE);

    const pairAddr = await factory.getPair(addrA, addrB);
    const pair = await ethers.getContractAt("LithoswapV2Pair", pairAddr);
    const liq = await pair.balanceOf(lp.address);
    await pair.connect(lp).approve(routerAddr, liq);

    await router
      .connect(lp)
      .removeLiquidity(addrA, addrB, liq, 0, 0, lp.address, DEADLINE);

    // LP burned; got tokens back (minus the locked MINIMUM_LIQUIDITY dust).
    expect(await pair.balanceOf(lp.address)).to.equal(0n);
    expect(await tokenA.balanceOf(lp.address)).to.be.greaterThan(e18(99));
    expect(await tokenB.balanceOf(lp.address)).to.be.greaterThan(e18(399));
  });
});
