"""Generate deterministic history-stream sequence conformance vectors."""
from __future__ import annotations

import json
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "vectors" / "history_sequences.json"


def main() -> None:
    cases = [
        {"name": "key_exact", "stream": "key", "prior": 1, "record": 1, "next": 2, "expected": "ACCEPT"},
        {"name": "key_record_gap", "stream": "key", "prior": 1, "record": 2, "next": 2, "expected": "SEQUENCE_MISMATCH"},
        {"name": "key_state_not_incremented", "stream": "key", "prior": 1, "record": 1, "next": 1, "expected": "SEQUENCE_MISMATCH"},
        {"name": "registry_exact", "stream": "registry", "prior": 7, "mutation": 8, "next": 8, "transition": 8, "expected": "ACCEPT"},
        {"name": "registry_mutation_gap", "stream": "registry", "prior": 7, "mutation": 9, "next": 9, "transition": 9, "expected": "SEQUENCE_MISMATCH"},
        {"name": "registry_transition_mismatch", "stream": "registry", "prior": 7, "mutation": 8, "next": 8, "transition": 9, "expected": "SEQUENCE_MISMATCH"},
        {"name": "provenance_exact", "stream": "provenance", "prior": 10, "mutation": 11, "next": 11, "transition": 11, "expected": "ACCEPT"},
        {"name": "provenance_state_mismatch", "stream": "provenance", "prior": 10, "mutation": 11, "next": 12, "transition": 11, "expected": "SEQUENCE_MISMATCH"},
        {"name": "u64_overflow", "stream": "registry", "prior": "18446744073709551615", "mutation": 0, "next": 0, "transition": 0, "expected": "SEQUENCE_OVERFLOW"},
    ]
    OUT.write_text(json.dumps({"schema": "HISTORY_SEQUENCE_BINDING_V1", "cases": cases}, indent=2) + "\n", encoding="utf-8")
    print(f"generated {len(cases)} history sequence cases")


if __name__ == "__main__":
    main()
