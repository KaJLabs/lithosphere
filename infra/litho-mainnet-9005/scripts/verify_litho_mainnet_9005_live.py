#!/usr/bin/env python3
"""Read-only post-launch verification for LITHO mainnet 9005."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass


COSMOS_CHAIN_ID = "lithosphere_9005-1"
EVM_CHAIN_ID = 9005
SUPPLY = 1_000_000_000 * 10**18
VALIDATOR_TOKENS = 10**18
VALIDATOR_OPERATOR = "lithovaloper1hg4klgm4s2tv2gmjxke27waz49knd2rq5tzfcw"


@dataclass(frozen=True)
class Node:
    name: str
    host: str
    service: str
    comet_port: int
    evm_port: int
    minimum_peers: int


NODES = (
    Node("validator", "194.5.157.233", "lithod-mainnet-9005-val", 26657, 8545, 2),
    Node("sentry1", "31.97.39.146", "lithod-mainnet-9005-sentry", 27057, 8945, 1),
    Node("sentry2", "72.60.177.106", "lithod-mainnet-9005-sentry", 27057, 8945, 1),
)

EXPECTED_BALANCES = {
    "0x903AA7a6fc37F1947B6e4fC3832139A8D4152149": 299_999_999 * 10**18,
    "0x8A21FeDfB1782F446C3b6D3062dd31E3b5392d4c": 200_000_000 * 10**18,
    "0x4E7d740Af889EADcC902F9304315677E479aB3b6": 180_000_000 * 10**18,
    "0xF10f9C6Dd40bF34B6d9c02811dC5653dDc278D4b": 150_000_000 * 10**18,
    "0x8819B1BdcD7727118014003b701982d9F11A50a1": 120_000_000 * 10**18,
    "0xeB99a25D5Ed9f40B57485a2D9413EadC605Daf99": 50_000_000 * 10**18,
    "0xba2b6fA3758296c5237235b2aF3Ba2a96D36A860": 0,
}


def ssh(node: Node, ssh_key: str, remote_command: str) -> str:
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
            f"root@{node.host}",
            remote_command,
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


def remote_json(node: Node, ssh_key: str, command: str) -> dict:
    return json.loads(ssh(node, ssh_key, command))


def json_rpc(node: Node, ssh_key: str, method: str, params: list) -> object:
    request = json.dumps(
        {"jsonrpc": "2.0", "method": method, "params": params, "id": 1},
        separators=(",", ":"),
    )
    response = remote_json(
        node,
        ssh_key,
        "curl -fsS -H 'Content-Type: application/json' "
        f"--data '{request}' http://127.0.0.1:{node.evm_port}",
    )
    if "error" in response:
        raise RuntimeError(f"{node.name}: {method} returned {response['error']}")
    return response["result"]


def verify_node(node: Node, ssh_key: str) -> dict:
    service_state = ssh(node, ssh_key, f"systemctl is-active {node.service}")
    service_enabled = ssh(node, ssh_key, f"systemctl is-enabled {node.service}")
    assert service_state == "active", f"{node.name}: service is {service_state}"
    assert service_enabled == "enabled", f"{node.name}: service is not enabled"

    status = remote_json(
        node, ssh_key, f"curl -fsS http://127.0.0.1:{node.comet_port}/status"
    )["result"]
    sync = status["sync_info"]
    assert status["node_info"]["network"] == COSMOS_CHAIN_ID
    assert int(sync["latest_block_height"]) > 0
    assert sync["catching_up"] is False

    net_info = remote_json(
        node, ssh_key, f"curl -fsS http://127.0.0.1:{node.comet_port}/net_info"
    )["result"]
    peers = int(net_info["n_peers"])
    assert peers >= node.minimum_peers, f"{node.name}: only {peers} peers"

    evm_chain_id = int(str(json_rpc(node, ssh_key, "eth_chainId", [])), 16)
    assert evm_chain_id == EVM_CHAIN_ID
    return {
        "height": int(sync["latest_block_height"]),
        "peers": peers,
        "cosmos_chain_id": status["node_info"]["network"],
        "evm_chain_id": evm_chain_id,
    }


def verify_validator_state(ssh_key: str) -> dict:
    node = NODES[0]
    supply_response = remote_json(
        node,
        ssh_key,
        "curl -fsS 'http://127.0.0.1:1317/cosmos/bank/v1beta1/supply/by_denom?denom=ulitho'",
    )
    assert supply_response["amount"]["denom"] == "ulitho"
    assert int(supply_response["amount"]["amount"]) == SUPPLY

    staking_response = remote_json(
        node,
        ssh_key,
        "curl -fsS 'http://127.0.0.1:1317/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED'",
    )
    validators = staking_response["validators"]
    assert len(validators) == 1
    assert validators[0]["operator_address"] == VALIDATOR_OPERATOR
    assert int(validators[0]["tokens"]) == VALIDATOR_TOKENS

    block_one = remote_json(
        node,
        ssh_key,
        f"curl -fsS 'http://127.0.0.1:{node.comet_port}/block?height=1'",
    )["result"]["block"]
    assert len(block_one["data"].get("txs") or []) == 0

    balances: dict[str, int] = {}
    for address, expected in EXPECTED_BALANCES.items():
        balance = int(str(json_rpc(node, ssh_key, "eth_getBalance", [address, "latest"])), 16)
        assert balance == expected, f"unexpected balance for {address}: {balance}"
        balances[address] = balance

    return {
        "supply_ulitho": SUPPLY,
        "bonded_validators": 1,
        "validator_tokens_ulitho": VALIDATOR_TOKENS,
        "height_1_transactions": 0,
        "balances_verified": len(balances),
    }


def verify_common_block(ssh_key: str, height: int = 1) -> str:
    hashes = {}
    for node in NODES:
        block = remote_json(
            node,
            ssh_key,
            f"curl -fsS 'http://127.0.0.1:{node.comet_port}/block?height={height}'",
        )["result"]
        hashes[node.name] = block["block_id"]["hash"]
    if len(set(hashes.values())) != 1:
        raise AssertionError(f"block {height} hash mismatch: {hashes}")
    return next(iter(hashes.values()))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ssh-key", required=True)
    args = parser.parse_args()
    try:
        nodes = {node.name: verify_node(node, args.ssh_key) for node in NODES}
        chain = verify_validator_state(args.ssh_key)
        chain["height_1_hash"] = verify_common_block(args.ssh_key, 1)
    except Exception as error:
        print(f"LIVE_VERIFICATION=failed\nERROR={error}", file=sys.stderr)
        return 1

    print("LIVE_VERIFICATION=passed")
    print(json.dumps({"nodes": nodes, "chain": chain}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
