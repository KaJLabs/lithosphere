"""Independent Python AUTHORIZATION_STATE_TRANSITION_V1 conformance runner."""
from __future__ import annotations

import copy
import json
from pathlib import Path

VECTORS = Path(__file__).resolve().parents[1] / "vectors" / "authorization_state_transitions.json"
MIN_CANCELLATION_WINDOW = 10
MIN_ACTIVATION_DELAY = 11
MAX_PENDING_HORIZON = 100_000


class Reject(Exception):
    pass


def key(state: dict, slot: int, epoch: int) -> dict | None:
    return next((item for item in state["keys"] if item["slot"] == slot and item["epoch"] == epoch), None)


def next_epoch(state: dict, slot: int) -> int:
    epochs = [item["epoch"] for item in state["keys"] if item["slot"] == slot]
    return max(epochs, default=0) + 1


def request(state: dict, op: dict, consensus_height: int) -> None:
    if state["pending"] is not None:
        raise Reject("PENDING_EXISTS")
    kind = op["kind"]
    if kind not in {"REGISTER", "ROTATE", "DISABLE", "RECOVER"}:
        raise Reject("UNKNOWN_OPERATION")
    if op["deadline"] < consensus_height + MIN_CANCELLATION_WINDOW:
        raise Reject("CANCELLATION_WINDOW_TOO_SHORT")
    if op["activation"] <= op["deadline"] or op["activation"] < consensus_height + MIN_ACTIVATION_DELAY:
        raise Reject("INVALID_WINDOW")
    if op["activation"] > consensus_height + MAX_PENDING_HORIZON:
        raise Reject("PENDING_HORIZON_EXCEEDED")

    prior_epoch = op.get("prior_epoch", 0)
    if kind in {"REGISTER", "ROTATE", "RECOVER"} and op["epoch"] != next_epoch(state, op["slot"]):
        raise Reject("NON_MONOTONIC_EPOCH")
    if kind == "REGISTER" and prior_epoch != 0:
        raise Reject("INVALID_PREDECESSOR")
    if kind in {"ROTATE", "DISABLE"}:
        prior = key(state, op["slot"], prior_epoch)
        if prior is None or prior["state"] != "ACTIVE":
            raise Reject("NO_ACTIVE_PREDECESSOR")
    if kind == "RECOVER":
        prior = key(state, op["prior_slot"], prior_epoch)
        if prior is None or prior["state"] != "ACTIVE":
            raise Reject("NO_ACTIVE_PREDECESSOR")

    state["pending"] = {
        "kind": kind,
        "slot": op["slot"],
        "epoch": op["epoch"],
        "prior_epoch": prior_epoch,
        "prior_slot": op.get("prior_slot", 0 if kind == "REGISTER" else op["slot"]),
        "deadline": op["deadline"],
        "activation": op["activation"],
        "next_policy_version": state["policy_version"] + 1,
        "next_authorization_epoch": state["authorization_epoch"] + 1,
    }
    if kind != "DISABLE":
        state["keys"].append({"slot": op["slot"], "epoch": op["epoch"], "state": "PENDING_ACTIVATION"})
    state["records"].append(f"{kind}_REQUESTED")


def cancel(state: dict, op: dict, consensus_height: int) -> None:
    pending = state["pending"]
    if pending is None:
        raise Reject("NO_PENDING_MUTATION")
    recovery_cancel = op.get("authority", "ordinary") == "recovery" and consensus_height < pending["activation"]
    if consensus_height > pending["deadline"] and not recovery_cancel:
        raise Reject("CANCELLATION_CLOSED")
    if pending["kind"] != "DISABLE":
        proposed = key(state, pending["slot"], pending["epoch"])
        if proposed is None or proposed["state"] != "PENDING_ACTIVATION":
            raise Reject("PENDING_KEY_MISMATCH")
        proposed["state"] = "CANCELLED"
    state["pending"] = None
    state["records"].append("PENDING_CANCELLED")


def activate(state: dict, op: dict, consensus_height: int) -> None:
    pending = state["pending"]
    if pending is None:
        raise Reject("NO_PENDING_MUTATION")
    if "claimed_execution_height" in op:
        raise Reject("UNREGISTERED_EXECUTION_HEIGHT_FIELD")
    if consensus_height < pending["activation"] or consensus_height <= pending["deadline"]:
        raise Reject("NOT_MATURE")
    kind = pending["kind"]
    if kind == "REGISTER":
        key(state, pending["slot"], pending["epoch"])["state"] = "ACTIVE"
    elif kind == "ROTATE":
        key(state, pending["slot"], pending["prior_epoch"])["state"] = "ROTATED"
        key(state, pending["slot"], pending["epoch"])["state"] = "ACTIVE"
    elif kind == "DISABLE":
        key(state, pending["slot"], pending["prior_epoch"])["state"] = "DISABLED"
    elif kind == "RECOVER":
        key(state, pending["prior_slot"], pending["prior_epoch"])["state"] = "RECOVERED"
        key(state, pending["slot"], pending["epoch"])["state"] = "ACTIVE"
    else:
        raise Reject("UNKNOWN_OPERATION")
    state["policy_version"] = pending["next_policy_version"]
    state["authorization_epoch"] = pending["next_authorization_epoch"]
    state["pending"] = None
    state["records"].append("PENDING_ACTIVATED")


def governance(state: dict, op: dict, consensus_height: int) -> None:
    if op["action"] != op["inner_action"] or op["action"] != 4 or op["target_type"] != 2 or op["emergency"] is not True:
        raise Reject("GOVERNANCE_DISPATCH_MISMATCH")
    if op["authority"] != "PQ_REGISTRY_EMERGENCY_2_OF_3":
        raise Reject("WRONG_AUTHORITY_ROOT")
    state["records"].append("EMERGENCY_DISABLE_AUTHORIZED")


def run_case(case: dict) -> dict:
    state = copy.deepcopy(case["initial"])
    state.setdefault("pending", None)
    state.setdefault("records", [])
    accepted, errors = [], []
    handlers = {"request": request, "cancel": cancel, "activate": activate, "governance": governance}
    for step in case["operations"]:
        before = copy.deepcopy(state)
        operation = {key: value for key, value in step.items() if key != "height"}
        consensus_height = step["height"]
        try:
            handlers[operation["type"]](state, operation, consensus_height)
        except Reject as exc:
            state = before
            accepted.append(False)
            errors.append(str(exc))
        else:
            accepted.append(True)
            errors.append("OK")
    state["keys"] = sorted(state["keys"], key=lambda item: (item["slot"], item["epoch"]))
    return {"accepted": accepted, "errors": errors, **state}


def main() -> None:
    vectors = json.loads(VECTORS.read_text(encoding="utf-8"))
    if vectors.get("schema") != "AUTHORIZATION_STATE_TRANSITION_V1":
        raise SystemExit("wrong vector schema")
    for case in vectors["cases"]:
        actual = run_case(case)
        if actual != case["expected"]:
            raise SystemExit(f"state transition mismatch: {case['name']}\nexpected={case['expected']}\nactual={actual}")
    print(f"python authorization state machine verified {len(vectors['cases'])} complete sequences")


if __name__ == "__main__":
    main()
