#!/usr/bin/env python3
"""Validate a sanitized LITHO mainnet validator onboarding CSV.

This is an offline preparation gate. It never accesses operator keys, funds
accounts, or broadcasts transactions.
"""

from __future__ import annotations

import argparse
import base64
import csv
from decimal import Decimal, InvalidOperation
import json
from pathlib import Path
import re
import sys


REQUIRED_COLUMNS = (
    "operator_id",
    "moniker",
    "operator_evm_address",
    "operator_litho_address",
    "consensus_pubkey",
    "validator_node_id",
    "sentry_peer_endpoints",
    "self_delegation_ulitho",
    "commission_rate",
    "commission_max_rate",
    "commission_max_change_rate",
    "website",
    "security_contact",
    "hosting_provider",
    "region",
    "failure_domain",
    "key_backup_attested",
    "infrastructure_ready",
    "security_reviewed",
    "approval_reference",
)
PLACEHOLDERS = {"", "pending", "tbd", "todo", "replace_me", "n/a"}
UNIQUE_COLUMNS = (
    "operator_id",
    "moniker",
    "operator_evm_address",
    "operator_litho_address",
    "consensus_pubkey",
    "validator_node_id",
)
EVM_ADDRESS = re.compile(r"^0x[0-9a-fA-F]{40}$")
LITHO_ADDRESS = re.compile(r"^litho(?:valoper)?1[0-9a-z]{20,}$")
NODE_ID = re.compile(r"^[0-9a-fA-F]{40}$")
PEER = re.compile(r"^[0-9a-fA-F]{40}@[A-Za-z0-9.-]+:[1-9][0-9]{0,4}$")


def _missing(value: str | None) -> bool:
    return (value or "").strip().lower() in PLACEHOLDERS


def _decimal(value: str, field: str, row_number: int, errors: list[str]) -> Decimal | None:
    try:
        number = Decimal(value)
    except InvalidOperation:
        errors.append(f"row {row_number}: {field} must be a decimal")
        return None
    if number < 0 or number > 1:
        errors.append(f"row {row_number}: {field} must be between 0 and 1")
        return None
    return number


def _valid_consensus_key(value: str) -> bool:
    raw = value.strip()
    try:
        if raw.startswith("{"):
            document = json.loads(raw)
            raw = document.get("key", "")
        return len(base64.b64decode(raw, validate=True)) == 32
    except (ValueError, TypeError, json.JSONDecodeError):
        return False


