"""Generate sole-counter vectors for emergency registry action 0004/4."""
from __future__ import annotations

import json
from pathlib import Path

from emergency_action_sequence_v1 import run

OUT = Path(__file__).resolve().parents[1] / "vectors" / "emergency_action_sequences.json"


def main() -> None:
    initial = {"authority": "aa" * 32, "next_sequence": 7, "general_sequence_present": False}
    cases = [
        {"name": "exact_wrapper_sequence", "operations": [
            {"type": "emergency", "authority": initial["authority"], "sequence": 7, "action_valid": True}]},
        {"name": "replay_rejected", "operations": [
            {"type": "emergency", "authority": initial["authority"], "sequence": 7, "action_valid": True},
            {"type": "emergency", "authority": initial["authority"], "sequence": 7, "action_valid": True}]},
        {"name": "gap_rejected", "operations": [
            {"type": "emergency", "authority": initial["authority"], "sequence": 8, "action_valid": True}]},
        {"name": "failed_action_does_not_consume", "operations": [
            {"type": "emergency", "authority": initial["authority"], "sequence": 7, "action_valid": False},
            {"type": "emergency", "authority": initial["authority"], "sequence": 7, "action_valid": True}]},
        {"name": "authority_rotation_preserves_counter", "operations": [
            {"type": "rotate", "new_authority": "bb" * 32},
            {"type": "emergency", "authority": "bb" * 32, "sequence": 7, "action_valid": True}]},
        {"name": "parallel_general_counter_rejected", "initial_override": {"general_sequence_present": True},
         "operations": [{"type": "emergency", "authority": initial["authority"], "sequence": 7, "action_valid": True}]},
        {"name": "missing_wrapper_counter_rejected", "initial_override": {"next_sequence": None},
         "operations": [{"type": "emergency", "authority": initial["authority"], "sequence": 7, "action_valid": True}]},
    ]
    for case in cases:
        case["expected"] = run({**initial, **case.get("initial_override", {})}, case)
    OUT.write_text(json.dumps({"schema": "EMERGENCY_ACTION_SEQUENCE_V1", "initial": initial, "cases": cases}, indent=2) + "\n", encoding="utf-8")
    print(f"generated {len(cases)} emergency sole-counter cases")


if __name__ == "__main__":
    main()
