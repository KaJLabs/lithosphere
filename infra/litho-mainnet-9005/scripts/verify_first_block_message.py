#!/usr/bin/env python3
"""Verify the exact client message in a successful EVM transaction at height 1."""

from __future__ import annotations

import argparse
import hashlib
import json
import urllib.request


EXPECTED_CHAIN_ID = 9005


def rpc(url: str, method: str, params: list) -> object:
    body = json.dumps(
        {"jsonrpc": "2.0", "method": method, "params": params, "id": 1}
    ).encode()
    request = urllib.request.Request(
        url, data=body, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        payload = json.load(response)
    if payload.get("error"):
        raise RuntimeError(f"{method} failed: {payload['error']}")
    return payload["result"]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rpc", required=True)
    parser.add_argument("--message", required=True)
    parser.add_argument("--signer")
    args = parser.parse_args()

    message_bytes = args.message.encode("utf-8")
    expected_data = "0x" + message_bytes.hex()
    chain_id = int(str(rpc(args.rpc, "eth_chainId", [])), 16)
    if chain_id != EXPECTED_CHAIN_ID:
        raise SystemExit(f"RPC reported chain ID {chain_id}, expected 9005")

    block = rpc(args.rpc, "eth_getBlockByNumber", ["0x1", True])
    if not block:
        raise SystemExit("EVM block 1 is not available")

    matching = [
        tx
        for tx in block.get("transactions", [])
        if tx.get("input", "").lower() == expected_data.lower()
        and (
            args.signer is None
            or tx.get("from", "").lower() == args.signer.lower()
        )
    ]
    if len(matching) != 1:
        raise SystemExit(
            f"expected exactly one matching transaction in block 1, found {len(matching)}"
        )

    transaction = matching[0]
    receipt = rpc(args.rpc, "eth_getTransactionReceipt", [transaction["hash"]])
    if receipt.get("blockNumber") != "0x1":
        raise SystemExit("matching transaction was not committed at height 1")
    if receipt.get("status") != "0x1":
        raise SystemExit("height-1 message transaction did not succeed")

    print(
        json.dumps(
            {
                "verified": True,
                "chainId": EXPECTED_CHAIN_ID,
                "blockNumber": 1,
                "transactionHash": transaction["hash"],
                "signer": transaction["from"],
                "messageUtf8Bytes": len(message_bytes),
                "messageSha256": hashlib.sha256(message_bytes).hexdigest(),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
