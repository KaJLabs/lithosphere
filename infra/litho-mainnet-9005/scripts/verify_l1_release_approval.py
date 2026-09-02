#!/usr/bin/env python3
"""Fail closed unless an L1 binary has complete pre-activation approvals."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PLACEHOLDERS = {"", "pending", "tbd", "todo", "unknown", "n/a", "none"}
REQUIRED_ENVIRONMENTS = {"makalu", "kamet", "mainnet"}


def parse_time(value: str, field: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field} must be an ISO-8601 timestamp") from exc
    if parsed.tzinfo is None:
        raise ValueError(f"{field} must include a timezone")
    return parsed.astimezone(timezone.utc)


def required_text(value: Any, field: str) -> str:
    if not isinstance(value, str) or value.strip().lower() in PLACEHOLDERS:
        raise ValueError(f"{field} must be a non-placeholder string")
    return value.strip()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_hashed_artifact(entry: Any, field: str, base_dir: Path) -> datetime:
    if not isinstance(entry, dict):
        raise ValueError(f"{field} must be an object")
    if entry.get("decision") != "approved":
        raise ValueError(f"{field}.decision must be approved")
    required_text(entry.get("approvalReference"), f"{field}.approvalReference")
    approved_at = parse_time(entry.get("approvedAt"), f"{field}.approvedAt")
    artifact = Path(required_text(entry.get("artifactPath"), f"{field}.artifactPath"))
    if not artifact.is_absolute():
        artifact = base_dir / artifact
    if not artifact.is_file():
        raise ValueError(f"{field}.artifactPath does not exist: {artifact}")
    expected = required_text(entry.get("artifactSha256"), f"{field}.artifactSha256").lower()
    if len(expected) != 64 or any(c not in "0123456789abcdef" for c in expected):
        raise ValueError(f"{field}.artifactSha256 must be a lowercase SHA-256")
    actual = sha256(artifact)
    if actual != expected:
        raise ValueError(f"{field} artifact SHA-256 mismatch")
    return approved_at


def verify(approval_path: Path, binary_path: Path, environment: str, at: datetime) -> dict[str, Any]:
    data = json.loads(approval_path.read_text(encoding="utf-8"))
    if data.get("schemaVersion") != 1:
        raise ValueError("schemaVersion must be 1")
    required_text(data.get("approvalId"), "approvalId")
    required_text(data.get("releaseId"), "releaseId")

    target = required_text(data.get("environment"), "environment").lower()
    if target not in REQUIRED_ENVIRONMENTS or target != environment:
        raise ValueError("environment does not match the requested target")

    expected_binary = required_text(data.get("binarySha256"), "binarySha256").lower()
    if len(expected_binary) != 64 or any(c not in "0123456789abcdef" for c in expected_binary):
        raise ValueError("binarySha256 must be a lowercase SHA-256")
    if sha256(binary_path) != expected_binary:
        raise ValueError("candidate binary SHA-256 mismatch")

    window = data.get("window")
    if not isinstance(window, dict):
        raise ValueError("window must be an object")
    starts_at = parse_time(window.get("startsAt"), "window.startsAt")
    ends_at = parse_time(window.get("endsAt"), "window.endsAt")
    if starts_at >= ends_at:
        raise ValueError("window must end after it starts")
    if not starts_at <= at <= ends_at:
        raise ValueError("verification time is outside the approved window")

    autha_at = verify_hashed_artifact(data.get("authaApproval"), "authaApproval", approval_path.parent)
    kaj_at = verify_hashed_artifact(data.get("kajLabsApproval"), "kajLabsApproval", approval_path.parent)
    if autha_at > starts_at or kaj_at > starts_at:
        raise ValueError("all approvals must predate the activation window")

    operator = required_text(data.get("executionOperator"), "executionOperator")
    observer = required_text(data.get("independentObserver"), "independentObserver")
    if operator.casefold() == observer.casefold():
        raise ValueError("executionOperator and independentObserver must differ")
    required_text(data.get("validator"), "validator")
    required_text(data.get("cosmosChainId"), "cosmosChainId")
    if not isinstance(data.get("evmChainId"), int):
        raise ValueError("evmChainId must be an integer")
    if data.get("singleValidatorPauseRequired") is True and data.get("singleValidatorPauseApproved") is not True:
        raise ValueError("single-validator pause requires explicit approval")

    return {
        "approvalId": data["approvalId"],
        "releaseId": data["releaseId"],
        "environment": target,
        "binarySha256": expected_binary,
        "verifiedAt": at.isoformat().replace("+00:00", "Z"),
        "windowStartsAt": starts_at.isoformat().replace("+00:00", "Z"),
        "windowEndsAt": ends_at.isoformat().replace("+00:00", "Z"),
        "result": "approved",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--approval", required=True, type=Path)
    parser.add_argument("--binary", required=True, type=Path)
    parser.add_argument("--environment", required=True, choices=sorted(REQUIRED_ENVIRONMENTS))
    parser.add_argument("--at", help="UTC verification time; defaults to now")
    args = parser.parse_args()
    at = parse_time(args.at, "--at") if args.at else datetime.now(timezone.utc)
    try:
        result = verify(args.approval, args.binary, args.environment, at)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"L1_RELEASE_GATE=denied reason={exc}")
        return 1
    print(json.dumps(result, sort_keys=True))
    print("L1_RELEASE_GATE=approved")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