def validate(
    path: Path,
    minimum_new: int,
    expected_new: int | None = None,
    minimum_commission_rate: Decimal = Decimal("0.05"),
    minimum_self_delegation_exclusive: int | None = None,
) -> dict:
    errors: list[str] = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        columns = tuple(reader.fieldnames or ())
        missing_columns = [name for name in REQUIRED_COLUMNS if name not in columns]
        unexpected_columns = [name for name in columns if name not in REQUIRED_COLUMNS]
        if missing_columns:
            errors.append(f"missing columns: {', '.join(missing_columns)}")
        if unexpected_columns:
            errors.append(f"unexpected columns: {', '.join(unexpected_columns)}")
        rows = list(reader)

    if len(rows) < minimum_new:
        errors.append(f"requires at least {minimum_new} new validator records; found {len(rows)}")
    if expected_new is not None and len(rows) != expected_new:
        errors.append(f"requires exactly {expected_new} new validator records; found {len(rows)}")

    seen: dict[str, dict[str, int]] = {name: {} for name in UNIQUE_COLUMNS}
    failure_domains: dict[str, int] = {}

    for row_number, row in enumerate(rows, start=2):
        for field in REQUIRED_COLUMNS:
            if _missing(row.get(field)):
                errors.append(f"row {row_number}: {field} is missing or still a placeholder")

        for field in UNIQUE_COLUMNS:
            value = (row.get(field) or "").strip().lower()
            if not value:
                continue
            previous = seen[field].get(value)
            if previous:
                errors.append(f"row {row_number}: {field} duplicates row {previous}")
            else:
                seen[field][value] = row_number

        evm = (row.get("operator_evm_address") or "").strip()
        if evm and not EVM_ADDRESS.fullmatch(evm):
            errors.append(f"row {row_number}: operator_evm_address is malformed")

        litho = (row.get("operator_litho_address") or "").strip()
        if litho and not LITHO_ADDRESS.fullmatch(litho):
            errors.append(f"row {row_number}: operator_litho_address is malformed")

        pubkey = (row.get("consensus_pubkey") or "").strip()
        if pubkey and not _valid_consensus_key(pubkey):
            errors.append(f"row {row_number}: consensus_pubkey must contain a 32-byte base64 key")

        node_id = (row.get("validator_node_id") or "").strip()
        if node_id and not NODE_ID.fullmatch(node_id):
            errors.append(f"row {row_number}: validator_node_id must be 40 hexadecimal characters")

        peers = [item.strip() for item in (row.get("sentry_peer_endpoints") or "").split(";") if item.strip()]
        if peers and any(not PEER.fullmatch(peer) for peer in peers):
            errors.append(f"row {row_number}: sentry_peer_endpoints must use node-id@host:port entries separated by semicolons")

        try:
            self_delegation = int(row.get("self_delegation_ulitho") or "0")
            if self_delegation <= 0:
                raise ValueError
            if (
                minimum_self_delegation_exclusive is not None
                and self_delegation <= minimum_self_delegation_exclusive
            ):
                errors.append(
                    f"row {row_number}: self_delegation_ulitho must be greater than "
                    f"{minimum_self_delegation_exclusive}"
                )
        except ValueError:
            errors.append(f"row {row_number}: self_delegation_ulitho must be a positive integer")

        rate = _decimal(row.get("commission_rate") or "", "commission_rate", row_number, errors)
        max_rate = _decimal(row.get("commission_max_rate") or "", "commission_max_rate", row_number, errors)
        max_change = _decimal(
            row.get("commission_max_change_rate") or "",
            "commission_max_change_rate",
            row_number,
            errors,
        )
        if rate is not None and max_rate is not None and rate > max_rate:
            errors.append(f"row {row_number}: commission_rate exceeds commission_max_rate")
        if rate is not None and rate < minimum_commission_rate:
            errors.append(
                f"row {row_number}: commission_rate must be at least {minimum_commission_rate}"
            )
        if max_change is not None and max_rate is not None and max_change > max_rate:
            errors.append(f"row {row_number}: commission_max_change_rate exceeds commission_max_rate")

        website = (row.get("website") or "").strip().lower()
        if website and not website.startswith("https://"):
            errors.append(f"row {row_number}: website must use HTTPS")

        for field in ("key_backup_attested", "infrastructure_ready", "security_reviewed"):
            if (row.get(field) or "").strip().lower() != "true":
                errors.append(f"row {row_number}: {field} must be true before approval")

        failure_domain = (row.get("failure_domain") or "").strip().lower()
        if failure_domain:
            failure_domains[failure_domain] = failure_domains.get(failure_domain, 0) + 1

    return {
        "ready": not errors,
        "read_only": True,
        "records": len(rows),
        "minimum_new_validators": minimum_new,
        "expected_new_validators": expected_new,
        "minimum_commission_rate": str(minimum_commission_rate),
        "minimum_self_delegation_exclusive": minimum_self_delegation_exclusive,
        "unique_operators": len(seen["operator_id"]),
        "failure_domain_counts": dict(sorted(failure_domains.items())),
        "errors": errors,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("csv_path", type=Path)
    parser.add_argument("--minimum-new", type=int, default=32)
    parser.add_argument("--expected-new", type=int)
    parser.add_argument("--minimum-commission-rate", type=Decimal, default=Decimal("0.05"))
    parser.add_argument("--minimum-self-delegation-exclusive", type=int)
    args = parser.parse_args()
    result = validate(
        args.csv_path,
        args.minimum_new,
        args.expected_new,
        args.minimum_commission_rate,
        args.minimum_self_delegation_exclusive,
    )
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["ready"] else 1


if __name__ == "__main__":
    sys.exit(main())
