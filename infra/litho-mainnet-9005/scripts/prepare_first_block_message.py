#!/usr/bin/env python3
"""Create an unsigned MetaMask request for LITHO mainnet block height 1."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import urllib.request


EXPECTED_CHAIN_ID = 9005
ADDRESS_PATTERN = re.compile(r"^0x[0-9a-fA-F]{40}$")


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
    parser.add_argument("--signer", required=True)
    parser.add_argument("--message", required=True)
    args = parser.parse_args()

    if not ADDRESS_PATTERN.fullmatch(args.signer):
        raise SystemExit("signer must be a 20-byte 0x-prefixed EVM address")
    message_bytes = args.message.encode("utf-8")
    if not message_bytes:
        raise SystemExit("message must not be empty")
    if len(message_bytes) > 1024:
        raise SystemExit("message exceeds the 1024-byte launch limit")

    chain_id = int(str(rpc(args.rpc, "eth_chainId", [])), 16)
    if chain_id != EXPECTED_CHAIN_ID:
        raise SystemExit(f"RPC reported chain ID {chain_id}, expected 9005")

    nonce = rpc(args.rpc, "eth_getTransactionCount", [args.signer, "pending"])
    data = "0x" + message_bytes.hex()
    gas_limit = hex(21_000 + (16 * len(message_bytes)) + 10_000)
    request = {
        "from": args.signer,
        "to": args.signer,
        "value": "0x0",
        "data": data,
        "chainId": hex(EXPECTED_CHAIN_ID),
        "nonce": nonce,
        "gas": gas_limit,
    }

    print(
        json.dumps(
            {
                "chainId": EXPECTED_CHAIN_ID,
                "messageUtf8Bytes": len(message_bytes),
                "messageSha256": hashlib.sha256(message_bytes).hexdigest(),
                "metamaskTransactionRequest": request,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
