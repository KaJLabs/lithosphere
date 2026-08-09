#!/usr/bin/env python3
"""Read-only progression monitor for every LITHO mainnet consensus node."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone


EXPECTED_CHAIN_ID = "lithosphere_9005-1"


@dataclass(frozen=True)
class Node:
    name: str
    host: str
    service: str
    comet_port: int
    minimum_peers: int


NODES = (
    Node("validator", "194.5.157.233", "lithod-mainnet-9005-val", 26657, 2),
    Node("sentry1", "31.97.39.146", "lithod-mainnet-9005-sentry", 27057, 1),
    Node("sentry2", "72.60.177.106", "lithod-mainnet-9005-sentry", 27057, 1),
)


def ssh(node: Node, user: str, ssh_key: str, command: str) -> str:
    process = subprocess.run(
        [
            "ssh",
            "-i",
            ssh_key,
            "-o",
            "BatchMode=yes",
            "-o",
            "StrictHostKeyChecking=yes",
            "-o",
            "ConnectTimeout=8",
            f"{user}@{node.host}",
            command,
        ],
        check=False,
        capture_output=True,
        text=True,
        timeout=20,
    )
    if process.returncode != 0:
        raise RuntimeError(
            f"{node.name}: remote command failed: {process.stderr.strip()}"
        )
    return process.stdout.strip()


def sample_node(node: Node, user: str, ssh_key: str) -> dict[str, object]:
    active = ssh(node, user, ssh_key, f"systemctl is-active {node.service}")
    status = json.loads(
        ssh(
            node,
            user,
            ssh_key,
            f"curl -fsS --max-time 8 http://127.0.0.1:{node.comet_port}/status",
        )
    )["result"]
    net_info = json.loads(
        ssh(
            node,
            user,
            ssh_key,
            f"curl -fsS --max-time 8 http://127.0.0.1:{node.comet_port}/net_info",
        )
    )["result"]
    return {
        "service_active": active == "active",
        "chain_id": status["node_info"]["network"],
        "height": int(status["sync_info"]["latest_block_height"]),
        "catching_up": bool(status["sync_info"]["catching_up"]),
        "peers": int(net_info["n_peers"]),
    }


def sample_all(user: str, ssh_key: str) -> dict[str, dict[str, object]]:
    with ThreadPoolExecutor(max_workers=len(NODES)) as executor:
        futures = {
            node.name: executor.submit(sample_node, node, user, ssh_key)
            for node in NODES
        }
        return {name: future.result() for name, future in futures.items()}


def evaluate_progression(
    first: dict[str, dict[str, object]],
    second: dict[str, dict[str, object]],
    nodes: tuple[Node, ...] = NODES,
    max_height_spread: int = 20,
) -> dict[str, object]:
    checks: dict[str, bool] = {}
    for node in nodes:
        before = first[node.name]
        after = second[node.name]
        prefix = node.name
        checks[f"{prefix}_service_active"] = bool(after["service_active"])
        checks[f"{prefix}_chain_id"] = after["chain_id"] == EXPECTED_CHAIN_ID
        checks[f"{prefix}_not_catching_up"] = not bool(after["catching_up"])
        checks[f"{prefix}_peer_floor"] = int(after["peers"]) >= node.minimum_peers
        checks[f"{prefix}_height_advanced"] = int(after["height"]) > int(before["height"])

    heights = [int(second[node.name]["height"]) for node in nodes]
    checks["node_height_spread"] = max(heights) - min(heights) <= max_height_spread
    return {
        "healthy": all(checks.values()),
        "checked_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "expected_chain_id": EXPECTED_CHAIN_ID,
        "checks": checks,
        "first": first,
        "second": second,
        "height_spread": max(heights) - min(heights),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ssh-key", required=True)
    parser.add_argument("--ssh-user", default="lithomonitor")
    parser.add_argument("--sample-seconds", type=int, default=30)
    parser.add_argument("--max-height-spread", type=int, default=20)
    args = parser.parse_args()

    if not 5 <= args.sample_seconds <= 120:
        parser.error("--sample-seconds must be between 5 and 120")
    if args.max_height_spread < 0:
        parser.error("--max-height-spread must not be negative")

    try:
        first = sample_all(args.ssh_user, args.ssh_key)
        time.sleep(args.sample_seconds)
        second = sample_all(args.ssh_user, args.ssh_key)
        result = evaluate_progression(
            first, second, max_height_spread=args.max_height_spread
        )
    except Exception as error:
        print(json.dumps({"healthy": False, "error": str(error)}, indent=2))
        return 2

    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["healthy"] else 1


if __name__ == "__main__":
    sys.exit(main())
