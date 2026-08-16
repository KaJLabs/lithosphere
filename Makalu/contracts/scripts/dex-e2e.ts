/**
 * Standalone end-to-end check of the Lithoswap V2 DEX on the in-process Hardhat
 * network. Uses only ethers via the Hardhat runtime (no mocha/chai, which are
 * not linked in this pnpm layout). Run: `hardhat run scripts/dex-e2e.ts`.
 *
 * Exercises: deploy factory+router+two ERC20s, addLiquidity (first mint),
 * getAmountsOut quote vs on-chain swap output, the 0.30% fee math, a slippage
 * revert, and removeLiquidity.
 */
import { ethers } from "hardhat";

const e18 = (n: bigint | number) => ethers.parseUnits(n.toString(), 18);
let checks = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  checks++;
  console.log(`  ok: ${msg}`);
}

async function main() {
  const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
  const [owner, lp, trader] = await ethers.getSigners();

  const Mock = await ethers.getContractFactory("MockERC20");
  const tokenA = await Mock.deploy("Token A", "AAA");
  const tokenB = await Mock.deploy("Token B", "BBB");
  const addrA = await tokenA.getAddress();
  const addrB = await tokenB.getAddress();

  const factory = await (await ethers.getContractFactory("LithoswapV2Factory")).deploy(owner.address);
  const router = await (await ethers.getContractFactory("LithoswapV2Router02")).deploy(
    await factory.getAddress(),
    addrA,
  );
  const routerAddr = await router.getAddress();

  // ── addLiquidity: seed a 100 A : 400 B pool ──────────────────────────────
  await (await tokenA.mint(lp.address, e18(100))).wait();
  await (await tokenB.mint(lp.address, e18(400))).wait();
  await (await tokenA.connect(lp).approve(routerAddr, e18(100))).wait();
  await (await tokenB.connect(lp).approve(routerAddr, e18(400))).wait();
  await (
    await router
      .connect(lp)
      .addLiquidity(addrA, addrB, e18(100), e18(400), 0, 0, lp.address, deadline)
  ).wait();

  const pairAddr = await factory.getPair(addrA, addrB);
  assert(pairAddr !== ethers.ZeroAddress, "pair created");
  assert((await factory.allPairsLength()) === 1n, "allPairsLength == 1");

  const pair = await ethers.getContractAt("LithoswapV2Pair", pairAddr);
  // sqrt(100e18 * 400e18) = 200e18, minus MINIMUM_LIQUIDITY(1000).
  assert((await pair.balanceOf(lp.address)) === e18(200) - 1000n, "first LP = 200e18 - 1000");

  // ── quote + swap: 10 A -> B with the 0.30% fee ───────────────────────────
  const amountIn = e18(10);
  const amountInWithFee = amountIn * 997n;
  const expectedOut = (amountInWithFee * e18(400)) / (e18(100) * 1000n + amountInWithFee);

  const quoted = await router.getAmountsOut(amountIn, [addrA, addrB]);
  assert(quoted[1] === expectedOut, `getAmountsOut matches V2 formula (${expectedOut})`);

  await (await tokenA.mint(trader.address, e18(10))).wait();
  await (await tokenA.connect(trader).approve(routerAddr, e18(10))).wait();
  const beforeB = await tokenB.balanceOf(trader.address);
  await (
    await router
      .connect(trader)
      .swapExactTokensForTokens(amountIn, expectedOut, [addrA, addrB], trader.address, deadline)
  ).wait();
  const afterB = await tokenB.balanceOf(trader.address);
  assert(afterB - beforeB === expectedOut, "swap output == quoted output");

  // ── slippage guard: min-out above quote must revert ──────────────────────
  await (await tokenA.mint(trader.address, e18(10))).wait();
  await (await tokenA.connect(trader).approve(routerAddr, e18(10))).wait();
  let reverted = false;
  try {
    await router
      .connect(trader)
      .swapExactTokensForTokens.staticCall(e18(10), e18(40), [addrA, addrB], trader.address, deadline);
  } catch {
    reverted = true;
  }
  assert(reverted, "swap reverts when amountOutMin exceeds quote");

  // ── removeLiquidity: LP burns back to underlying ─────────────────────────
  const liq = await pair.balanceOf(lp.address);
  await (await pair.connect(lp).approve(routerAddr, liq)).wait();
  await (
    await router.connect(lp).removeLiquidity(addrA, addrB, liq, 0, 0, lp.address, deadline)
  ).wait();
  assert((await pair.balanceOf(lp.address)) === 0n, "LP fully burned");
  // After the 10 A -> ~36.26 B trade the pool holds ~110 A / ~363.7 B, and the
  // LP (owning ~all liquidity) gets that post-trade position back: more A, less
  // B. This is the constant-product outcome, not the original 100/400.
  const lpA = await tokenA.balanceOf(lp.address);
  const lpB = await tokenB.balanceOf(lp.address);
  assert(lpA > e18(109) && lpA <= e18(110), `tokenA returned to LP (~110, got ${lpA})`);
  assert(lpB > e18(363) && lpB < e18(364), `tokenB returned to LP (~363.7, got ${lpB})`);

  console.log(`\nAll ${checks} checks passed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
