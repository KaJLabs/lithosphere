#!/usr/bin/env python3
"""Validate manual L1 gate inputs before they reach external tools."""

from __future__ import annotations

import argparse
import re
from pathlib import PurePosixPath


ENVIRONMENTS = {"makalu", "kamet", "mainnet"}
RELEASE_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._+:-]{0,127}")
ASSET_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}")
APPROVAL_NAME_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.json")
APPROVAL_DIRECTORY = PurePosixPath("infra/litho-mainnet-9005/docs/approvals")


def validate(environment: str, release_tag: str, asset_name: str, approval_path: str) -> None:
    if environment not in ENVIRONMENTS:
        raise ValueError("unsupported target environment")
    if not RELEASE_RE.fullmatch(release_tag) or ".." in release_tag:
        raise ValueError("unsafe release tag")
    if not ASSET_RE.fullmatch(asset_name) or ".." in asset_name:
        raise ValueError("unsafe binary asset name")

    candidate = PurePosixPath(approval_path)
    if candidate.is_absolute() or candidate.parent != APPROVAL_DIRECTORY:
        raise ValueError("approval JSON must be directly under the reviewed approvals directory")
    if not APPROVAL_NAME_RE.fullmatch(candidate.name) or ".." in candidate.name:
        raise ValueError("unsafe approval JSON name")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--environment", required=True)
    parser.add_argument("--release-tag", required=True)
    parser.add_argument("--binary-asset-name", required=True)
    parser.add_argument("--approval-bundle-path", required=True)
    args = parser.parse_args()
    try:
        validate(args.environment, args.release_tag, args.binary_asset_name, args.approval_bundle_path)
    except ValueError as exc:
        parser.error(str(exc))
    print("L1_RELEASE_GATE_INPUTS=valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
