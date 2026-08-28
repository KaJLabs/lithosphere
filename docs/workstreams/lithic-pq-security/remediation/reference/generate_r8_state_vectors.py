"""Add the focused R8 lifecycle adversarial cases and compute exact results."""
from __future__ import annotations

import copy
import json
from pathlib import Path

from authorization_state_transition_v1 import run_case

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "vectors" / "authorization_state_transitions.json"


def main() -> None:
    vectors = json.loads(PATH.read_text(encoding="utf-8"))
    base = copy.deepcopy(vectors["cases"][0]["initial"])
    request = {
        "type": "request", "kind": "ROTATE", "slot": 1,
        "prior_epoch": 1, "epoch": 2, "deadline": 110,
        "activation": 1000, "height": 100,
    }
    additions = [
        {
            "name": "maximum_pending_horizon_enforced",
            "initial": copy.deepcopy(base),
            "operations": [{**request, "activation": 100101}],
        },
        {
            "name": "recovery_can_cancel_after_ordinary_deadline",
            "initial": copy.deepcopy(base),
            "operations": [request, {"type": "cancel", "authority": "ordinary", "height": 500},
                           {"type": "cancel", "authority": "recovery", "height": 501}],
        },
        {
            "name": "second_pending_request_rejected",
            "initial": copy.deepcopy(base),
            "operations": [request, {**request, "kind": "RECOVER", "slot": 2,
                                      "prior_slot": 1, "height": 101}],
        },
    ]
    retained = [case for case in vectors["cases"] if case["name"] not in {item["name"] for item in additions}]
    for case in additions:
        case["expected"] = run_case(case)
    vectors["cases"] = retained + additions
    PATH.write_text(json.dumps(vectors, indent=2) + "\n", encoding="utf-8")
    print(f"generated {len(vectors['cases'])} authorization lifecycle cases")


if __name__ == "__main__":
    main()
