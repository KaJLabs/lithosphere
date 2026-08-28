#!/usr/bin/env python3
"""Normalize the patched Cosmos SDK identity in a CycloneDX 1.6 SBOM."""
from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path

RAW_NAME = "/tmp/litho-cosmos-sdk-v0.50.14"
RAW_VERSION = "(devel)"
CANONICAL_NAME = "github.com/cosmos/cosmos-sdk"
CANONICAL_VERSION = "v0.50.14"
UPSTREAM_COMMIT = "f2e6295b662fdb27ea33da1296c29588ccdaab42"
FINAL_DIFF_SHA256 = "8e11c9d752266d552bb651d6d1ac752cdf3c1ef91976e2551793f11731832480"
CANONICAL_REF = f"pkg:golang/{CANONICAL_NAME}@{CANONICAL_VERSION}?type=module"
CANONICAL_PURL = (
    f"pkg:golang/{CANONICAL_NAME}@{CANONICAL_VERSION}"
    "?goarch=amd64&goos=linux&type=module"
)


def normalize(document: dict) -> dict:
    result = copy.deepcopy(document)
    if result.get("bomFormat") != "CycloneDX" or result.get("specVersion") != "1.6":
        raise ValueError("input is not a CycloneDX 1.6 document")
    matches = [
        component
        for component in result.get("components", [])
        if component.get("name") == RAW_NAME and component.get("version") == RAW_VERSION
    ]
    if len(matches) != 1:
        raise ValueError(f"expected one local Cosmos SDK component, found {len(matches)}")

    component = matches[0]
    old_ref = component.get("bom-ref")
    if not isinstance(old_ref, str) or not old_ref:
        raise ValueError("local Cosmos SDK component has no bom-ref")
    component.update(
        {
            "bom-ref": CANONICAL_REF,
            "name": CANONICAL_NAME,
            "version": CANONICAL_VERSION,
            "purl": CANONICAL_PURL,
            "properties": [
                {"name": "litho:component-modification", "value": "compatibility-patched"},
                {"name": "litho:upstream-commit", "value": UPSTREAM_COMMIT},
                {"name": "litho:final-source-diff-sha256", "value": FINAL_DIFF_SHA256},
            ],
            "externalReferences": [
                {
                    "type": "vcs",
                    "url": f"https://github.com/cosmos/cosmos-sdk/tree/{UPSTREAM_COMMIT}",
                }
            ],
        }
    )

    for dependency in result.get("dependencies", []):
        if dependency.get("ref") == old_ref:
            dependency["ref"] = CANONICAL_REF
        dependency["dependsOn"] = [
            CANONICAL_REF if item == old_ref else item
            for item in dependency.get("dependsOn", [])
        ]

    def rewrite_reference(value):
        if isinstance(value, dict):
            return {key: rewrite_reference(item) for key, item in value.items()}
        if isinstance(value, list):
            return [rewrite_reference(item) for item in value]
        return CANONICAL_REF if value == old_ref else value

    result = rewrite_reference(result)

    encoded = json.dumps(result, sort_keys=True)
    if RAW_NAME in encoded or old_ref in encoded:
        raise ValueError("local Cosmos SDK identity remains in normalized SBOM")
    if encoded.count(CANONICAL_NAME) < 2:
        raise ValueError("canonical Cosmos SDK identity was not materialized")
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    document = json.loads(args.input.read_text(encoding="utf-8"))
    normalized = normalize(document)
    args.output.write_text(
        json.dumps(normalized, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(args.output)


if __name__ == "__main__":
    main()
