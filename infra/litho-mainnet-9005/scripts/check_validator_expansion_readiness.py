#!/usr/bin/env python3
"""Read-only LITHO validator-expansion preflight.

Queries a supplied Cosmos REST/LCD endpoint and verifies network identity,
staking capacity, and uniqueness of the currently bonded validator set. It
does not access keys, fund accounts, or broadcast transactions.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import urllib.request


EXPECTED_CHAIN_ID = "lithosphere_9005-1"
TARGET_VALIDATORS = 33


def get_json(base_url: str, path: str, query: dict[str, str] | None = None) -> dict:
    url = f"{base_url.rstrip('/')}{path}"
    if query:
        url = f"{url}?{urllib.parse.urlencode(query)}"
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rest-url", required=True, help="HTTPS Cosmos REST/LCD base URL")
    parser.add_argument("--expected-chain-id", default=EXPECTED_CHAIN_ID)
    parser.add_argument("--target", type=int, default=TARGET_VALIDATORS)
    args = parser.parse_args()

    try:
        node_info = get_json(args.rest_url, "/cosmos/base/tendermint/v1beta1/node_info")
        params = get_json(args.rest_url, "/cosmos/staking/v1beta1/params")
        bonded = get_json(
            args.rest_url,
            "/cosmos/staking/v1beta1/validators",
            {"status": "BOND_STATUS_BONDED", "pagination.limit": "200"},
        )
    except Exception as error:
        print(json.dumps({"ready": False, "error": str(error)}, indent=2))
        return 2

    chain_id = node_info.get("default_node_info", {}).get("network")
    max_validators = int(params.get("params", {}).get("max_validators", 0))
    validators = bonded.get("validators", [])
    operators = [item.get("operator_address") for item in validators]
    consensus_keys = [json.dumps(item.get("consensus_pubkey"), sort_keys=True) for item in validators]

    checks = {
        "chain_id_matches": chain_id == args.expected_chain_id,
        "staking_capacity_sufficient": max_validators >= args.target,
        "operator_addresses_unique": len(operators) == len(set(operators)),
        "consensus_keys_unique": len(consensus_keys) == len(set(consensus_keys)),
    }
    result = {
        "ready": all(checks.values()),
        "read_only": True,
        "chain_id": chain_id,
        "target_validators": args.target,
        "max_validators": max_validators,
        "bonded_validators": len(validators),
        "additional_bonded_needed": max(args.target - len(validators), 0),
        "checks": checks,
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["ready"] else 1


if __name__ == "__main__":
    sys.exit(main())
