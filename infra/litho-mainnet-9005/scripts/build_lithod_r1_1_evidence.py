#!/usr/bin/env python3
"""Build a deterministic Linux-native R1.1 Autha evidence ZIP."""
from __future__ import annotations

import hashlib
import importlib.util
import argparse
import json
import stat
import zipfile
from pathlib import Path, PurePosixPath

HERE = Path(__file__).resolve()
INFRA = HERE.parents[1]
REPO = next(parent for parent in HERE.parents if (parent / ".git").exists())
BIN = INFRA / "bin"
EVIDENCE = BIN / "lithod.evidence"
OUT_NAME = "LITHO_L1_Autha_Implementation_R1_1_Evidence_2026-08-28.zip"
PREFIX = "litho-l1-v20.0.0-r1.1"
STAMP = (2026, 8, 28, 0, 0, 0)
EXPECTED_BINARY_SHA256 = "1f03146df86391715b86971b14b6074580b7efd06d7265a1725d90e426b8efbc"

PATCHES = (
    "cosmos-sdk-v0.50.14-evmos-compat.patch",
    "evmos-v20-litho-fixed-supply.patch",
    "evmos-v20-litho-integration-tests.patch",
    "evmos-v20-litho-test-fixtures.patch",
    "evmos-v20-statedb-module-account-guard.patch",
    "evmos-v20-statedb-precompile-regression.patch",
)
TOOLS = (
    "build-lithod.sh",
    "generate-sbom.sh",
    "verify-lithod-security-dependencies.sh",
    "lithod-release-manifest.sh",
)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def default_client_work() -> Path:
    candidates = [REPO / "client-work"] + [parent / "client-work" for parent in REPO.parents]
    for candidate in candidates:
        if candidate.is_dir():
            return candidate
    raise RuntimeError("client-work directory not found; pass --client-work")


def review_file(client_work: Path, pattern: str) -> Path:
    matches = list(client_work.glob(pattern))
    if len(matches) != 1:
        raise RuntimeError(f"expected one review matching {pattern!r}, found {len(matches)}")
    return matches[0]


def load_normalizer():
    path = HERE.parent / "normalize_lithod_sbom.py"
    spec = importlib.util.spec_from_file_location("normalize_lithod_sbom", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load SBOM normalizer")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def add(selected: dict[str, tuple[bytes, int]], name: str, source: Path, mode: int = 0o644) -> None:
    if not source.is_file():
        raise RuntimeError(f"required R1.1 input is missing: {source}")
    selected[f"{PREFIX}/{PurePosixPath(name).as_posix()}"] = (source.read_bytes(), mode)


def build_payloads(client_work: Path) -> dict[str, tuple[bytes, int]]:
    selected: dict[str, tuple[bytes, int]] = {}
    binary = EVIDENCE / "lithod"
    if sha256(binary.read_bytes()) != EXPECTED_BINARY_SHA256:
        raise RuntimeError("candidate binary identity changed")
    add(selected, "bin/lithod", binary, 0o755)

    release_inputs: list[str] = []
    for tool in TOOLS:
        source = BIN / tool
        name = f"source/bin/{tool}"
        add(selected, name, source, 0o755 if tool.endswith(".sh") else 0o644)
        release_inputs.append(name)
    for patch in PATCHES:
        source = BIN / "patches" / patch
        name = f"source/bin/patches/{patch}"
        add(selected, name, source)
        release_inputs.append(name)
    for script in (
        "normalize_lithod_sbom.py",
        "build_lithod_r1_1_evidence.py",
        "verify_lithod_r1_1_evidence.py",
    ):
        source = HERE.parent / script
        name = f"source/scripts/{script}"
        add(selected, name, source, 0o755)
        release_inputs.append(name)
    linux_validator = HERE.parent / "validate_lithod_r1_1_archive_linux.sh"
    linux_validator_name = "source/scripts/validate_lithod_r1_1_archive_linux.sh"
    add(selected, linux_validator_name, linux_validator, 0o755)
    release_inputs.append(linux_validator_name)

    for source in sorted(EVIDENCE.iterdir(), key=lambda path: path.name):
        if not source.is_file() or source.name in {
            "SHA256SUMS.txt", "lithod", "lithod.cdx.json", "lithod.cdx.json.sha256"
        }:
            continue
        add(selected, f"evidence/{source.name}", source)

    raw_sbom = EVIDENCE / "lithod.cdx.json"
    add(selected, "evidence/lithod.cdx.raw.json", raw_sbom)
    normalizer = load_normalizer()
    normalized = normalizer.normalize(json.loads(raw_sbom.read_text(encoding="utf-8")))
    normalized_bytes = (json.dumps(normalized, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    selected[f"{PREFIX}/evidence/lithod.cdx.normalized.json"] = (normalized_bytes, 0o644)

    release_manifest = "\n".join(
        f"{sha256(selected[f'{PREFIX}/{name}'][0])}  {name}" for name in sorted(release_inputs)
    ) + "\n"
    selected[f"{PREFIX}/evidence/release-inputs.sha256"] = (release_manifest.encode(), 0o644)

    add(selected, "docs/AUTHA_L1_R1_1_EVIDENCE_HANDOFF_2026-08-28.md",
        INFRA / "docs" / "AUTHA_L1_R1_1_EVIDENCE_HANDOFF_2026-08-28.md")
    add(selected, "docs/MAKALU_R1_EXACT_BINARY_REGRESSION_RUNBOOK_2026-08-28.md",
        INFRA / "docs" / "MAKALU_R1_EXACT_BINARY_REGRESSION_RUNBOOK_2026-08-28.md")
    add(selected, "review/Autha_LITHO_L1_R1_Remediation_Re-Review.docx",
        review_file(client_work, "Autha LITHO L1 R1 Remediation Re-Review.docx"))
    add(selected, "review/AUTHA_AUDITS.md", review_file(client_work, "AUTHA AUDITS.md"))
    add(selected, "evidence/linux-archive-validation.txt",
        review_file(client_work, "LITHO_L1_R1_1_LINUX_ARCHIVE_VALIDATION_2026-08-28.txt"))
    return selected


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--client-work", type=Path)
    args = parser.parse_args()
    client_work = args.client_work.resolve() if args.client_work else default_client_work()
    out = client_work / OUT_NAME
    selected = build_payloads(client_work)
    checksums = "\n".join(
        f"{sha256(data)}  {name.removeprefix(PREFIX + '/')}"
        for name, (data, _) in sorted(selected.items())
    ) + "\n"
    selected[f"{PREFIX}/SHA256SUMS.txt"] = (checksums.encode(), 0o644)
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, (data, mode) in sorted(selected.items()):
            info = zipfile.ZipInfo(name, STAMP)
            info.create_system = 3
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (stat.S_IFREG | mode) << 16
            archive.writestr(info, data)
    print(out)
    print(f"members={len(selected)}")


if __name__ == "__main__":
    main()
