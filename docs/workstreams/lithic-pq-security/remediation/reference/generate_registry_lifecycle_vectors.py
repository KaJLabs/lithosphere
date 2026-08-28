"""Generate R8 CryptoRegistry mutation/lifecycle vectors with exact LCE roots."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from lce_v1 import encode_object, f_ascii, f_bytes, f_object_list, f_u8, f_u16, f_u32, f_u64

OUT = Path(__file__).resolve().parents[1] / "vectors" / "registry_lifecycle.json"
ZERO = "00" * 64
STATES = {1: "EXPERIMENTAL", 2: "ACTIVE", 3: "DEPRECATED", 4: "DISABLED"}
NORMAL_EDGES = {(1, 2), (2, 3), (3, 4)}
NORMAL_DELAY = 86_400
EMERGENCY_DELAY = 100


def domain(name: str, data: bytes) -> bytes:
    return hashlib.sha3_512(name.encode("ascii") + b"\0" + data).digest()


def profile_bytes(item: dict) -> bytes:
    fill = item["id"] & 0xFF
    return encode_object(0x0040, [
        f_u16(1, item["id"]), f_ascii(2, item["name"]),
        f_bytes(3, bytes([fill]) * 32), f_bytes(4, bytes(32)),
        f_bytes(5, bytes([fill ^ 0x55]) * 64), f_bytes(6, b"LITHO-PQ-AUTH-V1"),
        f_u32(7, 1952), f_u32(8, 3309),
        f_bytes(9, bytes([fill ^ 0xAA]) * 64),
        f_bytes(10, bytes([fill ^ 0xCC]) * 64), f_u64(11, item["definition_height"]),
    ])


def lifecycle_bytes(item: dict) -> bytes:
    return encode_object(0x0044, [
        f_u16(1, item["id"]), f_u8(2, item["current"]),
        f_u64(3, item["state_height"]), f_u8(4, item["scheduled"]),
        f_u64(5, item["scheduled_height"]),
    ])


def state_bytes(state: dict) -> bytes:
    return encode_object(0x0042, [
        f_u64(1, state["sequence"]),
        f_object_list(2, [profile_bytes(item) for item in state["profiles"]]),
        f_object_list(3, [lifecycle_bytes(item) for item in state["lifecycles"]]),
        f_bytes(4, bytes.fromhex(state["prior_root"])),
    ])


def root(state: dict) -> str:
    return domain("LITHO_CRYPTO_PROFILE_STATE_V1", state_bytes(state)).hex()


def lifecycle(state: dict, profile_id: int) -> dict | None:
    return next((item for item in state["lifecycles"] if item["id"] == profile_id), None)


def effective(entry: dict, height: int) -> int:
    if entry["scheduled"] and height >= entry["scheduled_height"]:
        return entry["scheduled"]
    return entry["current"]


def materialize(entry: dict, height: int) -> None:
    if entry["scheduled"] and height >= entry["scheduled_height"]:
        entry["current"] = entry["scheduled"]
        entry["state_height"] = entry["scheduled_height"]
        entry["scheduled"] = 0
        entry["scheduled_height"] = 0


def commit(state: dict, work: dict) -> None:
    old = root(state)
    state.clear()
    state.update(work)
    state["sequence"] += 1
    state["prior_root"] = old


def apply(state: dict, op: dict, height: int) -> tuple[bool, str]:
    kind = op["type"]
    profile_id = op.get("profile_id", 1)
    entry = lifecycle(state, profile_id)
    if kind in {"observe", "historical"}:
        return (entry is not None, "OK" if entry is not None else "PROFILE_NOT_FOUND")
    if kind == "admit_registration":
        if entry is None:
            return False, "PROFILE_NOT_FOUND"
        value = effective(entry, height)
        if value in (1, 2):
            return True, "OK"
        return False, "PROFILE_DEPRECATED" if value == 3 else "PROFILE_DISABLED"

    work = json.loads(json.dumps(state))
    work_entry = lifecycle(work, profile_id)
    if kind == "define":
        proposed = op.get("proposed_profile")
        if work_entry is not None:
            return False, "PROFILE_EXISTS"
        if proposed is None or proposed.get("id") != profile_id:
            return False, "PROFILE_ID_MISMATCH"
        if op.get("prior_state") != 0 or op.get("next_state") != 1:
            return False, "INVALID_DEFINE_LIFECYCLE"
        if op.get("activation_height") != height or proposed.get("definition_height") != height:
            return False, "INVALID_DEFINE_HEIGHT"
        work["profiles"].append(proposed)
        work["lifecycles"].append({"id": profile_id, "current": 1, "state_height": height, "scheduled": 0, "scheduled_height": 0})
        work["profiles"].sort(key=lambda item: item["id"])
        work["lifecycles"].sort(key=lambda item: item["id"])
    else:
        if work_entry is None:
            return False, "PROFILE_NOT_FOUND"
        materialize(work_entry, height)
        if op.get("prior_state") != work_entry["current"]:
            return False, "PRIOR_STATE_MISMATCH"
        if kind == "schedule":
            requested = op["next_state"]
            if work_entry["scheduled"]:
                return False, "SCHEDULE_EXISTS"
            if (work_entry["current"], requested) not in NORMAL_EDGES:
                return False, "INVALID_NORMAL_EDGE"
            if op["activation_height"] < height + NORMAL_DELAY:
                return False, "NORMAL_DELAY"
            work_entry["scheduled"] = requested
            work_entry["scheduled_height"] = op["activation_height"]
        elif kind == "cancel":
            stored_entry = lifecycle(state, profile_id)
            if stored_entry is None or stored_entry["scheduled"] == 0:
                return False, "NO_SCHEDULE"
            if height >= stored_entry["scheduled_height"]:
                return False, "SCHEDULE_ALREADY_EFFECTIVE"
            if op.get("next_state", 0) != 0 or op.get("activation_height", 0) != 0:
                return False, "INVALID_CANCEL_FIELDS"
            work_entry["scheduled"] = 0
            work_entry["scheduled_height"] = 0
        elif kind == "emergency_disable":
            if work_entry["current"] == 4:
                return False, "ALREADY_DISABLED"
            if op.get("next_state") != 4:
                return False, "INVALID_EMERGENCY_TARGET"
            if op["activation_height"] < height + EMERGENCY_DELAY:
                return False, "EMERGENCY_DELAY"
            work_entry["scheduled"] = 4
            work_entry["scheduled_height"] = op["activation_height"]
        else:
            return False, "UNKNOWN_OPERATION"
    commit(state, work)
    return True, "OK"


def initial(current: int = 1, extra: bool = False) -> dict:
    profiles = [{"id": 1, "name": "PROFILE_1", "definition_height": 1}]
    lifecycles = [{"id": 1, "current": current, "state_height": 1, "scheduled": 0, "scheduled_height": 0}]
    if extra:
        profiles.append({"id": 2, "name": "PROFILE_2", "definition_height": 1})
        lifecycles.append({"id": 2, "current": 2, "state_height": 1, "scheduled": 0, "scheduled_height": 0})
    return {"sequence": 1, "profiles": profiles, "lifecycles": lifecycles, "prior_root": ZERO}


CASES = [
    {"name": "define_profile_embeds_preimage", "initial": initial(), "steps": [
        {"height": 100, "operation": {"type": "define", "profile_id": 2, "prior_state": 0, "next_state": 1, "activation_height": 100, "proposed_profile": {"id": 2, "name": "PROFILE_2", "definition_height": 100}}},
        {"height": 100, "operation": {"type": "observe", "profile_id": 2}},
    ]},
    {"name": "define_profile_id_mismatch_rejected", "initial": initial(), "steps": [
        {"height": 100, "operation": {"type": "define", "profile_id": 2, "prior_state": 0, "next_state": 1, "activation_height": 100, "proposed_profile": {"id": 3, "name": "PROFILE_3", "definition_height": 100}}},
    ]},
    {"name": "multi_profile_root_is_ordered_and_independent", "initial": initial(extra=True), "steps": [
        {"height": 100, "operation": {"type": "schedule", "profile_id": 1, "prior_state": 1, "next_state": 2, "activation_height": 86500}},
        {"height": 100, "operation": {"type": "schedule", "profile_id": 2, "prior_state": 2, "next_state": 3, "activation_height": 86500}},
    ]},
    {"name": "experimental_schedule_active_boundary", "initial": initial(), "steps": [
        {"height": 100, "operation": {"type": "schedule", "profile_id": 1, "prior_state": 1, "next_state": 2, "activation_height": 86500}},
        {"height": 86499, "operation": {"type": "observe", "profile_id": 1}},
        {"height": 86500, "operation": {"type": "observe", "profile_id": 1}},
    ]},
    {"name": "cancel_before_activation", "initial": initial(), "steps": [
        {"height": 100, "operation": {"type": "schedule", "profile_id": 1, "prior_state": 1, "next_state": 2, "activation_height": 86500}},
        {"height": 500, "operation": {"type": "cancel", "profile_id": 1, "prior_state": 1, "next_state": 0, "activation_height": 0}},
    ]},
    {"name": "active_deprecates_and_blocks_registration", "initial": initial(2), "steps": [
        {"height": 100, "operation": {"type": "schedule", "profile_id": 1, "prior_state": 2, "next_state": 3, "activation_height": 86500}},
        {"height": 86500, "operation": {"type": "admit_registration", "profile_id": 1}},
    ]},
    {"name": "deprecated_normally_disables", "initial": initial(3), "steps": [
        {"height": 100, "operation": {"type": "schedule", "profile_id": 1, "prior_state": 3, "next_state": 4, "activation_height": 86500}},
        {"height": 86500, "operation": {"type": "observe", "profile_id": 1}},
    ]},
    {"name": "experimental_normal_disable_rejected", "initial": initial(), "steps": [
        {"height": 100, "operation": {"type": "schedule", "profile_id": 1, "prior_state": 1, "next_state": 4, "activation_height": 86500}},
    ]},
    {"name": "emergency_disable_without_prior_schedule", "initial": initial(2), "steps": [
        {"height": 100, "operation": {"type": "emergency_disable", "profile_id": 1, "prior_state": 2, "next_state": 4, "activation_height": 200}},
        {"height": 199, "operation": {"type": "observe", "profile_id": 1}},
        {"height": 200, "operation": {"type": "observe", "profile_id": 1}},
    ]},
    {"name": "emergency_supersedes_unmatured_deprecation", "initial": initial(2), "steps": [
        {"height": 100, "operation": {"type": "schedule", "profile_id": 1, "prior_state": 2, "next_state": 3, "activation_height": 86500}},
        {"height": 200, "operation": {"type": "emergency_disable", "profile_id": 1, "prior_state": 2, "next_state": 4, "activation_height": 300}},
        {"height": 300, "operation": {"type": "observe", "profile_id": 1}},
    ]},
    {"name": "mature_schedule_materialized_by_later_mutation", "initial": initial(), "steps": [
        {"height": 100, "operation": {"type": "schedule", "profile_id": 1, "prior_state": 1, "next_state": 2, "activation_height": 86500}},
        {"height": 90000, "operation": {"type": "schedule", "profile_id": 1, "prior_state": 2, "next_state": 3, "activation_height": 176400}},
    ]},
    {"name": "cancel_at_boundary_rejected", "initial": initial(), "steps": [
        {"height": 100, "operation": {"type": "schedule", "profile_id": 1, "prior_state": 1, "next_state": 2, "activation_height": 86500}},
        {"height": 86500, "operation": {"type": "cancel", "profile_id": 1, "prior_state": 1, "next_state": 0, "activation_height": 0}},
    ]},
]


def execute(case: dict) -> dict:
    state = json.loads(json.dumps(case["initial"]))
    trace = []
    for step in case["steps"]:
        before = root(state)
        accepted, error = apply(state, step["operation"], step["height"])
        entry = lifecycle(state, step["operation"].get("profile_id", 1))
        trace.append({
            "accepted": accepted, "error": error,
            "effective_state": STATES[effective(entry, step["height"])] if entry else "ABSENT",
            "state_sequence": state["sequence"], "root_before": before, "root_after": root(state),
        })
    return {"trace": trace, "final_state": {**state, "root": root(state)}}


def main() -> None:
    document = {"schema": "CRYPTO_REGISTRY_LIFECYCLE_V1", "cases": []}
    for case in CASES:
        document["cases"].append({**case, "expected": execute(case)})
    OUT.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")
    print(f"generated {len(CASES)} registry mutation/lifecycle cases with exact LCE roots")


if __name__ == "__main__":
    main()
