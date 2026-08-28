from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts"


def load(name: str):
    path = SCRIPTS / f"{name}.py"
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class LithodR11EvidenceTests(unittest.TestCase):
    def test_normalizes_cosmos_sdk_identity_and_dependency_edges(self):
        module = load("normalize_lithod_sbom")
        old_ref = "pkg:golang//tmp/litho-cosmos-sdk-v0.50.14@(devel)?type=module"
        raw = {
            "bomFormat": "CycloneDX",
            "specVersion": "1.6",
            "components": [{
                "bom-ref": old_ref,
                "type": "library",
                "name": module.RAW_NAME,
                "version": module.RAW_VERSION,
                "purl": old_ref,
            }],
            "dependencies": [
                {"ref": "application", "dependsOn": [old_ref]},
                {"ref": old_ref, "dependsOn": []},
            ],
        }
        result = module.normalize(raw)
        encoded = json.dumps(result, sort_keys=True)
        self.assertNotIn(module.RAW_NAME, encoded)
        self.assertIn(module.CANONICAL_NAME, encoded)
        component = result["components"][0]
        self.assertEqual(component["version"], "v0.50.14")
        properties = {item["name"]: item["value"] for item in component["properties"]}
        self.assertEqual(properties["litho:upstream-commit"], module.UPSTREAM_COMMIT)
        self.assertEqual(properties["litho:final-source-diff-sha256"], module.FINAL_DIFF_SHA256)
        self.assertEqual(result["dependencies"][0]["dependsOn"], [module.CANONICAL_REF])
        self.assertEqual(result["dependencies"][1]["ref"], module.CANONICAL_REF)

    def test_package_builder_requires_every_release_input(self):
        module = load("build_lithod_r1_1_evidence")
        self.assertEqual(len(module.PATCHES), 6)
        self.assertIn("build-lithod.sh", module.TOOLS)
        self.assertIn("generate-sbom.sh", module.TOOLS)
        self.assertIn("verify-lithod-security-dependencies.sh", module.TOOLS)
        self.assertIn("lithod-release-manifest.sh", module.TOOLS)
        self.assertEqual(
            module.EXPECTED_BINARY_SHA256,
            "1f03146df86391715b86971b14b6074580b7efd06d7265a1725d90e426b8efbc",
        )


if __name__ == "__main__":
    unittest.main()
