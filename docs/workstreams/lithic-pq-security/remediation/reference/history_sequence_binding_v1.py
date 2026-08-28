"""Python deterministic history-sequence conformance runner."""
import json
from pathlib import Path

VECTORS = Path(__file__).resolve().parents[1] / "vectors" / "history_sequences.json"
MAX = 2**64 - 1


def validate(case: dict) -> str:
    prior = int(case["prior"])
    if prior == MAX:
        return "SEQUENCE_OVERFLOW"
    expected = prior + 1
    if case["stream"] == "key":
        return "ACCEPT" if case["record"] == prior and case["next"] == expected else "SEQUENCE_MISMATCH"
    elif case["stream"] in {"registry", "provenance"}:
        values = (case["mutation"], case["next"], case["transition"])
    else:
        return "SEQUENCE_MISMATCH"
    return "ACCEPT" if all(value == expected for value in values) else "SEQUENCE_MISMATCH"


def main() -> None:
    vectors = json.loads(VECTORS.read_text(encoding="utf-8"))
    for case in vectors["cases"]:
        actual = validate(case)
        if actual != case["expected"]:
            raise SystemExit(f"history sequence mismatch: {case['name']}: {actual}")
    print(f"python history sequences verified {len(vectors['cases'])} cases")


if __name__ == "__main__":
    main()
