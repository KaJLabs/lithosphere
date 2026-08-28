"""Python R8 authorization-subject binding conformance runner."""
from __future__ import annotations

import hmac
import json
from pathlib import Path

VECTORS = Path(__file__).resolve().parents[1] / "vectors" / "subject_action_bindings.json"

RULES = {
    (1, 1): (1, "principal"), (1, 2): (1, "principal"), (1, 3): (1, "principal"),
    (2, 1): (None, "operation"), (2, 2): (None, "operation"), (2, 3): (None, "operation"),
    (2, 4): (None, "operation"), (2, 5): (None, "operation"),
    (4, 1): (4, "registered"), (4, 2): (4, "registered"),
    (4, 3): (4, "registered"), (4, 4): (4, "registered"),
    (5, 1): (5, "registered"),
    (6, 1): (6, "registered"), (6, 2): (6, "registered"),
    (6, 3): (6, "registered"), (6, 4): (6, "registered"),
    (6, 5): (4, "registered"), (6, 6): (6, "registered"),
}


def validate(case: dict) -> str:
    rule = RULES.get((case["namespace"], case["action"]))
    if rule is None or rule[1] != case["mode"]:
        return "SUBJECT_ACTION_MISMATCH"
    if rule[0] is not None and rule[0] != case["signing_subject_kind"]:
        return "SUBJECT_ACTION_MISMATCH"
    if case["signing_subject_kind"] not in range(1, 7):
        return "SUBJECT_ACTION_MISMATCH"
    if case["bound_subject_kind"] != case["signing_subject_kind"]:
        return "SUBJECT_ACTION_MISMATCH"
    if case["mode"] == "principal" and case.get("principal_namespace") not in (1, 2):
        return "SUBJECT_ACTION_MISMATCH"
    try:
        signing = bytes.fromhex(case["signing_subject_id"])
        bound = bytes.fromhex(case["bound_subject_id"])
    except ValueError:
        return "SUBJECT_ACTION_MISMATCH"
    expected_length = 20 if case["signing_subject_kind"] in (1, 3) else 32
    if len(signing) != expected_length or len(bound) != expected_length or not hmac.compare_digest(signing, bound):
        return "SUBJECT_ACTION_MISMATCH"
    return "ACCEPT"


def main() -> None:
    vectors = json.loads(VECTORS.read_text(encoding="utf-8"))
    for case in vectors["cases"]:
        actual = validate(case)
        if actual != case["expected"]:
            raise SystemExit(f"subject binding mismatch: {case['name']}: {actual}")
    print(f"python subject/action binding verified {len(vectors['cases'])} cases")


if __name__ == "__main__":
    main()
