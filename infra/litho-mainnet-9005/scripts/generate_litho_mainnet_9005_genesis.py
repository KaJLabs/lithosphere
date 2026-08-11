#!/usr/bin/env python3
"""Generate a LITHO mainnet 9005 genesis candidate from the pinned binary.

The generator intentionally does not add the client's custom height-1 message.
That message is a separately signed launch transaction and is requested only
immediately before the launch ceremony.
"""

from __future__ import annotations

import argparse
import base64
import datetime as dt
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path


CHAIN_ID = "lithosphere_9005-1"
DENOM = "ulitho"
ONE_LITHO = 10**18
MAX_SUPPLY = 1_000_000_000 * ONE_LITHO
VALIDATOR_STAKE = ONE_LITHO
VALIDATOR_ACCOUNT = "litho1hg4klgm4s2tv2gmjxke27waz49knd2rq908aw2"
VALIDATOR_OPERATOR = "lithovaloper1hg4klgm4s2tv2gmjxke27waz49knd2rq5tzfcw"
BONDED_POOL = "litho1fl48vsnmsdzcv85q5d2q4z5ajdha8yu39g9gfq"
ETH_EMPTY_CODE_HASH = (
    "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
)

LIQUID_ALLOCATIONS = {
    "litho1jqa20fhuxlceg7mwflpcxgfe4r2p2g2f0nrnj5": 299_999_999 * ONE_LITHO,
    "litho13gslaha30qh5gmpmd5cx9hf3uw6njt2vru8kn9": 200_000_000 * ONE_LITHO,
    "litho1fe7hgzhc384dejgzlycyx9t80ere4vakcnphsm": 180_000_000 * ONE_LITHO,
    "litho17y8ecmw5p0e5kmvuq2q3m3t98hwz0r2t8su5ng": 150_000_000 * ONE_LITHO,
    "litho13qvmr0wdwun3rqq5qqahqxvzm8c3559pfwwwr0": 120_000_000 * ONE_LITHO,
    "litho1awv6yh27m86qk46gtgkegyl2m3s9mtue4epesa": 50_000_000 * ONE_LITHO,
}

BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"


def bech32_polymod(values: list[int]) -> int:
    generators = (0x3B6A57B2, 0x26508E6D, 0x1EA119FA, 0x3D4233DD, 0x2A1462B3)
    checksum = 1
    for value in values:
        top = checksum >> 25
        checksum = ((checksum & 0x1FFFFFF) << 5) ^ value
        for index, generator in enumerate(generators):
            if (top >> index) & 1:
                checksum ^= generator
    return checksum


def bech32_hrp_expand(hrp: str) -> list[int]:
    return [ord(char) >> 5 for char in hrp] + [0] + [
        ord(char) & 31 for char in hrp
    ]


def convert_bits(data: bytes, from_bits: int, to_bits: int) -> list[int]:
    accumulator = 0
    bit_count = 0
    result: list[int] = []
    max_value = (1 << to_bits) - 1
    for value in data:
        accumulator = (accumulator << from_bits) | value
        bit_count += from_bits
        while bit_count >= to_bits:
            bit_count -= to_bits
            result.append((accumulator >> bit_count) & max_value)
    if bit_count:
        result.append((accumulator << (to_bits - bit_count)) & max_value)
    return result


def bech32_encode(hrp: str, payload: bytes) -> str:
    data = convert_bits(payload, 8, 5)
    values = bech32_hrp_expand(hrp) + data
    polymod = bech32_polymod(values + [0] * 6) ^ 1
    checksum = [(polymod >> (5 * (5 - index))) & 31 for index in range(6)]
    return hrp + "1" + "".join(BECH32_CHARSET[value] for value in data + checksum)


