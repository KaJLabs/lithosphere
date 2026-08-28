"""Generate hash-complete authorization lifecycle vectors from canonical LCE1 objects."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from lce_v1 import (
    decode_object, encode_object, f_bytes, f_object, f_object_list, f_u8,
    f_u16, f_u32, f_u64,
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "vectors" / "authorization_hash_transitions.json"
SUBJECT = bytes.fromhex("11" * 20)
ZERO64 = bytes(64)
REQUEST_HEIGHT = 100
DEADLINE = 110
ACTIVATION = 120
PROFILES = {0x0201: 64, 0x8001: 33}
OPS = {
    "REGISTER": (1, 0x0004, "LITHO_KEY_REGISTRATION_V1", 1),
    "ROTATE": (2, 0x0005, "LITHO_KEY_ROTATION_V1", 2),
    "DISABLE": (3, 0x0007, "LITHO_CLASSICAL_DISABLE_V1", 3),
    "RECOVER": (4, 0x0008, "LITHO_RECOVERY_ACTION_V1", 4),
}


def commit(domain: str, value: bytes) -> bytes:
    return hashlib.sha3_512(domain.encode("ascii") + b"\0" + value).digest()


def label(value: str) -> bytes:
    return hashlib.sha3_512(b"LITHO_R8_VECTOR\0" + value.encode("ascii")).digest()


def material(profile: int, fill: int) -> bytes:
    return encode_object(0x0015, [f_u16(1, profile), f_bytes(2, bytes([fill]) * PROFILES[profile])])


def key_node(profile: int, signer: bytes, slot: int, epoch: int, public_key: bytes) -> bytes:
    params = encode_object(0x0052, [
        f_u16(1, profile), f_bytes(2, signer), f_u16(3, slot), f_u64(4, epoch),
        f_u8(5, 4), f_bytes(6, commit("LITHO_PUBLIC_KEY_COMMITMENT_V1", public_key)),
    ])
    return encode_object(0x0051, [f_u8(1, 1), f_object(2, params)])


def policy(version: int, epoch: int, profile: int, signer: bytes, slot: int, key_epoch: int, public_key: bytes) -> bytes:
    return encode_object(0x0050, [
        f_bytes(1, bytes.fromhex("51" * 32)), f_u64(2, version), f_u8(3, 1),
        f_bytes(4, SUBJECT), f_u64(5, epoch),
        f_object(6, key_node(profile, signer, slot, key_epoch, public_key)),
        f_u64(8, 1), f_bytes(9, ZERO64), f_u32(10, 1),
    ])


def key_state(slot: int, epoch: int, profile: int, public_key: bytes, state: int,
              origin: bytes, activation: int, retirement: int, predecessor: bytes) -> bytes:
    return encode_object(0x0019, [
        f_u16(1, slot), f_u64(2, epoch), f_u16(3, profile), f_object(4, public_key),
        f_u8(5, state), f_bytes(6, origin), f_u64(7, activation),
        f_u64(8, retirement), f_bytes(9, predecessor),
    ])


def state(policy_version: int, policy_commitment: bytes, auth_epoch: int,
          keys: list[bytes], pending: bytes | None = None,
          lifecycle_sequence: int = 1) -> bytes:
    fields = [
        f_u8(1, 1), f_bytes(2, SUBJECT), f_u64(3, policy_version),
        f_bytes(4, policy_commitment), f_u64(5, auth_epoch),
    ]
    if pending is not None:
        fields.append(f_object(6, pending))
    fields.extend([f_object_list(7, keys), f_u64(8, lifecycle_sequence)])
    return encode_object(0x0018, fields)


def lifecycle(sequence: int, before: bytes, code: int, operation: bytes,
              after: bytes, height: int, auth_label: str) -> bytes:
    return encode_object(0x001A, [
        f_u64(1, sequence), f_bytes(2, commit("LITHO_SUBJECT_AUTH_STATE_V1", before)),
        f_u8(3, code), f_bytes(4, operation),
        f_bytes(5, commit("LITHO_SUBJECT_AUTH_STATE_V1", after)), f_u64(6, height),
        f_bytes(7, label(auth_label)),
    ])


def operation_request(kind: str, current_root: bytes, next_policy_root: bytes,
                      next_policy_obj: bytes, proposed: bytes | None) -> bytes:
    if kind == "REGISTER":
        return encode_object(0x0010, [
            f_u8(1, 1), f_bytes(2, SUBJECT), f_u16(3, 0x0201), f_u16(4, 3),
            f_u64(5, 1), f_object(6, proposed), f_u64(7, ACTIVATION),
            f_u64(8, DEADLINE), f_bytes(9, next_policy_root), f_bytes(10, current_root),
            f_object(11, next_policy_obj),
        ])
    if kind == "ROTATE":
        return encode_object(0x0011, [
            f_u8(1, 1), f_bytes(2, SUBJECT), f_u16(3, 0x0201), f_u16(4, 2),
            f_u64(5, 1), f_u64(6, 2), f_object(7, proposed), f_u64(8, ACTIVATION),
            f_u64(9, DEADLINE), f_bytes(10, next_policy_root), f_bytes(11, current_root),
            f_object(12, next_policy_obj),
        ])
    if kind == "DISABLE":
        return encode_object(0x0013, [
            f_u8(1, 1), f_bytes(2, SUBJECT), f_u16(3, 1), f_u64(4, 1),
            f_bytes(5, current_policy_commitment()), f_bytes(6, next_policy_root),
            f_u64(7, ACTIVATION), f_bytes(8, label("disable-reason")),
            f_u64(9, DEADLINE), f_bytes(10, current_root), f_object(11, next_policy_obj),
        ])
    return encode_object(0x0014, [
        f_u8(1, 1), f_bytes(2, SUBJECT), f_u64(3, 1), f_u16(4, 2), f_u64(5, 1),
        f_u16(6, 0x0201), f_u16(7, 2), f_u64(8, 2), f_object(9, proposed),
        f_u64(10, ACTIVATION), f_u64(11, DEADLINE), f_bytes(12, label("recovery-case")),
        f_bytes(13, next_policy_root), f_bytes(14, current_root),
        f_object(15, next_policy_obj),
    ])


CLASSICAL = material(0x8001, 0x21)
PQ_ACTIVE = material(0x0201, 0x22)
INITIAL_POLICY = policy(1, 1, 0x0201, b"pq-active", 2, 1, PQ_ACTIVE)


def current_policy_commitment() -> bytes:
    return commit("LITHO_POLICY_STATE_V1", INITIAL_POLICY)


def initial_keys() -> list[bytes]:
    return [
        key_state(1, 1, 0x8001, CLASSICAL, 4, label("genesis-classical"), 1, 0, ZERO64),
        key_state(2, 1, 0x0201, PQ_ACTIVE, 4, label("genesis-pq"), 1, 0, ZERO64),
    ]


def build(kind: str) -> dict:
    op_kind, domain_id, domain_name, request_code = OPS[kind]
    base_keys = initial_keys()
    initial = state(1, current_policy_commitment(), 1, base_keys)
    initial_root = commit("LITHO_SUBJECT_AUTH_STATE_V1", initial)
    if kind == "REGISTER":
        target_slot, target_epoch, prior_slot, prior_epoch = 3, 1, 0, 0
        proposed = material(0x0201, 0x31)
        next_signer = b"registered-pq"
    elif kind in ("ROTATE", "RECOVER"):
        target_slot, target_epoch, prior_slot, prior_epoch = 2, 2, 2, 1
        proposed = material(0x0201, 0x32 if kind == "ROTATE" else 0x33)
        next_signer = b"rotated-pq" if kind == "ROTATE" else b"recovered-pq"
    else:
        target_slot, target_epoch, prior_slot, prior_epoch = 1, 2, 1, 1
        proposed = None
        next_signer = b"pq-active"

    next_material = PQ_ACTIVE if proposed is None else proposed
    next_slot = 2 if kind == "DISABLE" else target_slot
    next_epoch = 1 if kind == "DISABLE" else target_epoch
    next_policy_obj = policy(2, 2, 0x0201, next_signer, next_slot, next_epoch, next_material)
    next_policy_root = commit("LITHO_POLICY_STATE_V1", next_policy_obj)
    request_obj = operation_request(kind, initial_root, next_policy_root, next_policy_obj, proposed)
    request_commitment = commit(domain_name, request_obj)
    proposed_commitment = ZERO64 if proposed is None else commit("LITHO_PUBLIC_KEY_COMMITMENT_V1", proposed)
    pending = encode_object(0x001B, [
        f_u8(1, op_kind), f_u16(2, domain_id), f_bytes(3, request_commitment),
        f_u16(4, target_slot), f_u64(5, target_epoch), f_u64(6, ACTIVATION),
        f_u64(7, DEADLINE), f_u8(8, op_kind), f_u64(9, 2),
        f_bytes(10, next_policy_root), f_u64(11, 2), f_bytes(12, proposed_commitment),
        f_u64(13, prior_epoch), f_u8(14, 6 if kind == "DISABLE" else 4),
        f_u16(15, prior_slot),
    ])
    pending_keys = list(base_keys)
    if proposed is not None:
        predecessor = ZERO64
        if prior_epoch:
            predecessor = commit("LITHO_KEY_STATE_ENTRY_V1", base_keys[1])
        pending_keys.append(key_state(target_slot, target_epoch, 0x0201, proposed, 2,
                                      request_commitment, 0, 0, predecessor))
    pending_keys.sort(key=lambda item: tuple(int.from_bytes(item[x:y], "big") for x, y in ((17, 19), (26, 34))))
    pending_state = state(1, current_policy_commitment(), 1, pending_keys, pending, 2)
    pending_root = commit("LITHO_SUBJECT_AUTH_STATE_V1", pending_state)
    request_record = lifecycle(1, initial, request_code, request_commitment, pending_state,
                               REQUEST_HEIGHT, f"{kind}-request-auth")

    cancelled_keys = []
    for item in pending_keys:
        if proposed is not None and item == pending_keys[-1]:
            cancelled_keys.append(key_state(target_slot, target_epoch, 0x0201, proposed, 3,
                                            request_commitment, 0, 105,
                                            ZERO64 if prior_epoch == 0 else commit("LITHO_KEY_STATE_ENTRY_V1", base_keys[1])))
        else:
            cancelled_keys.append(item)
    cancelled_state = state(1, current_policy_commitment(), 1, cancelled_keys, lifecycle_sequence=3)
    cancelled_root = commit("LITHO_SUBJECT_AUTH_STATE_V1", cancelled_state)
    cancel_obj = encode_object(0x0012, [
        f_u8(1, 1), f_bytes(2, SUBJECT),
        f_bytes(3, commit("LITHO_PENDING_AUTH_MUTATION_V1", pending)),
        f_bytes(5, pending_root), f_bytes(6, cancelled_root),
    ])
    cancel_commitment = commit("LITHO_CANCEL_PENDING_MUTATION_V1", cancel_obj)
    cancel_record = lifecycle(2, pending_state, 5, cancel_commitment, cancelled_state, 105,
                              f"{kind}-cancel-auth")

    activated_keys = []
    for index, item in enumerate(base_keys):
        if kind == "ROTATE" and index == 1:
            activated_keys.append(key_state(2, 1, 0x0201, PQ_ACTIVE, 5, label("genesis-pq"), 1,
                                            ACTIVATION, ZERO64))
        elif kind == "DISABLE" and index == 0:
            activated_keys.append(key_state(1, 1, 0x8001, CLASSICAL, 6,
                                            label("genesis-classical"), 1, ACTIVATION, ZERO64))
        elif kind == "RECOVER" and index == 1:
            activated_keys.append(key_state(2, 1, 0x0201, PQ_ACTIVE, 7, label("genesis-pq"), 1,
                                            ACTIVATION, ZERO64))
        else:
            activated_keys.append(item)
    if proposed is not None:
        predecessor = ZERO64 if prior_epoch == 0 else commit("LITHO_KEY_STATE_ENTRY_V1", base_keys[1])
        activated_keys.append(key_state(target_slot, target_epoch, 0x0201, proposed, 4,
                                        request_commitment, ACTIVATION, 0, predecessor))
    activated_keys.sort(key=lambda item: tuple(int.from_bytes(item[x:y], "big") for x, y in ((17, 19), (26, 34))))
    activated_state = state(2, next_policy_root, 2, activated_keys, lifecycle_sequence=3)
    activated_root = commit("LITHO_SUBJECT_AUTH_STATE_V1", activated_state)
    activation_obj = encode_object(0x0017, [
        f_u8(1, 1), f_bytes(2, SUBJECT),
        f_bytes(3, commit("LITHO_PENDING_AUTH_MUTATION_V1", pending)),
        f_bytes(4, pending_root), f_bytes(6, activated_root),
    ])
    activation_commitment = commit("LITHO_ACTIVATE_PENDING_MUTATION_V1", activation_obj)
    policy_mutation = encode_object(0x0016, [
        f_u8(1, 1), f_bytes(2, SUBJECT), f_u8(3, op_kind), f_u64(4, 1),
        f_bytes(5, current_policy_commitment()), f_u64(6, 2), f_bytes(7, next_policy_root),
        f_u64(8, 1), f_u64(9, 2), f_u16(10, target_slot), f_u64(11, prior_epoch),
        f_u64(12, target_epoch), f_u64(13, ACTIVATION), f_u64(14, DEADLINE),
        f_bytes(15, activation_commitment),
    ])
    activation_record = lifecycle(2, pending_state, 6, activation_commitment,
                                  activated_state, ACTIVATION, f"{kind}-activation-envelope")

    values = {
        "initial_policy": INITIAL_POLICY, "next_policy": next_policy_obj,
        "initial_state": initial, "request_operation": request_obj,
        "pending_mutation": pending, "pending_state": pending_state,
        "request_lifecycle": request_record, "cancel_operation": cancel_obj,
        "cancelled_state": cancelled_state, "cancel_lifecycle": cancel_record,
        "activation_operation": activation_obj, "activated_state": activated_state,
        "policy_mutation": policy_mutation, "activation_lifecycle": activation_record,
    }
    domains = {
        "initial_policy": "LITHO_POLICY_STATE_V1", "next_policy": "LITHO_POLICY_STATE_V1",
        "initial_state": "LITHO_SUBJECT_AUTH_STATE_V1", "request_operation": domain_name,
        "pending_mutation": "LITHO_PENDING_AUTH_MUTATION_V1", "pending_state": "LITHO_SUBJECT_AUTH_STATE_V1",
        "request_lifecycle": "LITHO_KEY_LIFECYCLE_RECORD_V1",
        "cancel_operation": "LITHO_CANCEL_PENDING_MUTATION_V1", "cancelled_state": "LITHO_SUBJECT_AUTH_STATE_V1",
        "cancel_lifecycle": "LITHO_KEY_LIFECYCLE_RECORD_V1",
        "activation_operation": "LITHO_ACTIVATE_PENDING_MUTATION_V1", "activated_state": "LITHO_SUBJECT_AUTH_STATE_V1",
        "activation_lifecycle": "LITHO_KEY_LIFECYCLE_RECORD_V1",
    }
    expected = {}
    for name, value in values.items():
        decode_object(value)
        expected[name] = {"canonical_hex": value.hex(), "sha3_512": hashlib.sha3_512(value).hexdigest()}
        if name in domains:
            expected[name]["domain"] = domains[name]
            expected[name]["commitment"] = commit(domains[name], value).hex()
    return {"name": kind.lower(), "expected": expected}


def main() -> None:
    payload = {
        "schema": "AUTHORIZATION_HASH_TRANSITION_V1",
        "description": "Hash-complete request, cancellation and activation branches reconstructed independently from canonical LCE1 objects.",
        "cases": [build(kind) for kind in OPS],
    }
    OUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"generated {len(payload['cases'])} authorization hash-complete lifecycle cases")


if __name__ == "__main__":
    main()
