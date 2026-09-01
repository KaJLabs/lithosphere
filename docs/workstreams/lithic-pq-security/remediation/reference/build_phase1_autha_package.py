"""Build a deterministic, self-contained Autha Phase 1 review archive."""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import subprocess
import zipfile
from pathlib import Path, PurePosixPath

FIXED_SOURCE_PATHS = (
    ".github/workflows/ci-toolchain.yaml",
    "SECURITY.md",
    "docs/workstreams/lithic-pq-security/PHASE1_IMPLEMENTATION_CANDIDATE.md",
    "docs/workstreams/lithic-pq-security/AUTHA_PHASE1_R2_HANDOFF.md",
    "docs/workstreams/lithic-pq-security/AUTHA_PHASE1_R2_REMEDIATION_MATRIX.md",
    "docs/workstreams/lithic-pq-security/remediation/reference/build_phase1_autha_package.py",
    "docs/workstreams/lithic-pq-security/remediation/reference/verify_phase1_autha_package.py",
    "toolchain/Cargo.lock",
    "toolchain/rust-toolchain.toml",
)

EVIDENCE_FILES = (
    "aarch64/benchmark.json",
    "aarch64/platform.txt",
    "aarch64/process-memory.txt",
    "aarch64/runner-image.txt",
    "aarch64/rustc-version.txt",
    "x86_64/benchmark.json",
    "x86_64/litho-pq-conformance.cdx.json",
    "x86_64/platform.txt",
    "x86_64/process-memory.txt",
    "x86_64/runner-image.txt",
    "x86_64/rustc-version.txt",
    "x86_64/rustsec-audit.json",
)

MINIMAL_WORKSPACE = b"""[workspace]\nresolver = \"2\"\nmembers = [\"crates/litho-pq-conformance\"]\n\n[workspace.package]\nversion = \"0.0.1\"\nedition = \"2021\"\nlicense = \"Apache-2.0\"\nrepository = \"https://github.com/KaJLabs/Lithosphere\"\n"""


def run(repo: Path, *command: str, text: bool = False) -> bytes | str:
    return subprocess.run(command, cwd=repo, check=True, capture_output=True, text=text).stdout


def repository_root() -> Path:
    result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"], check=True, capture_output=True, text=True
    )
    return Path(result.stdout.strip())


def git_bytes(repo: Path, candidate: str, path: str) -> bytes:
    return run(repo, "git", "show", f"{candidate}:{path}")  # type: ignore[return-value]


def candidate_paths(repo: Path, candidate: str) -> tuple[str, ...]:
    output = run(
        repo, "git", "ls-tree", "-r", "--name-only", candidate, "--",
        "toolchain/crates/litho-pq-conformance", text=True,
    )
    return tuple(line for line in output.splitlines() if line)


def add_member(selected: list[tuple[str, bytes]], name: str, payload: bytes) -> None:
    normalized = PurePosixPath(name).as_posix()
    if normalized.startswith("/") or ".." in PurePosixPath(normalized).parts:
        raise ValueError(f"unsafe archive member: {name}")
    selected.append((normalized, payload))


def parse_runner_identity(path: Path) -> dict[str, str]:
    values = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        key, separator, value = line.partition("=")
        if separator:
            values[key] = value
    return values


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidate", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--source-pr", required=True)
    parser.add_argument("--evidence-root", type=Path, required=True)
    parser.add_argument("--review-doc", type=Path, action="append", default=[])
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    repo = repository_root()
    candidate = run(repo, "git", "rev-parse", f"{args.candidate}^{{commit}}", text=True).strip()
    if candidate != args.candidate.lower():
        raise RuntimeError(f"candidate must be a full immutable commit: {candidate}")

    for architecture in ("aarch64", "x86_64"):
        identity = parse_runner_identity(args.evidence_root / architecture / "runner-image.txt")
        if identity.get("GITHUB_SHA") != candidate:
            raise RuntimeError(f"{architecture} evidence commit mismatch")
        if identity.get("GITHUB_RUN_ID") != args.run_id:
            raise RuntimeError(f"{architecture} evidence run mismatch")

    timestamp = int(run(repo, "git", "show", "-s", "--format=%ct", candidate, text=True).strip())
    instant = dt.datetime.fromtimestamp(timestamp, tz=dt.timezone.utc)
    stamp = (instant.year, instant.month, instant.day, instant.hour, instant.minute, instant.second)
    selected: list[tuple[str, bytes]] = []

    identity = {
        "schema": 2,
        "candidate_commit": candidate,
        "source_pr": args.source_pr,
        "evidence_run": f"https://github.com/KaJLabs/Lithosphere/actions/runs/{args.run_id}",
        "scope": "disabled-non-consensus-makalu-phase1-candidate",
        "activation_requested": False,
    }
    add_member(
        selected, "CANDIDATE_IDENTITY.json",
        (json.dumps(identity, indent=2, sort_keys=True) + "\n").encode(),
    )

    source_paths = tuple(dict.fromkeys((*FIXED_SOURCE_PATHS, *candidate_paths(repo, candidate))))
    for path in source_paths:
        payload = git_bytes(repo, candidate, path)
        add_member(selected, f"candidate/{path}", payload)
        if path.startswith("toolchain/crates/litho-pq-conformance/"):
            add_member(selected, f"reproduction/toolchain/{path.removeprefix('toolchain/')}", payload)

    add_member(selected, "reproduction/toolchain/Cargo.toml", MINIMAL_WORKSPACE)
    add_member(selected, "reproduction/toolchain/Cargo.lock", git_bytes(repo, candidate, "toolchain/Cargo.lock"))
    add_member(selected, "reproduction/toolchain/rust-toolchain.toml", git_bytes(repo, candidate, "toolchain/rust-toolchain.toml"))
    add_member(
        selected, "reproduction/README.md",
        b"Run: cd toolchain && cargo test -p litho-pq-conformance --release --locked\n",
    )

    for relative in EVIDENCE_FILES:
        source = args.evidence_root / Path(relative)
        if not source.is_file():
            raise FileNotFoundError(source)
        add_member(selected, f"ci-evidence/{relative}", source.read_bytes())

    for index, review_doc in enumerate(args.review_doc, start=1):
        if not review_doc.is_file():
            raise FileNotFoundError(review_doc)
        add_member(selected, f"review/{index:02d}-{review_doc.name}", review_doc.read_bytes())

    selected.sort(key=lambda item: item[0])
    manifest = "".join(
        f"{hashlib.sha256(payload).hexdigest()}  {name}\n" for name, payload in selected
    ).encode()

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, payload in selected:
            info = zipfile.ZipInfo(name, stamp)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, payload)
        info = zipfile.ZipInfo("PACKAGE_SHA256SUMS.txt", stamp)
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, manifest)

    print(args.output.resolve())
    print(f"members={len(selected) + 1}")
    print(f"sha256={hashlib.sha256(args.output.read_bytes()).hexdigest()}")


if __name__ == "__main__":
    main()