def eth_account(address: str) -> dict:
    return {
        "@type": "/ethermint.types.v1.EthAccount",
        "base_account": {
            "address": address,
            "pub_key": None,
            "account_number": "0",
            "sequence": "0",
        },
        "code_hash": ETH_EMPTY_CODE_HASH,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--binary", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--consensus-pubkey", required=True)
    parser.add_argument(
        "--genesis-time",
        default=dt.datetime.now(dt.timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z"),
    )
    return parser.parse_args()


def scaffold(binary: Path) -> dict:
    with tempfile.TemporaryDirectory(prefix="litho-mainnet-genesis-") as temp_dir:
        home = Path(temp_dir) / "home"
        subprocess.run(
            [
                str(binary),
                "init",
                "validator1",
                "--chain-id",
                CHAIN_ID,
                "--home",
                str(home),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return json.loads((home / "config" / "genesis.json").read_text())


def build_genesis(genesis: dict, consensus_pubkey: str, genesis_time: str) -> dict:
    pubkey_bytes = base64.b64decode(consensus_pubkey, validate=True)
    if len(pubkey_bytes) != 32:
        raise ValueError("validator consensus public key must be 32-byte ed25519")
    consensus_address = bech32_encode(
        "lithovalcons", hashlib.sha256(pubkey_bytes).digest()[:20]
    )

    genesis["chain_id"] = CHAIN_ID
    genesis["genesis_time"] = genesis_time
    genesis["initial_height"] = "1"
    genesis["app_hash"] = ""
    genesis.pop("metadata", None)

    consensus = genesis["consensus"]["params"]
    consensus["block"].update(
        {"max_bytes": "21000000", "max_gas": "100000000", "time_iota_ms": "1000"}
    )
    consensus["evidence"].update(
        {
            "max_age_num_blocks": "100000",
            "max_age_duration": "172800000000000",
            "max_bytes": "1048576",
        }
    )
    consensus["validator"]["pub_key_types"] = ["ed25519"]

    app_state = genesis["app_state"]
    all_user_accounts = sorted([*LIQUID_ALLOCATIONS, VALIDATOR_ACCOUNT])
    app_state["auth"]["accounts"] = [
        eth_account(address) for address in all_user_accounts
    ]

    balances = [
        {
            "address": address,
            "coins": [{"denom": DENOM, "amount": str(amount)}],
        }
        for address, amount in sorted(LIQUID_ALLOCATIONS.items())
    ]
    balances.append(
        {
            "address": BONDED_POOL,
            "coins": [{"denom": DENOM, "amount": str(VALIDATOR_STAKE)}],
        }
    )
    balances.sort(key=lambda item: item["address"])
    app_state["bank"]["balances"] = balances
    app_state["bank"]["supply"] = [{"denom": DENOM, "amount": str(MAX_SUPPLY)}]
    app_state["bank"]["denom_metadata"] = [
        {
            "description": "The native staking and transaction token of Lithosphere",
            "denom_units": [
                {"denom": DENOM, "exponent": 0, "aliases": ["attoLITHO"]},
                {"denom": "litho", "exponent": 18, "aliases": ["LITHO"]},
            ],
            "base": DENOM,
            "display": "litho",
            "name": "Lithosphere",
            "symbol": "LITHO",
            "uri": "",
            "uri_hash": "",
        }
    ]

    staking = app_state["staking"]
    staking["params"].update(
        {
            "unbonding_time": "1814400s",
            "max_validators": 100,
            "max_entries": 7,
            "historical_entries": 10000,
            "bond_denom": DENOM,
            "min_commission_rate": "0.050000000000000000",
        }
    )
    staking.update(
        {
            "last_total_power": "1",
            "last_validator_powers": [
                {"address": VALIDATOR_OPERATOR, "power": "1"}
            ],
            "validators": [
                {
                    "operator_address": VALIDATOR_OPERATOR,
                    "consensus_pubkey": {
                        "@type": "/cosmos.crypto.ed25519.PubKey",
                        "key": consensus_pubkey,
                    },
                    "jailed": False,
                    "status": "BOND_STATUS_BONDED",
                    "tokens": str(VALIDATOR_STAKE),
                    "delegator_shares": f"{VALIDATOR_STAKE}.000000000000000000",
                    "description": {
                        "moniker": "validator1",
                        "identity": "",
                        "website": "",
                        "security_contact": "",
                        "details": "",
                    },
                    "unbonding_height": "0",
                    "unbonding_time": "1970-01-01T00:00:00Z",
                    "commission": {
                        "commission_rates": {
                            "rate": "0.100000000000000000",
                            "max_rate": "0.200000000000000000",
                            "max_change_rate": "0.010000000000000000",
                        },
                        "update_time": genesis_time,
                    },
                    "min_self_delegation": "1",
                    "unbonding_on_hold_ref_count": "0",
                    "unbonding_ids": [],
                }
            ],
            "delegations": [
                {
                    "delegator_address": VALIDATOR_ACCOUNT,
                    "validator_address": VALIDATOR_OPERATOR,
                    "shares": f"{VALIDATOR_STAKE}.000000000000000000",
                }
            ],
            "unbonding_delegations": [],
            "redelegations": [],
            "exported": False,
        }
    )

    app_state["slashing"]["params"].update(
        {
            "signed_blocks_window": "10000",
            "min_signed_per_window": "0.500000000000000000",
            "downtime_jail_duration": "600s",
            "slash_fraction_double_sign": "0.050000000000000000",
            "slash_fraction_downtime": "0.010000000000000000",
        }
    )
    app_state["slashing"]["signing_infos"] = [
        {
            "address": consensus_address,
            "validator_signing_info": {
                "address": consensus_address,
                "start_height": "0",
                "index_offset": "0",
                "jailed_until": "1970-01-01T00:00:00Z",
                "tombstoned": False,
                "missed_blocks_counter": "0",
            },
        }
    ]
    app_state["slashing"]["missed_blocks"] = [
        {"address": consensus_address, "missed_blocks": []}
    ]

    distribution = app_state["distribution"]
    distribution.update(
        {
            "fee_pool": {"community_pool": []},
            "delegator_withdraw_infos": [],
            "previous_proposer": "",
            "outstanding_rewards": [],
            "validator_accumulated_commissions": [],
            "validator_historical_rewards": [],
            "validator_current_rewards": [],
            "delegator_starting_infos": [],
            "validator_slash_events": [],
        }
    )
    distribution["params"].update(
        {
            "community_tax": "0.020000000000000000",
            "base_proposer_reward": "0.000000000000000000",
            "bonus_proposer_reward": "0.000000000000000000",
            "withdraw_addr_enabled": True,
        }
    )

    app_state["inflation"]["params"]["enable_inflation"] = False
    app_state["inflation"]["params"]["mint_denom"] = DENOM
    app_state["genutil"]["gen_txs"] = []
    app_state["gov"]["constitution"] = ""
    app_state["gov"]["params"].update(
        {
            "min_deposit": [
                {"denom": DENOM, "amount": str(10_000 * ONE_LITHO)}
            ],
            "expedited_min_deposit": [
                {"denom": DENOM, "amount": str(50_000 * ONE_LITHO)}
            ],
            "max_deposit_period": "172800s",
            "voting_period": "172800s",
            "expedited_voting_period": "86400s",
            "quorum": "0.334000000000000000",
            "threshold": "0.500000000000000000",
            "veto_threshold": "0.334000000000000000",
        }
    )
    app_state["evm"]["params"]["evm_denom"] = DENOM
    app_state["evm"]["params"]["allow_unprotected_txs"] = False
    app_state["feemarket"]["params"].update(
        {
            "no_base_fee": False,
            "base_fee_change_denominator": 8,
            "elasticity_multiplier": 2,
            "enable_height": "0",
            "base_fee": "1000000000",
            "min_gas_price": "0.000000000000000000",
            "min_gas_multiplier": "0.500000000000000000",
        }
    )

    liquid_total = sum(LIQUID_ALLOCATIONS.values())
    bank_total = sum(
        int(coin["amount"])
        for balance in balances
        for coin in balance["coins"]
        if coin["denom"] == DENOM
    )
    assert liquid_total == MAX_SUPPLY - VALIDATOR_STAKE
    assert bank_total == MAX_SUPPLY
    assert app_state["inflation"]["params"]["enable_inflation"] is False
    assert app_state["gov"]["constitution"] == ""
    return genesis


def main() -> None:
    args = parse_args()
    genesis = build_genesis(
        scaffold(args.binary), args.consensus_pubkey, args.genesis_time
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(genesis, indent=2, sort_keys=True) + "\n"
    args.output.write_text(serialized, encoding="utf-8")
    checksum = hashlib.sha256(serialized.encode()).hexdigest()
    print(f"OUTPUT={args.output}")
    print(f"CHAIN_ID={CHAIN_ID}")
    print(f"SUPPLY_BASE_UNITS={MAX_SUPPLY}")
    print(f"LIQUID_BASE_UNITS={MAX_SUPPLY - VALIDATOR_STAKE}")
    print(f"BONDED_BASE_UNITS={VALIDATOR_STAKE}")
    print(f"SHA256={checksum}")
    print("CUSTOM_HEIGHT_1_MESSAGE=NOT_INCLUDED_PENDING_CLIENT_TEXT")


if __name__ == "__main__":
    main()
