"""Generate explicit sequence initialization and missing-state R8 cases."""
from __future__ import annotations

import copy
import json
from pathlib import Path

from authorization_sequence_state_v1 import run

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "vectors" / "authorization_sequences.json"


def action_key(operation: dict) -> tuple | None:
    if operation.get("type") not in {"commit", "reject"}:
        return None
    return tuple(operation[name] for name in ("subject_kind", "subject_id", "namespace", "action"))


def main() -> None:
    vectors = json.loads(PATH.read_text(encoding="utf-8"))
    for case in vectors["cases"]:
        if any(op.get("type") == "initialize" for op in case["operations"]):
            continue
        seen = set()
        rewritten = []
        for operation in case["operations"]:
            key = action_key(operation)
            if key is not None and key not in seen:
                rewritten.append({
                    "type": "initialize", "subject_kind": key[0], "subject_id": key[1],
                    "namespace": key[2], "action": key[3], "height": operation["height"],
                })
                seen.add(key)
            rewritten.append(operation)
        case["operations"] = rewritten
        case["expected"] = run(case)

    missing = {
        "name": "missing_sequence_state_rejected",
        "operations": [{
            "type": "commit", "subject_kind": 1,
            "subject_id": "11" * 20, "namespace": 1, "action": 1,
            "sequence": 1, "height": 100,
        }],
    }
    missing["expected"] = run(missing)
    vectors["cases"] = [case for case in vectors["cases"] if case["name"] != missing["name"]] + [missing]
    PATH.write_text(json.dumps(vectors, indent=2) + "\n", encoding="utf-8")
    print(f"generated {len(vectors['cases'])} authorization sequence cases")


if __name__ == "__main__":
    main()
