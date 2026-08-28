"""Generate positive and cross-subject-negative R8 authorization vectors."""
from __future__ import annotations

import json
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "vectors" / "subject_action_bindings.json"

FIXED_ROWS = [
    (1, 1, 1, "principal"), (1, 2, 1, "principal"), (1, 3, 1, "principal"),
    (4, 1, 4, "registered"), (4, 2, 4, "registered"),
    (4, 3, 4, "registered"), (4, 4, 4, "registered"),
    (5, 1, 5, "registered"),
    (6, 1, 6, "registered"), (6, 2, 6, "registered"),
    (6, 3, 6, "registered"), (6, 4, 6, "registered"),
    (6, 5, 4, "registered"), (6, 6, 6, "registered"),
]


def main() -> None:
    cases = []
    rows = FIXED_ROWS + [
        (2, action, subject_kind, "operation")
        for action in range(1, 6)
        for subject_kind in range(1, 7)
    ]
    for namespace, action, subject_kind, mode in rows:
        size = 20 if subject_kind in (1, 3) else 32
        identity = f"{namespace:02x}{action:02x}" + "11" * (size - 2)
        base = {
            "namespace": namespace, "action": action, "mode": mode,
            "signing_subject_kind": subject_kind,
            "signing_subject_id": identity,
            "bound_subject_kind": subject_kind,
            "bound_subject_id": identity,
        }
        if mode == "principal":
            base["principal_namespace"] = 1
        suffix = f"_kind_{subject_kind}" if mode == "operation" else ""
        cases.append({"name": f"{namespace:04x}_{action}{suffix}_bound", **base, "expected": "ACCEPT"})
        cases.append({"name": f"{namespace:04x}_{action}{suffix}_cross_subject", **base,
                      "bound_subject_id": "ff" * size, "expected": "SUBJECT_ACTION_MISMATCH"})
    cases.extend([
        {"name": "transfer_non_account_principal", "namespace": 1, "action": 1,
         "mode": "principal", "signing_subject_kind": 1, "signing_subject_id": "11" * 20,
         "bound_subject_kind": 1, "bound_subject_id": "11" * 20,
         "principal_namespace": 3, "expected": "SUBJECT_ACTION_MISMATCH"},
        {"name": "key_operation_kind_mismatch", "namespace": 2, "action": 2,
         "mode": "operation", "signing_subject_kind": 1, "signing_subject_id": "11" * 20,
         "bound_subject_kind": 4, "bound_subject_id": "11" * 20,
         "expected": "SUBJECT_ACTION_MISMATCH"},
    ])
    OUT.write_text(json.dumps({"schema": "SUBJECT_ACTION_BINDING_V1", "cases": cases}, indent=2) + "\n", encoding="utf-8")
    print(f"generated {len(cases)} subject/action binding cases")


if __name__ == "__main__":
    main()
