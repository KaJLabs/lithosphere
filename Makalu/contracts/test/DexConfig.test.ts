import { expect } from "chai";
import { ZeroAddress } from "ethers";

import {
  parseDeploymentManifest,
  parseLiquidityPlan,
  requiredConfirmation,
} from "../scripts/lib/dex-config";

const A = "0x1111111111111111111111111111111111111111";
const B = "0x2222222222222222222222222222222222222222";
const C = "0x3333333333333333333333333333333333333333";
const H = `0x${"ab".repeat(32)}`;

describe("Lithoswap deployment configuration", function () {
  it("normalizes and accepts a complete versioned manifest", function () {
    const manifest = parseDeploymentManifest({
      schemaVersion: 1,
      chainId: 700777,
      network: "makalu",
      deployer: A,
      feeToSetter: B,
      feeTo: ZeroAddress,
      commit: "abc123",
      dirty: false,
      deployedAt: "2026-08-03T00:00:00.000Z",
      confirmations: 2,
      wlitho: C,
      contracts: { LithoswapV2Factory: A, LithoswapV2Router02: B },
      transactions: { LithoswapV2Factory: H, LithoswapV2Router02: H },
      deploymentBlocks: { LithoswapV2Factory: 10, LithoswapV2Router02: 11 },
      runtimeCodeHashes: { LithoswapV2Factory: H, LithoswapV2Router02: H },
    });
    expect(manifest.chainId).to.equal(700777);
    expect(manifest.feeTo).to.equal(ZeroAddress);
    expect(manifest.dirty).to.equal(false);
  });

  it("rejects incomplete, zero-address, dirty-shape, and unsupported manifests", function () {
    expect(() => parseDeploymentManifest({ schemaVersion: 2 })).to.throw("schemaVersion");
    const base = {
      schemaVersion: 1,
      chainId: 1,
      network: "x",
      deployer: A,
      feeToSetter: B,
      feeTo: ZeroAddress,
      commit: "x",
      dirty: false,
      deployedAt: "x",
      confirmations: 1,
      wlitho: C,
      contracts: { LithoswapV2Factory: A, LithoswapV2Router02: B },
      transactions: { LithoswapV2Factory: H, LithoswapV2Router02: H },
      deploymentBlocks: { LithoswapV2Factory: 1, LithoswapV2Router02: 2 },
      runtimeCodeHashes: { LithoswapV2Factory: H, LithoswapV2Router02: H },
    };
    expect(() => parseDeploymentManifest({ ...base, wlitho: ZeroAddress })).to.throw("wlitho");
    expect(() => parseDeploymentManifest({ ...base, dirty: "false" })).to.throw("dirty");
  });

  it("accepts an explicit plan, including a zero-decimal token", function () {
    const plan = parseLiquidityPlan({
      schemaVersion: 1,
      chainId: 700777,
      router: A,
      liquidityProvider: C,
      lpRecipient: B,
      pairs: [{ tokenA: A, tokenB: C, amountA: "25", amountB: "1.5", decimalsA: 0, decimalsB: 18 }],
    });
    expect(plan.pairs[0].decimalsA).to.equal(0);
    expect(plan.pairs[0].amountB).to.equal("1.5");
  });

  it("rejects duplicate pairs, unsupported precision, placeholders, and identical tokens", function () {
    const pair = { tokenA: A, tokenB: B, amountA: "1", amountB: "2", decimalsA: 18, decimalsB: 18 };
    const plan = { schemaVersion: 1, chainId: 700777, router: A, liquidityProvider: B, lpRecipient: C, pairs: [pair] };
    expect(() => parseLiquidityPlan({ ...plan, pairs: [pair, { ...pair, tokenA: B, tokenB: A }] })).to.throw("duplicates");
    expect(() => parseLiquidityPlan({ ...plan, pairs: [{ ...pair, tokenB: A }] })).to.throw("identical");
    expect(() => parseLiquidityPlan({ ...plan, pairs: [{ ...pair, amountA: "CLIENT_REQUIRED" }] })).to.throw("decimal string");
    expect(() => parseLiquidityPlan({ ...plan, pairs: [{ ...pair, amountA: "1.0000000000000000001" }] })).to.throw("precision");
    expect(() => parseLiquidityPlan({ ...plan, liquidityProvider: ZeroAddress })).to.throw("liquidityProvider");
  });

  it("requires the exact chain-bound confirmation phrase", function () {
    expect(() => requiredConfirmation("DEPLOY_LITHOSWAP_700777", "DEPLOY_LITHOSWAP", 700777)).not.to.throw();
    expect(() => requiredConfirmation("yes", "DEPLOY_LITHOSWAP", 700777)).to.throw("Refusing");
  });
});
