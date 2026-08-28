"""Independent Python behavioral verifier for AuthorizationSequenceStateV1."""
from __future__ import annotations
import copy
import json
from pathlib import Path

VECTORS = Path(__file__).resolve().parents[1] / "vectors" / "authorization_sequences.json"


def run(case: dict) -> dict:
    state: dict[str, dict[str, int]] = {}
    checkpoint: dict[str, dict[str, int]] | None = None
    accepted, errors = [], []
    for op in case["operations"]:
        kind = op["type"]
        if kind == "checkpoint":
            checkpoint = copy.deepcopy(state); accepted.append(True); errors.append("OK"); continue
        if kind == "reorg":
            if checkpoint is None: raise AssertionError("reorg without checkpoint")
            state = copy.deepcopy(checkpoint); accepted.append(True); errors.append("OK"); continue
        if kind in {"restart", "upgrade"}:
            state = copy.deepcopy(state); accepted.append(True); errors.append("OK"); continue
        key = f'{op["subject_kind"]}:{op["subject_id"]}:{op["namespace"]}:{op["action"]}'
        if kind == "initialize":
            if key in state:
                accepted.append(False); errors.append("SEQUENCE_STATE_EXISTS"); continue
            state[key] = {"next_sequence": 1, "last_height": op["height"]}
            accepted.append(True); errors.append("OK"); continue
        current = state.get(key)
        if current is None:
            accepted.append(False); errors.append("MISSING_SEQUENCE_STATE"); continue
        if op["sequence"] != current["next_sequence"]:
            accepted.append(False); errors.append("SEQUENCE_MISMATCH"); continue
        if kind == "reject":
            accepted.append(False); errors.append("ACTION_REJECTED"); continue
        if kind != "commit": raise AssertionError(kind)
        state[key] = {"next_sequence": current["next_sequence"] + 1, "last_height": op["height"]}
        accepted.append(True); errors.append("OK")
    states = [{"key": key, **state[key]} for key in sorted(state)]
    return {"accepted": accepted, "errors": errors, "states": states}


def main() -> None:
    vectors = json.loads(VECTORS.read_text(encoding="utf-8"))
    if vectors.get("schema") != "AUTHORIZATION_SEQUENCE_STATE_V1": raise SystemExit("wrong schema")
    for case in vectors["cases"]:
        actual = run(case)
        if actual != case["expected"]: raise SystemExit(f'sequence mismatch: {case["name"]}\nexpected={case["expected"]}\nactual={actual}')
    print(f'python authorization sequence state verified {len(vectors["cases"])} cases')


if __name__ == "__main__": main()
