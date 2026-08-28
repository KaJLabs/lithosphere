"""Verify R8 archive paths, manifest coverage and payload checksums."""
from __future__ import annotations

import hashlib
import re
import sys
import zipfile
from pathlib import Path, PurePosixPath

MANIFEST = "PACKAGE_SHA256SUMS.txt"
LINE = re.compile(r"^([0-9a-f]{64})  (.+)$")


def fail(message: str) -> None:
    raise SystemExit(f"verification failed: {message}")


def main() -> None:
    if len(sys.argv) != 2:
        fail("usage: verify_r8_package.py ARCHIVE.zip")
    archive_path = Path(sys.argv[1]).resolve()
    with zipfile.ZipFile(archive_path) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)) or MANIFEST not in names:
            fail("members/manifest")
        if any("\\" in name or PurePosixPath(name).is_absolute() or ".." in PurePosixPath(name).parts for name in names):
            fail("unsafe path")
        raw = archive.read(MANIFEST)
        if raw.startswith(b"\xef\xbb\xbf") or b"\r" in raw:
            fail("manifest encoding")
        expected: dict[str, str] = {}
        for number, line in enumerate(raw.decode().splitlines(), 1):
            match = LINE.fullmatch(line)
            if not match:
                fail(f"manifest line {number}")
            digest, name = match.groups()
            if name in expected:
                fail("duplicate checksum")
            expected[name] = digest
        if set(expected) != set(names) - {MANIFEST}:
            fail("manifest coverage")
        for name, digest in expected.items():
            if hashlib.sha256(archive.read(name)).hexdigest() != digest:
                fail(name)
    print(f"verified {len(expected)} payload files")


if __name__ == "__main__":
    main()
