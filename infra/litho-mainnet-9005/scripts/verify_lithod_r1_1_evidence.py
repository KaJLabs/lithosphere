#!/usr/bin/env python3
"""Verify R1.1 archive safety, contents, modes, identities and checksums."""
from __future__ import annotations

import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path, PurePosixPath

PREFIX = "litho-l1-v20.0.0-r1.1"
EXPECTED_BINARY_SHA256 = "1f03146df86391715b86971b14b6074580b7efd06d7265a1725d90e426b8efbc"
LINE = re.compile(r"^([0-9a-f]{64})  (.+)$")
REQUIRED_INPUTS = {
    "source/bin/build-lithod.sh",
    "source/bin/generate-sbom.sh",
    "source/bin/verify-lithod-security-dependencies.sh",
    "source/bin/lithod-release-manifest.sh",
    "source/bin/patches/cosmos-sdk-v0.50.14-evmos-compat.patch",
    "source/bin/patches/evmos-v20-litho-fixed-supply.patch",
    "source/bin/patches/evmos-v20-litho-integration-tests.patch",
    "source/bin/patches/evmos-v20-litho-test-fixtures.patch",
    "source/bin/patches/evmos-v20-statedb-module-account-guard.patch",
    "source/bin/patches/evmos-v20-statedb-precompile-regression.patch",
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def parse_manifest(raw: bytes) -> dict[str, str]:
    if raw.startswith(b"\xef\xbb\xbf") or b"\r" in raw:
        raise ValueError("manifest encoding")
    result: dict[str, str] = {}
    for number, line in enumerate(raw.decode("utf-8").splitlines(), 1):
        match = LINE.fullmatch(line)
        if not match or match.group(2) in result:
            raise ValueError(f"manifest line {number}")
        result[match.group(2)] = match.group(1)
    return result


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: verify_lithod_r1_1_evidence.py ARCHIVE.zip")
    with zipfile.ZipFile(Path(sys.argv[1]).resolve()) as archive:
        infos = archive.infolist()
        names = [info.filename for info in infos]
        if len(names) != len(set(names)):
            raise SystemExit("duplicate archive member")
        if any(
            "\\" in name or PurePosixPath(name).is_absolute() or ".." in PurePosixPath(name).parts
            for name in names
        ):
            raise SystemExit("unsafe or non-POSIX archive path")
        root = f"{PREFIX}/"
        if any(not name.startswith(root) for name in names):
            raise SystemExit("unexpected archive root")
        relative = {name.removeprefix(root): name for name in names}
        manifest_name = relative.get("SHA256SUMS.txt")
        if manifest_name is None:
            raise SystemExit("missing payload manifest")
        expected = parse_manifest(archive.read(manifest_name))
        if set(expected) != set(relative) - {"SHA256SUMS.txt"}:
            raise SystemExit("payload manifest coverage mismatch")
        for name, digest in expected.items():
            if sha256(archive.read(relative[name])) != digest:
                raise SystemExit(f"payload checksum mismatch: {name}")

        binary_name = relative["bin/lithod"]
        if sha256(archive.read(binary_name)) != EXPECTED_BINARY_SHA256:
            raise SystemExit("candidate binary identity changed")
        binary_info = archive.getinfo(binary_name)
        if binary_info.create_system != 3 or ((binary_info.external_attr >> 16) & 0o777) != 0o755:
            raise SystemExit("candidate binary mode is not Linux 0755")

        release_manifest = parse_manifest(archive.read(relative["evidence/release-inputs.sha256"]))
        if not REQUIRED_INPUTS.issubset(release_manifest):
            raise SystemExit("release input manifest is incomplete")
        for name, digest in release_manifest.items():
            if name not in relative or sha256(archive.read(relative[name])) != digest:
                raise SystemExit(f"release input mismatch: {name}")

        sbom = json.loads(archive.read(relative["evidence/lithod.cdx.normalized.json"]))
        encoded = json.dumps(sbom, sort_keys=True)
        if "/tmp/litho-cosmos-sdk-v0.50.14" in encoded:
            raise SystemExit("normalized SBOM retains local Cosmos SDK identity")
        components = [
            item for item in sbom.get("components", [])
            if item.get("name") == "github.com/cosmos/cosmos-sdk"
            and item.get("version") == "v0.50.14"
        ]
        if len(components) != 1:
            raise SystemExit("normalized SBOM canonical Cosmos SDK identity missing")
        properties = {item["name"]: item["value"] for item in components[0].get("properties", [])}
        if properties.get("litho:upstream-commit") != "f2e6295b662fdb27ea33da1296c29588ccdaab42":
            raise SystemExit("normalized SBOM upstream identity mismatch")
        if properties.get("litho:final-source-diff-sha256") != "8e11c9d752266d552bb651d6d1ac752cdf3c1ef91976e2551793f11731832480":
            raise SystemExit("normalized SBOM patched-source identity mismatch")
    print(f"verified {len(expected)} R1.1 payload files")


if __name__ == "__main__":
    main()
