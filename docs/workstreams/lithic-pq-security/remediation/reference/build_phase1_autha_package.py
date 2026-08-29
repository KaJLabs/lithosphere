"""Build the deterministic Autha Phase 1 implementation-review archive."""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import zipfile
from pathlib import Path, PurePosixPath

CANDIDATE = "849e3d78492ebd4136f9bbaf24208284d4218841"
RUN_ID = "33253023378"
STAMP = (2026, 8, 29, 0, 0, 0)

SOURCE_PATHS = (
    ".github/workflows/ci-toolchain.yaml",
    "docs/workstreams/lithic-pq-security/PHASE1_IMPLEMENTATION_CANDIDATE.md",
    "toolchain/Cargo.lock",
    "toolchain/Cargo.toml",
    "toolchain/crates/litho-pq-conformance/Cargo.toml",
    "toolchain/crates/litho-pq-conformance/DEPENDENCY_SECURITY.md",
    "toolchain/crates/litho-pq-conformance/NIST_VECTOR_PROVENANCE.md",
    "toolchain/crates/litho-pq-conformance/README.md",
    "toolchain/crates/litho-pq-conformance/src/lib.rs",
    "toolchain/crates/litho-pq-conformance/src/main.rs",
)

EVIDENCE_FILES = (
    "aarch64/benchmark.json",
    "aarch64/platform.txt",
    "aarch64/process-memory.txt",
    "aarch64/rustc-version.txt",
    "x86_64/benchmark.json",
    "x86_64/litho-pq-conformance.cdx.json",
    "x86_64/platform.txt",
    "x86_64/process-memory.txt",
    "x86_64/rustc-version.txt",
    "x86_64/rustsec-audit.json",
)


def repository_root() -> Path:
    result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        check=True,
        capture_output=True,
        text=True,
    )
    return Path(result.stdout.strip())


def git_bytes(repo: Path, path: str) -> bytes:
    return subprocess.run(
        ["git", "show", f"{CANDIDATE}:{path}"],
        cwd=repo,
        check=True,
        capture_output=True,
    ).stdout


def add_member(
    selected: list[tuple[str, bytes]], name: str, payload: bytes
) -> None:
    normalized = PurePosixPath(name).as_posix()
    if normalized.startswith("/") or ".." in PurePosixPath(normalized).parts:
        raise ValueError(f"unsafe archive member: {name}")
    selected.append((normalized, payload))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--evidence-root", type=Path, required=True)
    parser.add_argument("--review-doc", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    repo = repository_root()
    selected: list[tuple[str, bytes]] = []

    resolved = subprocess.run(
        ["git", "rev-parse", CANDIDATE],
        cwd=repo,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    if resolved != CANDIDATE:
        raise RuntimeError(f"candidate mismatch: {resolved}")

    identity = {
        "schema": 1,
        "candidate_commit": CANDIDATE,
        "source_pr": "https://github.com/KaJLabs/Lithosphere/pull/137",
        "evidence_run": f"https://github.com/KaJLabs/Lithosphere/actions/runs/{RUN_ID}",
        "scope": "disabled-non-consensus-makalu-phase1-candidate",
        "activation_requested": False,
    }
    add_member(
        selected,
        "CANDIDATE_IDENTITY.json",
        (json.dumps(identity, indent=2, sort_keys=True) + "\n").encode(),
    )

    handoff = repo / "docs/workstreams/lithic-pq-security/AUTHA_PHASE1_IMPLEMENTATION_HANDOFF.md"
    add_member(selected, "review/AUTHA_PHASE1_IMPLEMENTATION_HANDOFF.md", handoff.read_bytes())

    for path in SOURCE_PATHS:
        add_member(selected, f"candidate/{path}", git_bytes(repo, path))

    for relative in EVIDENCE_FILES:
        source = args.evidence_root / Path(relative)
        if not source.is_file():
            raise FileNotFoundError(source)
        add_member(selected, f"ci-evidence/{relative}", source.read_bytes())

    if not args.review_doc.is_file():
        raise FileNotFoundError(args.review_doc)
    add_member(
        selected,
        "review/Autha_Phase0_R9_Design_Freeze_Review.docx",
        args.review_doc.read_bytes(),
    )

    selected.sort(key=lambda item: item[0])
    manifest = "".join(
        f"{hashlib.sha256(payload).hexdigest()}  {name}\n"
        for name, payload in selected
    ).encode()

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(
        args.output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9
    ) as archive:
        for name, payload in selected:
            info = zipfile.ZipInfo(name, STAMP)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, payload)
        info = zipfile.ZipInfo("PACKAGE_SHA256SUMS.txt", STAMP)
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, manifest)

    print(args.output.resolve())
    print(f"members={len(selected) + 1}")
    print(f"sha256={hashlib.sha256(args.output.read_bytes()).hexdigest()}")


if __name__ == "__main__":
    main()
