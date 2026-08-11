const { expect } = require("chai");
const { CANDIDATE, validateManifest } = require("../scripts/v05-testnet-manifest");

const addresses = [
  "0x0000000000000000000000000000000000000001",
  "0x0000000000000000000000000000000000000002",
  "0x0000000000000000000000000000000000000003",
  "0x0000000000000000000000000000000000000004",
  "0x0000000000000000000000000000000000000005",
  "0x0000000000000000000000000000000000000006",
  "0x0000000000000000000000000000000000000007",
];

const manifest = () => ({
  schemaVersion: 1,
  candidate: { ...CANDIDATE },
  approval: { record: "private-issue-2", changeWindowUtc: "2026-08-20T20:00:00Z", rollbackOwner: "kaj-labs-ops" },
  validatorSet: { validators: [...addresses], signaturesRequired: 5 },
  networks: {
    kamet: {
      hardhatNetwork: "litho_kamet",
      chainId: 900523,
      expectedDeployer: "0x0000000000000000000000000000000000000010",
      governanceOwner: "0x0000000000000000000000000000000000000011",
      pauseGuardian: "0x0000000000000000000000000000000000000012",
      tokens: [{ symbol: "LAX", address: "0x0000000000000000000000000000000000000020", dailyCapBaseUnits: "1000" }],
    },
  },
});

describe("v0.5 testnet deployment manifest", function () {
  it("accepts the exact candidate with a unique 5-of-7 set", function () {
    const result = validateManifest(manifest(), "kamet");
    expect(result.validatorSet.validators).to.have.length(7);
    expect(result.validatorSet.signaturesRequired).to.equal(5);
    expect(result.network.chainId).to.equal(900523);
  });

  it("rejects duplicate validators", function () {
    const input = manifest();
    input.validatorSet.validators[6] = input.validatorSet.validators[0];
    expect(() => validateManifest(input, "kamet")).to.throw("must be unique");
  });

  it("rejects a candidate hash mismatch", function () {
    const input = manifest();
    input.candidate.multXBridgeRuntimeSha256 = "0".repeat(64);
    expect(() => validateManifest(input, "kamet")).to.throw("immutable v0.5 candidate");
  });

  it("rejects placeholders and zero caps", function () {
    const input = manifest();
    input.approval.record = "<PENDING>";
    expect(() => validateManifest(input, "kamet")).to.throw("approved non-placeholder");
    input.approval.record = "private-issue-2";
    input.networks.kamet.tokens[0].dailyCapBaseUnits = "0";
    expect(() => validateManifest(input, "kamet")).to.throw("positive base-unit integer");
  });

  it("requires independent governance and pause addresses", function () {
    const input = manifest();
    input.networks.kamet.pauseGuardian = input.networks.kamet.governanceOwner;
    expect(() => validateManifest(input, "kamet")).to.throw("independent addresses");
  });

  it("requires an exact UTC change window", function () {
    const input = manifest();
    input.approval.changeWindowUtc = "next Thursday";
    expect(() => validateManifest(input, "kamet")).to.throw("exact UTC timestamp");
  });

  it("separates bridge validators from deployer and governance roles", function () {
    const input = manifest();
    input.networks.kamet.pauseGuardian = input.validatorSet.validators[0];
    expect(() => validateManifest(input, "kamet")).to.throw("independent from deployer and governance roles");
  });
});
