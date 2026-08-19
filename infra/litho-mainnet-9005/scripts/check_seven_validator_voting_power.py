#!/usr/bin/env python3
"""Read-only projected voting-power gate for seven new LITHO validators."""

from __future__ import annotations

import argparse
import csv
from decimal import Decimal
import json
from pathlib import Path
import sys
import urllib.parse
import urllib.request


def get_json(base_url: str, path: str, query: dict[str, str] | None = None) -> dict:
    url = f"{base_url.rstrip('/')}{path}"
    if query:
        url = f"{url}?{urllib.parse.urlencode(query)}"
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)


def evaluate(
    current: list[dict],
    planned: list[dict],
    expected_new: int = 7,
    comparison_operator: str | None = None,
) -> dict:
    current_tokens = [int(item["tokens"]) for item in current]
    planned_tokens = [int(item["self_delegation_ulitho"]) for item in planned]
    comparison_matches = [
        item for item in current if item.get("operator_address") == comparison_operator
    ]
    if comparison_operator and len(comparison_matches) != 1:
        comparator = None
    elif comparison_operator:
        comparator = int(comparison_matches[0]["tokens"])
    else:
        comparator = max(current_tokens, default=0)
    current_total = sum(current_tokens)
    planned_total = sum(planned_tokens)
    projected_total = current_total + planned_total
    projected_share = Decimal(planned_total) / Decimal(projected_total) if projected_total else Decimal(0)
    checks = {
        "exactly_seven_planned": len(planned) == expected_new,
        "comparison_validator_found": comparator is not None,
        "every_new_validator_exceeds_comparison": comparator is not None
        and bool(planned_tokens)
        and all(value > comparator for value in planned_tokens),
        "projected_new_group_exceeds_two_thirds": projected_share > (Decimal(2) / Decimal(3)),
    }
    return {
        "ready": all(checks.values()),
        "read_only": True,
        "current_bonded_validators": len(current),
        "planned_validators": len(planned),
        "comparison_operator_address": comparison_operator,
        "comparison_validator_tokens_ulitho": str(comparator) if comparator is not None else None,
        "current_total_tokens_ulitho": str(current_total),
        "planned_total_tokens_ulitho": str(planned_total),
        "projected_new_group_voting_power_share": format(projected_share, ".18f"),
        "checks": checks,
        "warning": "Projection excludes delegations and stake changes after this query; rerun immediately before each activation.",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("csv_path", type=Path)
    parser.add_argument("--rest-url", required=True)
    parser.add_argument("--expected-new", type=int, default=7)
    parser.add_argument(
        "--comparison-operator",
        help="Original validator lithovaloper address; otherwise compare with the largest live validator",
    )
    args = parser.parse_args()

    try:
        response = get_json(
            args.rest_url,
            "/cosmos/staking/v1beta1/validators",
            {"status": "BOND_STATUS_BONDED", "pagination.limit": "200"},
        )
        with args.csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
            planned = list(csv.DictReader(handle))
        result = evaluate(
            response.get("validators", []),
            planned,
            args.expected_new,
            args.comparison_operator,
        )
    except Exception as error:
        print(json.dumps({"ready": False, "read_only": True, "error": str(error)}, indent=2))
        return 2

    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["ready"] else 1


if __name__ == "__main__":
    sys.exit(main())
