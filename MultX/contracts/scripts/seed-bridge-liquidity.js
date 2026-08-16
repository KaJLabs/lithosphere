/**
 * Route 1 — seed release-side liquidity on a MultXBridge.
 *
 * MultXBridge.releaseTokens transfers tokens the bridge CONTRACT holds, so each
 * bridge must hold a reserve of every supported token to satisfy releases:
 *   - Kamet bridge  (0x3a896BDF…) releases for Makalu→Kamet  → seed Kamet tokens
 *   - Makalu bridge (0x5832D5E6…) releases for Kamet→Makalu  → seed Makalu tokens
 *
 * Chain-aware: it picks the token set + bridge by the connected chainId. Source
 * is the signer (deployer 0x10ed…, which holds full supply on both chains).
 * Gas is paid in LITHO. Idempotent-ish: transfers SEED_AMOUNT regardless of
 * current bridge balance, so re-running ADDS more — set SEED_AMOUNT accordingly.
 *
 * Usage (run once per chain):
 *   DEPLOYER_PRIVATE_KEY=0x... [SEED_AMOUNT=1000000] \
 *   npx hardhat run scripts/seed-bridge-liquidity.js --network litho_kamet
 *   DEPLOYER_PRIVATE_KEY=0x... [SEED_AMOUNT=1000000] \
 *   npx hardhat run scripts/seed-bridge-liquidity.js --network litho_makalu
 */

const hre = require("hardhat");

// Per-chain bridge + the 10 shared LEP100 tokens (QTT is Kamet-only and not
// bridgeable to Makalu, so it is intentionally excluded from seeding).
const CHAINS = {
  900523: {
    name: "Kamet",
    bridge: "0x3a896BDF3a1088287FA84aB5a43bB30e2535F263",
    tokens: {
      wLITHO: "0xC0FC628e3aB128fe387e7ed5e729bD809C017888",
      LitBTC: "0x3A8D5FdC6c8dA9f14C535424b6F7206eC1996016",
      LAX:    "0xe8f504f9cE5391Fb5968b317f0b24b8A0306ACeb",
      JOT:    "0x6AE14CEb3962664b13c5dEF29EB172De76bd0ac9",
      COLLE:  "0x0573f66cb4bC34618e7AB8a941F7883DD2515dCA",
      IMAGE:  "0x8Ba6E3A0759144245f2939eB54164e32bb78B8E0",
      AGII:   "0x17D506aF1d0Dc2f4f64f15748a5aC46FAd3f06D7",
      BLDR:   "0xF05f1F79273874E554F02ce06585E16132a3B62B",
      FGPT:   "0x2F366c6350A6b211f6D6F847c3D56738C2E847ca",
      MUSA:   "0x17A357262097B4e70acFfe8B71bC61e8bBcc3B42",
    },
  },
  700777: {
    name: "Makalu",
    bridge: "0x5832D5E609c6690f74c7683606Eb20F89ff096a6",
    tokens: {
      wLITHO: "0x599a7E135f1790ae117b4EdDc0422D24Bc766161",
      LitBTC: "0xC4645CA5411D6E27556780AB4cdd0DF7e609df74",
      LAX:    "0x1Cde2Ca6c2ab8622003ebe06e382bC07850d4B8d",
      JOT:    "0xEF2f35f6d0fb7DC9E87b8ca8252AE2E6ffb2a25e",
      COLLE:  "0x10D4BB600c96e9243E2f50baFED8b2478F25af61",
      IMAGE:  "0xAcD98E323968647936887aD4934e64B01060727e",
      AGII:   "0x10052B8ccD2160b8F9880C6b4F5DD117fF253B1c",
      BLDR:   "0x798eD6bFc5bfCFc60938d5098825b354427A0786",
      FGPT:   "0x151ef362eA96853702Cc5e7728107e3961fbD22e",
      MUSA:   "0xDB829befCF8E582379E2c034FA2589b8D2EA1c5D",
    },
  },
};

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const net = await signer.provider.getNetwork();
  const cfg = CHAINS[net.chainId];
  if (!cfg) {
    console.error(`ERROR: chainId ${net.chainId} not seedable. Use --network litho_kamet|litho_makalu.`);
    process.exit(1);
  }

  const amountWhole = process.env.SEED_AMOUNT || "1000000";
  const amount = hre.ethers.utils.parseUnits(amountWhole, 18);

  console.log("=".repeat(60));
  console.log(`  SEED BRIDGE LIQUIDITY — ${cfg.name} (${net.chainId})`);
  console.log("=".repeat(60));
  console.log(`Signer:  ${signer.address}`);
  console.log(`Bridge:  ${cfg.bridge}`);
  console.log(`Amount:  ${amountWhole} of EACH of ${Object.keys(cfg.tokens).length} tokens`);
  const gas = await signer.getBalance();
  console.log(`Gas:     ${hre.ethers.utils.formatEther(gas)} LITHO\n`);

  const results = [];
  for (const [sym, addr] of Object.entries(cfg.tokens)) {
    const t = new hre.ethers.Contract(addr, ERC20_ABI, signer);
    try {
      const bal = await t.balanceOf(signer.address);
      if (bal.lt(amount)) {
        console.log(`  SKIP ${sym.padEnd(7)} insufficient deployer balance (${hre.ethers.utils.formatUnits(bal, 18)})`);
        results.push({ sym, ok: false, reason: "insufficient" });
        continue;
      }
      const already = await t.balanceOf(cfg.bridge);
      const tx = await t.transfer(cfg.bridge, amount, { gasLimit: 120_000 });
      await tx.wait();
      const now = await t.balanceOf(cfg.bridge);
      console.log(`  OK   ${sym.padEnd(7)} bridge ${hre.ethers.utils.formatUnits(already, 18)} → ${hre.ethers.utils.formatUnits(now, 18)}  (${tx.hash})`);
      results.push({ sym, ok: true, tx: tx.hash });
    } catch (err) {
      console.log(`  FAIL ${sym.padEnd(7)} ${String(err.message).slice(0, 90)}`);
      results.push({ sym, ok: false, reason: err.message });
    }
  }

  const ok = results.filter((r) => r.ok).length;
  console.log("\n" + "=".repeat(60));
  console.log(`  ${cfg.name}: seeded ${ok}/${Object.keys(cfg.tokens).length} tokens into ${cfg.bridge}`);
  if (ok < Object.keys(cfg.tokens).length) console.log("  ⚠️  Some failed — re-run (check gas / balances).");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
