from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]
BUILD_SCRIPT = ROOT / "bin" / "build-lithod.sh"
VERIFY_SCRIPT = ROOT / "bin" / "verify-lithod-security-dependencies.sh"
SBOM_SCRIPT = ROOT / "bin" / "generate-sbom.sh"
RELEASE_MANIFEST = ROOT / "bin" / "lithod-release-manifest.sh"
PATCH_DIR = ROOT / "bin" / "patches"


class LithodSecurityCandidateTests(unittest.TestCase):
    def test_pins_reviewed_sources_and_dependencies(self):
        build = BUILD_SCRIPT.read_text(encoding="utf-8")
        manifest = RELEASE_MANIFEST.read_text(encoding="utf-8")

        expected = (
            'readonly GO_VERSION="go1.22.12"',
            'readonly EVMOS_VERSION="v20.0.0"',
            'readonly EVMOS_COMMIT="eca13ef2521a9ef13c32e80b1b147230bdb155b5"',
            'readonly COSMOS_SDK_VERSION="v0.50.14"',
            'readonly COSMOS_SDK_COMMIT="f2e6295b662fdb27ea33da1296c29588ccdaab42"',
            'readonly COMETBFT_VERSION="v0.38.22"',
            'readonly IBC_GO_VERSION="v8.7.0"',
            'readonly COSMOS_MATH_VERSION="v1.4.0"',
        )
        for pin in expected:
            self.assertIn(pin, manifest)

        self.assertIn("release security pin may not be supplied", build)
        self.assertIn("go mod verify", build)
        self.assertIn("verify-lithod-security-dependencies.sh", build)
        self.assertIn("verify_patch", build)
        self.assertIn(
            "go test ./x/erc20/keeper ./x/ibc/transfer/keeper -count=1", build
        )

    def test_final_source_is_frozen_and_tested_before_build(self):
        build = BUILD_SCRIPT.read_text(encoding="utf-8")

        patch_pos = build.index('git apply "${STATEDB_PRECOMPILE_REGRESSION_PATCH}"')
        rebrand_pos = build.index('echo ">>> Rebranding bech32 prefix')
        freeze_pos = build.index('FINAL_EVMOS_DIFF="${EVIDENCE_DIR}/evmos-final-source.diff"')
        test_pos = build.index("go test ./app/post -run TestSupplyCapDecorator")
        integration_pos = build.index("go test ./precompiles/staking")
        build_pos = build.index("make build 2>&1")
        sbom_pos = build.index('bash "${SBOM_SCRIPT}"')

        self.assertLess(patch_pos, rebrand_pos)
        self.assertLess(rebrand_pos, freeze_pos)
        self.assertLess(freeze_pos, test_pos)
        self.assertLess(test_pos, integration_pos)
        self.assertLess(integration_pos, build_pos)
        self.assertLess(build_pos, sbom_pos)
        self.assertGreaterEqual(build.count("verify_frozen_source"), 3)

    def test_contains_fail_closed_supply_controls(self):
        supply_patch = (
            PATCH_DIR / "evmos-v20-litho-fixed-supply.patch"
        ).read_text(encoding="utf-8")
        integration_patch = (
            PATCH_DIR / "evmos-v20-litho-integration-tests.patch"
        ).read_text(encoding="utf-8")

        self.assertIn(
            "WithMintCoinsRestriction(rejectInflationMinting)", supply_patch
        )
        self.assertIn("validateLITHOGenesisSupply", supply_patch)
        self.assertIn("NewSupplyCapDecorator", supply_patch)
        self.assertIn("1_000_000_000", supply_patch)
        self.assertIn("exceeds maximum supply", integration_patch)
        self.assertIn("maximumSupply.Sub(totalSupply)", integration_patch)

        fixture_patch = (
            PATCH_DIR / "evmos-v20-litho-test-fixtures.patch"
        ).read_text(encoding="utf-8")
        self.assertIn("litho1x2w87cvt5mqjncav4lxy8yfreynn273xpxvc7n", fixture_patch)
        self.assertNotIn('+\tsenderAddr := "evmos1', fixture_patch)

    def test_binary_dependency_verifier_rejects_old_mainnet_versions(self):
        verifier = VERIFY_SCRIPT.read_text(encoding="utf-8")

        for fixed_version in ("v1.4.0", "v0.38.22", "v0.50.14", "v8.7.0"):
            self.assertIn(fixed_version, verifier)

        for old_version in ("v1.3.0", "v0.38.12", "v0.50.9", "v8.5.1"):
            self.assertNotIn(old_version, verifier)

    def test_transaction_level_exploit_regression_is_mandatory(self):
        build = BUILD_SCRIPT.read_text(encoding="utf-8")
        regression_patch = (
            PATCH_DIR / "evmos-v20-statedb-precompile-regression.patch"
        ).read_text(encoding="utf-8")

        required_evidence = (
            'MethodName = "testDelegateWithTransfer"',
            "CallContractAndCheckLogs",
            "internal transfer before precompile call",
            "internal transfer after precompile call",
            "internal transfers before and after precompile call",
            "matching transaction value",
            "GetTotalSupply",
            "totalSupplyAfter.Supply",
            "prevDelegation",
        )
        for item in required_evidence:
            self.assertIn(item, regression_patch)

        self.assertIn("test-statedb-precompile-integration.log", build)
        self.assertIn("-ginkgo.focus", build)

    def test_sbom_and_release_evidence_fail_closed(self):
        build = BUILD_SCRIPT.read_text(encoding="utf-8")
        sbom = SBOM_SCRIPT.read_text(encoding="utf-8")

        self.assertNotIn("--skip-sbom", build)
        self.assertNotIn("non-fatal", build.lower())
        self.assertIn('if [[ ! -f "${SBOM_SCRIPT}" ]]', build)
        self.assertIn('find . -type f ! -name \'SHA256SUMS.txt\'', build)
        self.assertIn("--proto '=https'", sbom)
        self.assertIn("sha256sum --check --strict", sbom)
        self.assertIn('grep -q \'"bomFormat"', sbom)


if __name__ == "__main__":
    unittest.main()
