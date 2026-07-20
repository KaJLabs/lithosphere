/**
 * Deploy the Lithoswap V2 DEX (Factory + Router02) and write a manifest.
 *
 *   DEPLOYER_PRIVATE_KEY=0x… pnpm hardhat run scripts/deploy-dex.ts --network makalu
 *
 * The Router is bound to WLITHO (the wrapped-native LEP-100 ERC-20) as the
 * canonical routing base. WLITHO defaults to the live Makalu address and can be
 * overridden with WLITHO_ADDRESS. The manifest at deployments/dex-<chainId>.json
 * is what the seed script and the explorer's lib/swap.ts read for addresses.
 */
import { ethers } from "hardhat";
import { writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";

// Live Makalu WLITHO (same address the bridge uses as wLITHO base).
const DEFAULT_WLITHO = "0x599a7E135f1790ae117b4EdDc0422D24Bc766161";

function currentCommit(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const wlitho = process.env.WLITHO_ADDRESS ?? DEFAULT_WLITHO;

  console.log(`[deploy-dex] chainId=${chainId} deployer=${deployer.address} WLITHO=${wlitho}`);

  const factory = await (await ethers.getContractFactory("LithoswapV2Factory")).deploy(deployer.address);
  await factory.waitForDeployment();
  console.log(`[deploy-dex] Factory → ${await factory.getAddress()}`);

  const router = await (await ethers.getContractFactory("LithoswapV2Router02")).deploy(
    await factory.getAddress(),
    wlitho,
  );
  await router.waitForDeployment();
  console.log(`[deploy-dex] Router02 → ${await router.getAddress()}`);

  const manifest = {
    chainId,
    network: network.name,
    deployer: deployer.address,
    commit: currentCommit(),
    deployedAt: new Date().toISOString(),
    wlitho,
    contracts: {
      LithoswapV2Factory: await factory.getAddress(),
      LithoswapV2Router02: await router.getAddress(),
    },
  };

  const out = resolve(__dirname, "..", "deployments", `dex-${chainId}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  console.log(`\n[deploy-dex] manifest → ${out}`);
  console.log("Next: seed liquidity —");
  console.log(`  DEPLOYER_PRIVATE_KEY=0x… pnpm hardhat run scripts/seed-dex-liquidity.ts --network ${network.name}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
