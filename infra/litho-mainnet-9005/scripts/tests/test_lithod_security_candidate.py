from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]
BUILD_SCRIPT = ROOT / "bin" / "build-lithod.sh"
VERIFY_SCRIPT = ROOT / "bin" / "verify-lithod-security-dependencies.sh"
PATCH_DIR = ROOT / "bin" / "patches"


class LithodSecurityCandidateTests(unittest.TestCase):
    def test_pins_reviewed_sources_and_dependencies(self):
        build = BUILD_SCRIPT.read_text(encoding="utf-8")

        expected = (
            'EVMOS_VERSION="${EVMOS_VERSION:-v20.0.0}"',
            'EVMOS_COMMIT="${EVMOS_COMMIT:-eca13ef2521a9ef13c32e80b1b147230bdb155b5}"',
            'COSMOS_SDK_VERSION="${COSMOS_SDK_VERSION:-v0.50.14}"',
            'COSMOS_SDK_COMMIT="${COSMOS_SDK_COMMIT:-f2e6295b662fdb27ea33da1296c29588ccdaab42}"',
            'COMETBFT_VERSION="${COMETBFT_VERSION:-v0.38.22}"',
            'IBC_GO_VERSION="${IBC_GO_VERSION:-v8.7.0}"',
            'COSMOS_MATH_VERSION="${COSMOS_MATH_VERSION:-v1.4.0}"',
        )
        for pin in expected:
            self.assertIn(pin, build)

        self.assertIn("go mod verify", build)
        self.assertIn("verify-lithod-security-dependencies.sh", build)
        self.assertIn(
            "go test ./x/erc20/keeper ./x/ibc/transfer/keeper -count=1", build
        )

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

    def test_binary_dependency_verifier_rejects_old_mainnet_versions(self):
        verifier = VERIFY_SCRIPT.read_text(encoding="utf-8")

        for fixed_version in ("v1.4.0", "v0.38.22", "v0.50.14", "v8.7.0"):
            self.assertIn(fixed_version, verifier)

        for old_version in ("v1.3.0", "v0.38.12", "v0.50.9", "v8.5.1"):
            self.assertNotIn(old_version, verifier)


if __name__ == "__main__":
    unittest.main()
