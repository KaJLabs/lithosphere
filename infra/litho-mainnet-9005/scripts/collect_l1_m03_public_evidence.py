#!/usr/bin/env python3
"""Collect reproducible, credential-free public evidence for L1 R1.1 M03."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen


EVM_RPC = "https://rpc.litho.ai"
COMET_RPC = "https://rpc.litho.ai/status"
REST = "https://api.litho.ai"
HARNESS = "0x1Dc5cbc1cf1E21937D0E12c002A11AA5C154362F"
BASELINE_HEIGHT = 13_498_831
FINAL_HEIGHT = 13_498_855
TRANSACTIONS = {
    "ordinary-eoa-control": "0x0c57ffb50084f01af902ffe879be8a3a26447c65a3e3dbba4c594e36a4f5b520",
    "harness-deployment": "0xb3e6bc801375827b297e77404738fb30bcbbda7c8adb534f06f73b682299acb3",
    "staking-authorization": "0xdce57e9f8821403753f5409be02a3c40f82192dadddf3fa5424aa2b93713dc08",
    "exploit-before": "0x4536a3c64e007dfca2f6c6f92daabe0d21d610c2fbe30540057b63ee32f02e74",
    "exploit-after": "0x350e1b28547ead4b91dfc89a76976a245991115338b3e67a33506904b5337291",
    "exploit-before-after": "0x50f90c870b4f4e8f02c24a1a51e9d3d7ec70c812273998f9467e8a6d4fc6e109",
    "exploit-after-value": "0xde2eaef4dd08f950981010548362a2ed3b5a99387af287d924bacad686b5a025",
    "earlier-exploit-before": "0xbd5199343b08fd39b4d0f7b1cf0f1ffca47a4137e0e15c567d2c284efe234799",
}


def canonical(value: object) -> bytes:
    return (json.dumps(value, indent=2, sort_keys=True) + "\n").encode()


def request_json(url: str, *, body: dict | None = None, headers: dict[str, str] | None = None) -> object:
    data = canonical(body) if body is not None else None
    request = Request(url, data=data, headers=headers or {})
    if body is not None:
        request.add_header("Content-Type", "application/json")
    try:
        with urlopen(request, timeout=30) as response:
            return {
                "httpStatus": response.status,
                "headers": {k.lower(): v for k, v in response.headers.items()},
                "body": json.loads(response.read()),
            }
    except HTTPError as exc:
        raw = exc.read()
        try:
            parsed: object = json.loads(raw)
        except json.JSONDecodeError:
            parsed = raw.decode(errors="replace")
        return {"httpStatus": exc.code, "body": parsed}


def rpc(method: str, params: list[object]) -> object:
    return request_json(EVM_RPC, body={"jsonrpc": "2.0", "id": 1, "method": method, "params": params})


def write(path: Path, value: object) -> None:
    path.write_bytes(canonical(value))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=False)

    write(output / "collection-metadata.json", {
        "collectedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "collector": "collect_l1_m03_public_evidence.py",
        "scope": "credential-free public RPC evidence; no transaction submission",
    })
    write(output / "evm-chain-id.json", rpc("eth_chainId", []))
    write(output / "comet-status.json", request_json(COMET_RPC))

    blocks: set[str] = set()
    for label, tx_hash in TRANSACTIONS.items():
        transaction = rpc("eth_getTransactionByHash", [tx_hash])
        receipt = rpc("eth_getTransactionReceipt", [tx_hash])
        write(output / f"tx-{label}.json", transaction)
        write(output / f"receipt-{label}.json", receipt)
        if isinstance(receipt, dict):
            result = receipt.get("body", {}).get("result") if isinstance(receipt.get("body"), dict) else None
            if isinstance(result, dict) and isinstance(result.get("blockNumber"), str):
                blocks.add(result["blockNumber"])

    for height in sorted(blocks, key=lambda value: int(value, 16)):
        write(output / f"block-{int(height, 16)}.json", rpc("eth_getBlockByNumber", [height, False]))

    for label, height in (("baseline", BASELINE_HEIGHT), ("final", FINAL_HEIGHT)):
        tag = hex(height)
        write(output / f"block-{label}-{height}.json", rpc("eth_getBlockByNumber", [tag, False]))
        write(output / f"harness-balance-{label}-{height}.json", rpc("eth_getBalance", [HARNESS, tag]))
        write(output / f"harness-code-{label}-{height}.json", rpc("eth_getCode", [HARNESS, tag]))

    write(output / "harness-code-latest.json", rpc("eth_getCode", [HARNESS, "latest"]))
    rest_queries = {
        "rest-node-info": "/cosmos/base/tendermint/v1beta1/node_info",
        "rest-supply-ulitho": "/cosmos/bank/v1beta1/supply/by_denom?denom=ulitho",
        "rest-staking-pool": "/cosmos/staking/v1beta1/pool",
        "rest-bonded-validators": "/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED",
        "rest-module-accounts": "/cosmos/auth/v1beta1/module_accounts",
    }
    for label, path in rest_queries.items():
        write(output / f"{label}-current.json", request_json(REST + path))
    for height in (BASELINE_HEIGHT, FINAL_HEIGHT):
        headers = {"x-cosmos-block-height": str(height)}
        write(output / f"rest-supply-ulitho-{height}.json", request_json(
            REST + "/cosmos/bank/v1beta1/supply/by_denom?denom=ulitho", headers=headers
        ))
        write(output / f"rest-staking-pool-{height}.json", request_json(
            REST + "/cosmos/staking/v1beta1/pool", headers=headers
        ))

    manifest = []
    for path in sorted(output.iterdir()):
        if path.name == "SHA256SUMS.txt":
            continue
        manifest.append(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}")
    (output / "SHA256SUMS.txt").write_text("\n".join(manifest) + "\n", encoding="ascii", newline="\n")
    print(f"PUBLIC_EVIDENCE={output}")
    print(f"FILES={len(manifest) + 1}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
