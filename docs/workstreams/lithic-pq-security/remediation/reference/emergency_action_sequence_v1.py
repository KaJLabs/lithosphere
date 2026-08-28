"""Python R8 emergency registry sole-counter conformance runner."""
from __future__ import annotations

import copy
import json
from pathlib import Path

VECTORS = Path(__file__).resolve().parents[1] / "vectors" / "emergency_action_sequences.json"
MAX_U64 = 2**64 - 1


def run(initial: dict, case: dict) -> dict:
    state = copy.deepcopy(initial)
    accepted: list[bool] = []
    errors: list[str] = []
    for operation in case["operations"]:
        if operation["type"] == "rotate":
            state["authority"] = operation["new_authority"]
            accepted.append(True)
            errors.append("OK")
            continue
        if operation["type"] != "emergency":
            raise AssertionError(operation["type"])
        if state["general_sequence_present"]:
            ok, error = False, "COMPETING_SEQUENCE_STATE"
        elif state["next_sequence"] is None:
            ok, error = False, "MISSING_EMERGENCY_SEQUENCE_STATE"
        elif operation["authority"] != state["authority"]:
            ok, error = False, "EMERGENCY_AUTHORITY_MISMATCH"
        elif operation["sequence"] != state["next_sequence"]:
            ok, error = False, "EMERGENCY_SEQUENCE_MISMATCH"
        elif not operation["action_valid"]:
            ok, error = False, "ACTION_REJECTED"
        elif state["next_sequence"] == MAX_U64:
            ok, error = False, "SEQUENCE_OVERFLOW"
        else:
            state["next_sequence"] += 1
            ok, error = True, "OK"
        accepted.append(ok)
        errors.append(error)
    return {"accepted": accepted, "errors": errors, "state": state}


def main() -> None:
    vectors = json.loads(VECTORS.read_text(encoding="utf-8"))
    for case in vectors["cases"]:
        initial = {**vectors["initial"], **case.get("initial_override", {})}
        actual = run(initial, case)
        if actual != case["expected"]:
            raise SystemExit(f"emergency sequence mismatch: {case['name']}: {actual}")
    print(f"python emergency sole-counter verified {len(vectors['cases'])} cases")


if __name__ == "__main__":
    main()
