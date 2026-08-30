"""Verify Phase 1 archive safety, identity, coverage, and checksums."""
from __future__ import annotations

import argparse
import hashlib
import json
import zipfile
from pathlib import Path, PurePosixPath


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    parser.add_argument("--candidate")
    parser.add_argument("--run-id")
    return parser.parse_args()


def runner_values(payload: bytes) -> dict[str, str]:
    values = {}
    for line in payload.decode().splitlines():
        key, separator, value = line.partition("=")
        if separator:
            values[key] = value
    return values


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
        expected = {}
        for line in archive.read(manifest_name).decode().splitlines():
            digest, name = line.split("  ", 1)
            expected[name] = digest
        payload_names = set(names) - {manifest_name}
        if set(expected) != payload_names:
            raise RuntimeError("checksum manifest coverage mismatch")
        for name, digest in expected.items():
            if hashlib.sha256(archive.read(name)).hexdigest() != digest:
                raise RuntimeError(f"checksum mismatch: {name}")

        identity = json.loads(archive.read("CANDIDATE_IDENTITY.json"))
        candidate = identity.get("candidate_commit")
        run_url = identity.get("evidence_run", "")
        run_id = run_url.rsplit("/", 1)[-1]
        if not isinstance(candidate, str) or len(candidate) != 40:
            raise RuntimeError("invalid candidate identity")
        if args.candidate and candidate != args.candidate:
            raise RuntimeError("candidate identity mismatch")
        if args.run_id and run_id != args.run_id:
            raise RuntimeError("run identity mismatch")
        if identity.get("activation_requested") is not False:
            raise RuntimeError("package must not request activation")

        for architecture in ("aarch64", "x86_64"):
            runner = runner_values(archive.read(f"ci-evidence/{architecture}/runner-image.txt"))
            if runner.get("GITHUB_SHA") != candidate or runner.get("GITHUB_RUN_ID") != run_id:
                raise RuntimeError(f"{architecture} evidence identity mismatch")

        required = (
            "candidate/",
            "ci-evidence/",
            "reproduction/toolchain/Cargo.toml",
            "reproduction/toolchain/Cargo.lock",
            "reproduction/toolchain/crates/litho-pq-conformance/src/lib.rs",
            "reproduction/toolchain/crates/litho-pq-conformance/fixtures/nist/manifest.json",
        )
        for item in required:
            present = (
                any(name.startswith(item) for name in payload_names)
                if item.endswith("/")
                else item in payload_names
            )
            if not present:
                raise RuntimeError(f"missing required package content: {item}")

    print(f"verified={args.archive.resolve()}")
    print(f"members={len(names)}")
    print(f"sha256={hashlib.sha256(args.archive.read_bytes()).hexdigest()}")


if __name__ == "__main__":
    main()
