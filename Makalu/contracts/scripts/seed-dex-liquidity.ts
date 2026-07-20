/**
 * Seed Lithoswap pools with initial liquidity from the deployer wallet.
 *
 *   DEPLOYER_PRIVATE_KEY=0x… pnpm hardhat run scripts/seed-dex-liquidity.ts --network makalu
 *
 * Reads the DEX manifest (deployments/dex-<chainId>.json) for the router, and a
 * pairs file (deployments/dex-pairs.<chainId>.json, or scripts/dex-pairs.json)
 * describing which pools to seed and with how much. The deployer must already
 * hold the tokens (on Makalu that is 0x10ed…, which holds the LEP-100 supply).
 *
 * For each pair it approves the router and calls addLiquidity; pools that
 * already hold reserves are skipped, so the script is safe to re-run.
 *
 * Pairs file schema (amounts are human units, decimals default to 18):
 *   [{ "tokenA":"0x…","tokenB":"0x…","amountA":"1000","amountB":"5000",
 *      "decimalsA":18,"decimalsB":18 }]
 */
import { ethers } from "hardhat";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

interface PairSpec {
  tokenA: string;
  tokenB: string;
  amountA: string;
  amountB: string;
  decimalsA?: number;
  decimalsB?: number;
}

const ERC20_ABI = [
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
];

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);

  const manifestPath = resolve(__dirname, "..", "deployments", `dex-${chainId}.json`);
  if (!existsSync(manifestPath)) {
    throw new Error(`No DEX manifest at ${manifestPath}. Run deploy-dex.ts first.`);
  }
  const manifest = loadJson<{ contracts: { LithoswapV2Router02: string } }>(manifestPath);
  const routerAddr = manifest.contracts.LithoswapV2Router02;

  const pairsPath = [
    resolve(__dirname, "..", "deployments", `dex-pairs.${chainId}.json`),
    resolve(__dirname, "dex-pairs.json"),
  ].find(existsSync);
  if (!pairsPath) {
    throw new Error(
      "No pairs file found. Create deployments/dex-pairs." + chainId + ".json " +
        "(see scripts/dex-pairs.example.json).",
    );
  }
  const pairs = loadJson<PairSpec[]>(pairsPath);
  console.log(`[seed] chainId=${chainId} router=${routerAddr} pairs=${pairs.length} from ${pairsPath}`);

  const router = await ethers.getContractAt("LithoswapV2Router02", routerAddr);
  const factoryAddr = await router.factory();
  const factory = await ethers.getContractAt("LithoswapV2Factory", factoryAddr);
  const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 1800;

  for (const p of pairs) {
    const a = await ethers.getContractAt(ERC20_ABI, p.tokenA);
    const b = await ethers.getContractAt(ERC20_ABI, p.tokenB);
    const [symA, symB] = [await a.symbol().catch(() => p.tokenA), await b.symbol().catch(() => p.tokenB)];
    const amountA = ethers.parseUnits(p.amountA, p.decimalsA ?? 18);
    const amountB = ethers.parseUnits(p.amountB, p.decimalsB ?? 18);

    // Skip pools that already have reserves.
    const existing = await factory.getPair(p.tokenA, p.tokenB);
    if (existing !== ethers.ZeroAddress) {
      const pair = await ethers.getContractAt("LithoswapV2Pair", existing);
      const [r0, r1] = await pair.getReserves();
      if (r0 > 0n || r1 > 0n) {
        console.log(`[seed] ${symA}/${symB} already seeded (${existing}) — skip`);
        continue;
      }
    }

    for (const [tok, sym, amt] of [[a, symA, amountA], [b, symB, amountB]] as const) {
      const bal: bigint = await tok.balanceOf(deployer.address);
      if (bal < amt) throw new Error(`Insufficient ${sym}: have ${bal}, need ${amt}`);
      const allowance: bigint = await tok.allowance(deployer.address, routerAddr);
      if (allowance < amt) {
        console.log(`[seed] approving ${sym}…`);
        await (await tok.approve(routerAddr, ethers.MaxUint256)).wait();
      }
    }

    console.log(`[seed] addLiquidity ${p.amountA} ${symA} + ${p.amountB} ${symB}…`);
    const tx = await router.addLiquidity(
      p.tokenA,
      p.tokenB,
      amountA,
      amountB,
      (amountA * 99n) / 100n, // 1% min tolerance for a fresh pool
      (amountB * 99n) / 100n,
      deployer.address,
      deadline,
    );
    const rc = await tx.wait();
    console.log(`[seed]   ✓ ${symA}/${symB} seeded (tx ${rc?.hash})`);
  }

  console.log("\n[seed] done.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
