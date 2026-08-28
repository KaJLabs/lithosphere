"""Bind the emergency successor migration to usable CryptoRegistry state."""
from __future__ import annotations

import copy
import json
from pathlib import Path

from emergency_authority_upgrade_v1 import run

PATH = Path(__file__).resolve().parents[1] / "vectors" / "emergency_authority_upgrade.json"


def main() -> None:
    vectors = json.loads(PATH.read_text(encoding="utf-8"))
    initial = vectors["initial"]
    initial.update({
        "registry_root": "dd" * 64,
        "successor_profile_state": "ACTIVE",
        "scheduled_state": "NONE",
        "scheduled_height": 0,
    })
    for case in vectors["cases"]:
        for operation in case["operations"]:
            if operation["type"] == "upgrade":
                operation.setdefault("registry_root", initial["registry_root"])
        case["expected"] = run(initial, case)

    additions = []
    for name, override, expected_error in (
        ("registry_root_mismatch", {}, "CRYPTO_REGISTRY_ROOT_MISMATCH"),
        ("successor_profile_disabled", {"successor_profile_state": "DISABLED"}, "SUCCESSOR_PROFILE_NOT_ACTIVE"),
        ("successor_disable_scheduled_at_migration", {"scheduled_state": "DISABLED", "scheduled_height": 1000}, "SUCCESSOR_PROFILE_TRANSITION_CONFLICT"),
    ):
        case = {
            "name": name,
            "initial_override": override,
            "operations": [{
                "type": "upgrade", "height": 1000,
                "commitment": initial["successor_commitment"],
                "registry_root": "ee" * 64 if name == "registry_root_mismatch" else initial["registry_root"],
            }],
        }
        effective = {**initial, **override}
        case["expected"] = run(effective, case)
        assert case["expected"]["errors"] == [expected_error]
        additions.append(case)
    vectors["cases"] = [case for case in vectors["cases"] if case["name"] not in {item["name"] for item in additions}] + additions
    PATH.write_text(json.dumps(vectors, indent=2) + "\n", encoding="utf-8")
    print(f"generated {len(vectors['cases'])} emergency upgrade cases")


if __name__ == "__main__":
    main()
