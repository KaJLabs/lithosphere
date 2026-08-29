"""Verify Autha Phase 1 archive paths, identity, coverage and checksums."""
from __future__ import annotations

import argparse
import hashlib
import json
import zipfile
from pathlib import Path, PurePosixPath

CANDIDATE = "849e3d78492ebd4136f9bbaf24208284d4218841"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    with zipfile.ZipFile(args.archive) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)):
            raise RuntimeError("duplicate archive members")
        for name in names:
            path = PurePosixPath(name)
            if path.is_absolute() or ".." in path.parts or "\\" in name:
                raise RuntimeError(f"unsafe archive member: {name}")

        manifest_name = "PACKAGE_SHA256SUMS.txt"
        if manifest_name not in names:
            raise RuntimeError("missing checksum manifest")
        expected: dict[str, str] = {}
        for line in archive.read(manifest_name).decode().splitlines():
            digest, name = line.split("  ", 1)
            expected[name] = digest

        payload_names = set(names) - {manifest_name}
        if set(expected) != payload_names:
            raise RuntimeError("checksum manifest coverage mismatch")
        for name, digest in expected.items():
            actual = hashlib.sha256(archive.read(name)).hexdigest()
            if actual != digest:
                raise RuntimeError(f"checksum mismatch: {name}")

        identity = json.loads(archive.read("CANDIDATE_IDENTITY.json"))
        if identity.get("candidate_commit") != CANDIDATE:
            raise RuntimeError("candidate identity mismatch")
        if identity.get("activation_requested") is not False:
            raise RuntimeError("package must not request activation")

        required_prefixes = ("candidate/", "ci-evidence/", "review/")
        for prefix in required_prefixes:
            if not any(name.startswith(prefix) for name in payload_names):
                raise RuntimeError(f"missing required section: {prefix}")

    print(f"verified={args.archive.resolve()}")
    print(f"members={len(names)}")
    print(f"sha256={hashlib.sha256(args.archive.read_bytes()).hexdigest()}")


if __name__ == "__main__":
    main()
