"""Extract the frozen reduced signature KAT fixtures from NIST ACVP JSON.

The full upstream files are intentionally not vendored. Download the four
`internalProjection.json` files from the immutable ACVP-Server commit recorded
in `NIST_VECTOR_PROVENANCE.md`, place them in one directory using the names in
`SOURCES`, and pass that directory to this script.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

UPSTREAM_COMMIT = "975de31eb83d87039ec88934fdc47d8c312b892d"
SOURCES = {
    "ml_siggen": "ML-DSA-sigGen-FIPS204_internalProjection.json",
    "ml_sigver": "ML-DSA-sigVer-FIPS204_internalProjection.json",
    "slh_siggen": "SLH-DSA-sigGen-FIPS205_internalProjection.json",
    "slh_sigver": "SLH-DSA-sigVer-FIPS205_internalProjection.json",
}

CASES = (
    ("ml_siggen", 3, 31, "ml65-siggen-tc31", ("sk", "pk", "message", "context", "signature")),
    ("ml_siggen", 5, 61, "ml87-siggen-tc61", ("sk", "pk", "message", "context", "signature")),
    ("slh_siggen", 29, 252, "slh256s-siggen-tc252", ("sk", "pk", "message", "context", "signature")),
    ("ml_sigver", 3, 33, "ml65-sigver-valid-tc33", ("pk", "message", "context", "signature")),
    ("ml_sigver", 3, 31, "ml65-sigver-invalid-tc31", ("pk", "message", "context", "signature")),
    ("ml_sigver", 5, 63, "ml87-sigver-valid-tc63", ("pk", "message", "context", "signature")),
    ("ml_sigver", 5, 61, "ml87-sigver-invalid-tc61", ("pk", "message", "context", "signature")),
    ("slh_sigver", 29, 399, "slh256s-sigver-valid-tc399", ("pk", "message", "context", "signature")),
    ("slh_sigver", 29, 393, "slh256s-sigver-invalid-tc393", ("pk", "message", "context", "signature")),
)


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source_dir", type=Path)
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "nist")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    loaded: dict[str, tuple[dict, str]] = {}
    for key, name in SOURCES.items():
        payload = (args.source_dir / name).read_bytes()
        loaded[key] = (json.loads(payload), sha256(payload))

    manifest = {
        "schema": 1,
        "upstream_repository": "https://github.com/usnistgov/ACVP-Server",
        "upstream_commit": UPSTREAM_COMMIT,
        "sources": {SOURCES[key]: digest for key, (_, digest) in loaded.items()},
        "cases": [],
    }

    for source_key, group_id, case_id, prefix, fields in CASES:
        document, _ = loaded[source_key]
        group = next(group for group in document["testGroups"] if group["tgId"] == group_id)
        case = next(test for test in group["tests"] if test["tcId"] == case_id)
        record = {
            "source": SOURCES[source_key],
            "tg_id": group_id,
            "tc_id": case_id,
            "parameter_set": group["parameterSet"],
            "test_type": group["testType"],
            "signature_interface": group["signatureInterface"],
            "pre_hash": group["preHash"],
            "deterministic": group.get("deterministic"),
            "test_passed": case.get("testPassed"),
            "reason": case.get("reason"),
            "files": {},
        }
        for field in fields:
            value = bytes.fromhex(case[field])
            name = f"{prefix}.{field}.bin"
            (args.output / name).write_bytes(value)
            record["files"][field] = {
                "name": name,
                "bytes": len(value),
                "sha256": sha256(value),
            }
        manifest["cases"].append(record)

    manifest_path = args.output / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(manifest_path)
    print(f"sha256={sha256(manifest_path.read_bytes())}")


if __name__ == "__main__":
    main()
