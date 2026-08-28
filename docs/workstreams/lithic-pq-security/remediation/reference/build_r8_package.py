"""Build deterministic POSIX-path Phase 0 R8 Autha handoff archive."""
from __future__ import annotations

import hashlib
import re
import zipfile
from pathlib import Path, PurePosixPath

HERE = Path(__file__).resolve()
REM = HERE.parents[1]
WORK = REM.parent
REPO = next(path for path in HERE.parents if (path / "client-work").is_dir())
OUT = REPO / "client-work" / "LITHO_PQ_PHASE0_REMEDIATION_R8_2026-08-28.zip"


def excluded(source: Path) -> bool:
    name = source.name
    if "__pycache__" in source.parts or source.suffix == ".pyc":
        return True
    if re.fullmatch(r"(?:build|verify)_r[2-7]_package\.py", name):
        return True
    if name.startswith("AUTHA_PHASE0_") and name.endswith("_HANDOFF.md") and name != "AUTHA_PHASE0_R8_HANDOFF.md":
        return True
    if name.startswith("AUTHA_R") and name.endswith("_REMEDIATION_MATRIX.md") and name != "AUTHA_R8_REMEDIATION_MATRIX.md":
        return True
    if name in {"AUTHA_PHASE0_REMEDIATION_HANDOFF.md", "AUTHA_REMEDIATION_MATRIX.md"}:
        return True
    return False


def review() -> Path:
    found = list((REPO / "client-work").glob("*Phase 0 R7 Design Re-Review*.docx"))
    if len(found) != 1:
        raise RuntimeError(f"expected one R7 review, found {len(found)}")
    return found[0]


def files() -> list[tuple[Path, str]]:
    selected: list[tuple[Path, str]] = []
    for source in REM.rglob("*"):
        if not source.is_file() or excluded(source):
            continue
        selected.append((source, PurePosixPath(source.relative_to(WORK)).as_posix()))
    selected.append((review(), "review/Autha_PQ_Phase0_R7_Design_ReReview.docx"))
    return sorted(selected, key=lambda item: item[1])


def main() -> None:
    selected = files()
    manifest = ("\n".join(
        f"{hashlib.sha256(source.read_bytes()).hexdigest()}  {name}"
        for source, name in selected
    ) + "\n").encode()
    stamp = (2026, 8, 28, 0, 0, 0)
    with zipfile.ZipFile(OUT, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for source, name in selected:
            info = zipfile.ZipInfo(name, stamp)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, source.read_bytes())
        info = zipfile.ZipInfo("PACKAGE_SHA256SUMS.txt", stamp)
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, manifest)
    print(OUT)
    print(f"members={len(selected) + 1}")


if __name__ == "__main__":
    main()
