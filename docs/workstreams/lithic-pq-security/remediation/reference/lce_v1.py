"""Schema-aware reference codec for LITHO Canonical Encoding V1 (R8).

This is an executable consensus-format reference, not a cryptographic verifier.
Unknown object types/tags, missing fields, wrong nested types, and semantic
boundary violations fail closed.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Any

MAGIC = b"LCE1"
MAX_OBJECT = 1_048_576
MAX_DEPTH = 8
MAX_FIELDS = 64
MAX_LIST_ITEMS = 128
MAX_BYTES = 65_536
MAX_ASCII = 128

U8, U16, U32, U64, U256, BOOL = 0x01, 0x02, 0x03, 0x04, 0x05, 0x06
BYTES, ASCII, OBJECT, OBJECT_LIST = 0x10, 0x11, 0x20, 0x21
FIXED_LENGTHS = {U8: 1, U16: 2, U32: 4, U64: 8, U256: 32, BOOL: 1}
KNOWN_WIRES = set(FIXED_LENGTHS) | {BYTES, ASCII, OBJECT, OBJECT_LIST}


class LCEError(ValueError):
    pass


@dataclass(frozen=True)
class Field:
    tag: int
    wire: int
    payload: bytes


@dataclass(frozen=True)
class Rule:
    wire: int
    required: bool = True
    nested: int | None = None
    list_nested: int | None = None


def _rules(*items: tuple[int, int] | tuple[int, int, bool] | tuple[int, int, bool, int | None, int | None]) -> dict[int, Rule]:
    result: dict[int, Rule] = {}
    for item in items:
        tag, wire = item[0], item[1]
        required = item[2] if len(item) > 2 else True
        nested = item[3] if len(item) > 3 else None
        list_nested = item[4] if len(item) > 4 else None
        result[tag] = Rule(wire, required, nested, list_nested)
    return result


# Complete R8 object/tag/wire registry. Object-specific semantic rules follow.
SCHEMAS: dict[int, dict[int, Rule]] = {
    0x0001: _rules(*[(1,U16),(2,ASCII),(3,U64),(4,BYTES),(5,U16),(6,U16),(7,U8),(8,BYTES),(9,U64),(10,BYTES),(11,U64),(12,U64),(13,U64),(14,ASCII),(15,U256),(16,U16),(17,BYTES)]),
    0x0002: _rules((1,OBJECT,True,0x0001,None),(2,OBJECT_LIST,True,None,0x0003),(3,OBJECT,True,0x0050,None)),
    0x0003: _rules(*[(1,U8),(2,U16),(3,U64),(4,U16),(5,BYTES),(6,BYTES),(7,BYTES)]),
    0x0004: _rules((1,OBJECT,True,0x0032,None),(2,OBJECT,True,0x0032,None),(3,OBJECT,True,0x0033,None),(4,U256),(5,BYTES)),
    0x0005: _rules((1,OBJECT,True,0x0032,None),(2,OBJECT,True,0x0032,None),(3,BYTES),(4,BYTES),(5,OBJECT,True,0x0033,None),(6,U256),(7,U64)),
    0x0010: _rules((1,U8),(2,BYTES),(3,U16),(4,U16),(5,U64),(6,OBJECT,True,0x0015,None),(7,U64),(8,U64),(9,BYTES),(10,BYTES),(11,OBJECT,True,0x0050,None)),
    0x0011: _rules((1,U8),(2,BYTES),(3,U16),(4,U16),(5,U64),(6,U64),(7,OBJECT,True,0x0015,None),(8,U64),(9,U64),(10,BYTES),(11,BYTES),(12,OBJECT,True,0x0050,None)),
    0x0012: _rules(*[(1,U8),(2,BYTES),(3,BYTES),(5,BYTES),(6,BYTES)]),
    0x0013: _rules((1,U8),(2,BYTES),(3,U16),(4,U64),(5,BYTES),(6,BYTES),(7,U64),(8,BYTES),(9,U64),(10,BYTES),(11,OBJECT,True,0x0050,None)),
    0x0014: _rules((1,U8),(2,BYTES),(3,U64),(4,U16),(5,U64),(6,U16),(7,U16),(8,U64),(9,OBJECT,True,0x0015,None),(10,U64),(11,U64),(12,BYTES),(13,BYTES),(14,BYTES),(15,OBJECT,True,0x0050,None)),
    0x0015: _rules((1,U16),(2,BYTES)),
    0x0016: _rules(*[(1,U8),(2,BYTES),(3,U8),(4,U64),(5,BYTES),(6,U64),(7,BYTES),(8,U64),(9,U64),(10,U16),(11,U64),(12,U64),(13,U64),(14,U64),(15,BYTES)]),
    0x0017: _rules(*[(1,U8),(2,BYTES),(3,BYTES),(4,BYTES),(6,BYTES)]),
    0x0018: _rules((1,U8),(2,BYTES),(3,U64),(4,BYTES),(5,U64),(6,OBJECT,False,0x001B,None),(7,OBJECT_LIST,True,None,0x0019),(8,U64)),
    0x0019: _rules((1,U16),(2,U64),(3,U16),(4,OBJECT,True,0x0015,None),(5,U8),(6,BYTES),(7,U64),(8,U64),(9,BYTES)),
    0x001A: _rules(*[(1,U64),(2,BYTES),(3,U8),(4,BYTES),(5,BYTES),(6,U64),(7,BYTES)]),
    0x001B: _rules(*[(1,U8),(2,U16),(3,BYTES),(4,U16),(5,U64),(6,U64),(7,U64),(8,U8),(9,U64),(10,BYTES),(11,U64),(12,BYTES),(13,U64),(14,U8),(15,U16)]),
    0x001C: _rules((1,OBJECT,True,0x0017,None),(2,U16),(3,BYTES),(4,OBJECT,True,0x001D,None),(5,OBJECT,True,0x0002,None)),
    0x001D: _rules((1,OBJECT,True,0x0032,None),(2,U16),(3,BYTES),(4,ASCII),(5,U256)),
    0x001E: _rules((1,U8),(2,BYTES),(3,U16),(4,U16)),
    0x001F: _rules((1,OBJECT,True,0x001E,None),(2,U64),(3,U64),(4,BYTES)),
    0x0020: _rules(*[(1,U64),(2,U16),(3,U16),(4,BYTES),(5,BYTES),(6,BYTES),(7,BYTES),(8,U64),(9,U64),(10,BOOL)]),
    0x0030: _rules((1,U16),(2,OBJECT,True,0x0031,None),(3,OBJECT,True,0x0031,None),(4,OBJECT,True,0x0032,None),(5,OBJECT,True,0x0032,None),(6,OBJECT,True,0x0033,None),(7,OBJECT,True,0x0033,None),(8,U256),(9,OBJECT,True,0x0032,None),(10,OBJECT,True,0x0032,None),(11,BYTES),(12,U32),(13,U64)),
    0x0031: _rules((1,U8),(2,ASCII),(3,BYTES),(4,U64)),
    0x0032: _rules((1,U8),(2,BYTES)),
    0x0033: _rules((1,OBJECT,True,0x0031,None),(2,U8),(3,BYTES),(4,BYTES),(5,U8)),
    0x0034: _rules(*[(1,BYTES),(2,BYTES),(3,U64),(4,BYTES),(5,BYTES),(6,U16),(7,BYTES),(8,U64),(9,U64)]),
    0x0035: _rules((1,OBJECT,True,0x0030,None),(2,BYTES),(3,BYTES),(4,U16),(5,BYTES),(6,BYTES)),
    0x0036: _rules((1,U16),(2,OBJECT,True,0x0031,None),(3,U8),(4,U64),(5,U8),(6,BYTES),(7,U64),(8,U64)),
    0x0040: _rules(*[(1,U16),(2,ASCII),(3,BYTES),(4,BYTES),(5,BYTES),(6,BYTES),(7,U32),(8,U32),(9,BYTES),(10,BYTES),(11,U64)]),
    0x0041: _rules((1,U64),(2,BYTES),(3,U8),(4,U16),(5,U8),(6,U8),(7,U64),(8,U64),(9,BYTES),(10,U64),(11,OBJECT,False,0x0040,None)),
    0x0042: _rules((1,U64),(2,OBJECT_LIST,True,None,0x0040),(3,OBJECT_LIST,True,None,0x0044),(4,BYTES)),
    0x0043: _rules((1,U64),(2,OBJECT,True,0x0041,None),(3,BYTES),(4,BYTES),(5,BYTES),(6,BYTES),(7,U64),(8,U64)),
    0x0044: _rules(*[(1,U16),(2,U8),(3,U64),(4,U8),(5,U64)]),
    0x0045: _rules((1,U16),(2,BYTES),(3,U64),(4,ASCII)),
    0x0046: _rules((1,BYTES),(2,OBJECT,True,0x0050,None),(3,OBJECT,True,0x0018,None),(4,U64),(5,BYTES),(6,U64)),
    0x0050: _rules((1,BYTES),(2,U64),(3,U8),(4,BYTES),(5,U64),(6,OBJECT,True,0x0051,None),(7,OBJECT,False,0x0051,None),(8,U64),(9,BYTES),(10,U32)),
    0x0051: _rules((1,U8),(2,OBJECT,True,None,None),(3,OBJECT_LIST,False,None,0x0051)),
    0x0052: _rules(*[(1,U16),(2,BYTES),(3,U16),(4,U64),(5,U8),(6,BYTES)]),
    0x0053: _rules(),
    0x0054: _rules((1,U8)),
    0x0055: _rules((1,U64)),
    0x0056: _rules((1,BYTES),(2,U8),(3,OBJECT,True,0x0033,None),(4,U256),(5,U64),(6,U64),(7,U8)),
    0x0060: _rules((1,U16),(2,BYTES),(3,U64),(4,ASCII),(5,ASCII,False)),
    0x0061: _rules((1,BYTES),(2,U64),(3,U64),(4,BOOL),(5,OBJECT_LIST,True,None,0x0032)),
    0x0062: _rules((1,BYTES),(2,U64),(3,U64),(4,U64),(5,OBJECT_LIST,True,None,0x0032)),
    0x0063: _rules((1,BYTES),(2,BYTES),(3,BYTES),(4,U32),(5,BYTES)),
    0x0064: _rules((1,BYTES),(2,OBJECT,True,0x0031,None),(3,OBJECT,True,0x0031,None),(4,OBJECT,True,0x0033,None),(5,OBJECT,True,0x0033,None),(6,U256),(7,U16),(8,BYTES)),
    0x0065: _rules((1,U16),(2,ASCII),(3,BYTES),(4,U32),(5,BYTES)),
    0x0066: _rules((1,U16),(2,BYTES),(3,U64)),
    0x0100: _rules(*[(1,U64),(2,ASCII),(3,ASCII),(4,BYTES),(5,BYTES),(6,BYTES),(7,BYTES),(8,BYTES),(9,BYTES),(10,ASCII),(11,BYTES),(12,BYTES),(13,U8),(14,U64)]),
    0x0101: _rules(*[(1,U64),(2,BYTES),(3,BYTES),(4,U16),(5,U16),(6,U16),(7,BYTES),(8,BYTES),(9,BYTES),(10,BYTES),(11,BYTES),(12,BYTES),(13,U32),(14,U32),(15,U8),(16,BYTES),(17,BYTES),(18,BYTES),(19,U32)]),
    0x0102: _rules(*[(1,U64),(2,ASCII),(3,BYTES),(4,BYTES),(5,BYTES),(6,BYTES),(7,ASCII),(8,U8),(9,BYTES),(10,U64)]),
    0x0103: _rules(*[(1,U64),(2,BYTES),(3,BYTES),(4,ASCII),(5,U64),(6,BYTES),(7,BYTES),(8,BYTES),(9,U64),(10,BYTES),(11,U16),(12,BYTES),(13,U64),(14,BYTES),(15,BYTES),(16,BYTES),(17,BYTES),(18,BYTES)]),
    0x010E: _rules((1,U16),(2,U16),(3,BYTES),(4,U64),(5,BYTES)),
    0x010F: _rules((1,U16),(2,OBJECT),(3,U16),(4,BYTES),(5,BYTES),(6,U8),(7,U64),(8,BYTES),(9,OBJECT,True,0x0002,None),(10,OBJECT,True,0x010E,None)),
    0x0110: _rules(*[(1,BYTES),(2,U8),(3,BYTES),(4,U64),(5,U64),(6,U64),(7,U64),(8,BYTES)]),
    0x0111: _rules((1,U64),(2,OBJECT_LIST,True,None,0x0110),(3,BYTES),(4,BYTES)),
    0x0112: _rules(*[(1,BYTES),(2,U64),(3,BYTES),(4,BYTES),(5,U64),(6,U64),(7,U64)]),
    0x0113: _rules((1,BYTES),(2,U64),(3,U64),(4,BYTES),(5,OBJECT_LIST,True,None,0x0114),(6,BYTES)),
    0x0114: _rules((1,U8),(2,BYTES)),
    0x0115: _rules((1,U64),(2,BYTES),(3,U8),(4,U8),(5,BYTES),(6,BYTES),(7,OBJECT,False,0x0110,None),(8,U64),(9,U64),(10,BYTES,False),(11,BYTES,False)),
    0x0116: _rules((1,U64),(2,OBJECT,True,0x0115,None),(3,BYTES),(4,BYTES),(5,BYTES),(6,BYTES),(7,U64),(8,U64)),
    0x0117: _rules((1,BYTES),(2,U64),(3,U64),(4,BYTES),(5,BYTES),(6,OBJECT_LIST,True,None,0x0118)),
    0x0118: _rules((1,BYTES)),
}

EXACT_BYTES: dict[tuple[int,int],int] = {
    (0x0001,4):32,(0x0001,10):64,(0x0001,17):64,(0x0003,6):64,
    (0x0004,5):64,(0x0005,3):4,(0x0005,4):64,(0x0010,9):64,(0x0010,10):64,
    (0x0011,10):64,(0x0011,11):64,(0x0012,3):64,(0x0012,5):64,(0x0012,6):64,(0x0013,5):64,
    (0x0013,6):64,(0x0013,8):64,(0x0013,10):64,(0x0014,12):64,(0x0014,13):64,(0x0014,14):64,
    (0x0016,5):64,(0x0016,7):64,(0x0016,15):64,(0x0020,5):64,
    (0x0017,3):64,(0x0017,4):64,(0x0017,6):64,
    (0x0018,4):64,(0x001B,3):64,(0x001B,10):64,(0x001B,12):64,
    (0x001C,3):64,(0x001D,3):64,
    (0x001F,4):64,
    (0x0019,6):64,(0x0019,9):64,
    (0x001A,2):64,(0x001A,4):64,(0x001A,5):64,(0x001A,7):64,
    (0x0020,6):64,(0x0020,7):64,(0x0030,11):32,(0x0034,1):64,
    (0x0034,2):32,(0x0034,4):32,(0x0034,7):32,(0x0035,2):64,
    (0x0035,3):64,(0x0035,5):32,(0x0035,6):64,(0x0036,6):64,
    (0x0040,3):32,(0x0040,4):32,(0x0040,5):64,(0x0040,9):64,
    (0x0040,10):64,(0x0041,2):64,(0x0041,9):64,(0x0042,4):64,
    (0x0043,3):64,(0x0043,4):64,(0x0043,5):64,(0x0043,6):64,
    (0x0045,2):32,(0x0046,1):32,(0x0046,5):64,
    (0x0050,1):32,(0x0050,9):64,(0x0052,6):64,(0x0056,1):32,
    (0x0060,2):32,(0x0061,1):64,(0x0062,1):64,(0x0063,1):64,
    (0x0063,2):32,(0x0063,3):64,(0x0063,5):64,(0x0064,1):32,
    (0x0064,8):32,(0x0065,3):64,(0x0065,5):64,(0x0066,2):64,
    (0x0100,4):64,(0x0100,5):64,(0x0100,6):64,(0x0100,7):64,
    (0x0100,8):32,(0x0100,9):64,(0x0100,11):64,(0x0100,12):64,
    (0x0101,2):64,(0x0101,3):64,(0x0101,7):64,(0x0101,8):64,
    (0x0101,9):64,(0x0101,10):64,(0x0101,11):64,(0x0101,12):64,
    (0x0101,16):64,(0x0101,17):32,(0x0101,18):64,
    (0x0102,3):64,(0x0102,4):64,(0x0102,5):64,(0x0102,6):64,
    (0x0102,9):64,(0x0103,2):64,(0x0103,3):64,(0x0103,6):32,
    (0x0103,8):32,(0x0103,10):64,(0x0103,12):64,(0x0103,14):64,
    (0x0103,15):64,(0x0103,16):64,(0x0103,17):64,(0x0103,18):64,
    (0x010E,3):64,(0x010E,5):64,(0x010F,4):64,(0x010F,5):32,(0x010F,8):64,(0x0110,1):32,
    (0x0110,3):64,(0x0110,8):64,(0x0111,3):64,(0x0111,4):64,
    (0x0112,1):32,(0x0112,3):64,(0x0112,4):64,(0x0113,1):32,
    (0x0113,4):64,(0x0113,6):64,(0x0114,2):64,
    (0x0115,2):64,(0x0115,5):32,(0x0115,6):64,(0x0115,10):64,(0x0115,11):64,
    (0x0116,3):64,(0x0116,4):64,(0x0116,5):64,(0x0116,6):64,
    (0x0117,1):32,(0x0117,4):64,(0x0117,5):64,(0x0118,1):64,
}

OBJECT_LIMITS = {
    0x0001:4_096, 0x0002:131_072, 0x0003:32_768,
    0x0010:8_192, 0x0011:8_192, 0x0012:8_192, 0x0013:8_192,
    0x0014:8_192, 0x0017:8_192, 0x001B:8_192, 0x001C:131_072, 0x001D:8_192,
    0x0030:16_384, 0x0034:65_536, 0x0046:65_536,
    0x0100:65_536, 0x0101:65_536, 0x0102:65_536, 0x0103:65_536,
    0x010F:131_072, 0x0112:65_536, 0x0113:65_536, 0x0117:65_536,
}


def uint_payload(value: int, size: int) -> bytes:
    if value < 0 or value >= 1 << (size * 8): raise LCEError("integer out of range")
    return value.to_bytes(size, "big")


def f_u8(tag:int,value:int)->Field:return Field(tag,U8,uint_payload(value,1))
def f_u16(tag:int,value:int)->Field:return Field(tag,U16,uint_payload(value,2))
def f_u32(tag:int,value:int)->Field:return Field(tag,U32,uint_payload(value,4))
def f_u64(tag:int,value:int)->Field:return Field(tag,U64,uint_payload(value,8))
def f_u256(tag:int,value:int)->Field:return Field(tag,U256,uint_payload(value,32))
def f_bool(tag:int,value:bool)->Field:return Field(tag,BOOL,b"\x01" if value else b"\x00")
def f_bytes(tag:int,value:bytes)->Field:return Field(tag,BYTES,value)


def f_ascii(tag:int,value:str)->Field:
    try: raw=value.encode("ascii")
    except UnicodeEncodeError as exc: raise LCEError("ASCII contains Unicode") from exc
    return Field(tag,ASCII,raw)


def f_object(tag:int,value:bytes)->Field:return Field(tag,OBJECT,value)


def f_object_list(tag:int,values:list[bytes])->Field:
    if len(values)>MAX_LIST_ITEMS: raise LCEError("too many list items")
    payload=len(values).to_bytes(2,"big")
    for item in values: payload += len(item).to_bytes(4,"big")+item
    return Field(tag,OBJECT_LIST,payload)


def _raw(field:dict[str,Any])->bytes:
    value=field["value"]
    return bytes.fromhex(value) if isinstance(value,str) and field["wire"]==BYTES else b""


def _int(fields:dict[int,dict[str,Any]],tag:int)->int:return int(fields[tag]["value"])
def _blen(fields:dict[int,dict[str,Any]],tag:int)->int:return len(_raw(fields[tag]))


def _semantic(obj:dict[str,Any])->None:
    t=obj["object_type"]; fields={f["tag"]:f for f in obj["fields"]}
    def exact(tag:int,n:int)->None:
        if _blen(fields,tag)!=n: raise LCEError(f"object {t:#x} tag {tag} length")
    def between(tag:int,low:int,high:int)->None:
        if not low<=_blen(fields,tag)<=high: raise LCEError(f"object {t:#x} tag {tag} bounds")
    def proposed_policy(commitment_tag:int,policy_tag:int)->None:
        policy_field=fields[policy_tag]
        policy={f["tag"]:f for f in policy_field["value"]["fields"]}
        raw=bytes.fromhex(policy_field["value"]["raw_hex"])
        expected=hashlib.sha3_512(b"LITHO_POLICY_STATE_V1\x00"+raw).digest()
        if _raw(fields[commitment_tag])!=expected: raise LCEError("proposed policy commitment")
        if _int(policy,3)!=_int(fields,1) or _raw(policy[4])!=_raw(fields[2]): raise LCEError("proposed policy subject")
    for (object_type,tag),size in EXACT_BYTES.items():
        if object_type==t and tag in fields: exact(tag,size)
    if t==0x0001:
        if _int(fields,1)!=1 or _int(fields,3)==0 or _int(fields,7) not in range(1,7): raise LCEError("signing scalar")
        exact(4,32); between(8,1,64); exact(10,64); exact(17,64)
        if not 1<=len(fields[2]["value"])<=64 or not 1<=len(fields[14]["value"])<=32: raise LCEError("signing ASCII")
        if _int(fields,9)==0 or _int(fields,11)==0: raise LCEError("signing version/epoch")
    elif t==0x0010:
        material={f["tag"]:f for f in fields[6]["value"]["fields"]}
        if _int(fields,3)!=_int(material,1) or _int(fields,4)==0 or _int(fields,5)==0 or _int(fields,7)<=_int(fields,8): raise LCEError("key registration semantics")
        proposed_policy(9,11)
    elif t==0x0011:
        material={f["tag"]:f for f in fields[7]["value"]["fields"]}
        if _int(fields,3)!=_int(material,1) or _int(fields,4)==0 or _int(fields,6)<=_int(fields,5) or _int(fields,8)<=_int(fields,9): raise LCEError("key rotation semantics")
        proposed_policy(10,12)
    elif t==0x0012:
        if not any(_raw(fields[3])): raise LCEError("pending cancellation semantics")
    elif t==0x0013:
        if _int(fields,3)==0 or _int(fields,4)==0 or _int(fields,7)<=_int(fields,9): raise LCEError("classical disable semantics")
        proposed_policy(6,11)
    elif t==0x0014:
        material={f["tag"]:f for f in fields[9]["value"]["fields"]}
        if _int(fields,6)!=_int(material,1) or _int(fields,7)==0 or _int(fields,8)<=_int(fields,5) or _int(fields,10)<=_int(fields,11): raise LCEError("recovery semantics")
        proposed_policy(13,15)
    elif t==0x0016:
        if _int(fields,3) not in range(1,5) or _int(fields,6)!=_int(fields,4)+1 or _int(fields,9)!=_int(fields,8)+1 or _int(fields,12)<=_int(fields,11): raise LCEError("policy mutation semantics")
    elif t==0x0020:
        action,target=_int(fields,2),_int(fields,3); target_len=_blen(fields,4); emergency=bool(_int(fields,10))
        if action not in range(1,5) or target not in range(1,6): raise LCEError("governance enum")
        if target_len!=(64 if target==3 else 32): raise LCEError("governance target identity")
        if emergency!=(action==4) or (action==4 and target!=2): raise LCEError("governance emergency semantics")
    elif t==0x0002:
        entries=fields[2]["value"]
        if not 1<=len(entries)<=16: raise LCEError("authorization signature count")
        order=[]
        for entry in entries:
            ef={f["tag"]:f for f in entry["fields"]}
            order.append((_raw(ef[5]),_int(ef,2),_int(ef,3),_int(ef,4)))
        if order!=sorted(set(order)): raise LCEError("authorization signature order")
    elif t==0x0003:
        if _int(fields,1) not in (1,2) or _int(fields,2)==0 or _int(fields,3)==0: raise LCEError("signature reference")
        between(5,1,64); exact(6,64)
        sig={0x0101:3309,0x0102:4627,0x0201:29792,0x8001:65}.get(_int(fields,4))
        if sig is None or _blen(fields,7)!=sig: raise LCEError("signature profile length")
    elif t==0x0015:
        pk={0x0101:1952,0x0102:2592,0x0201:64,0x8001:33}.get(_int(fields,1))
        if pk is None or _blen(fields,2)!=pk: raise LCEError("public key profile length")
    elif t==0x001E:
        kind=_int(fields,1); lengths={1:20,2:32,3:20,4:32,5:32,6:32}
        if kind not in lengths or _blen(fields,2)!=lengths[kind] or _int(fields,3)==0 or _int(fields,4)==0: raise LCEError("authorization sequence key")
    elif t==0x001F:
        if _int(fields,2)==0 or _int(fields,3)==0: raise LCEError("authorization sequence state")
    elif t==0x0031:
        ns=_int(fields,1); exact(3,32)
        if not 1<=len(fields[2]["value"])<=64: raise LCEError("chain ID length")
        if ns not in (1,2,3): raise LCEError("chain namespace")
        if (ns==1 and _int(fields,4)!=0) or (ns in (2,3) and _int(fields,4)==0): raise LCEError("chain EVM id")
    elif t==0x0032:
        ns=_int(fields,1); lengths={1:20,2:20,3:20,4:32,5:32}
        if ns not in lengths or _blen(fields,2)!=lengths[ns]: raise LCEError("principal identity")
    elif t==0x0033:
        ns=_int(fields,2); issuer=_blen(fields,3); asset=_blen(fields,4)
        valid=(ns==1 and issuer==0 and 1<=asset<=64) or (ns==2 and issuer==20 and asset==0) or (ns==3 and issuer==32 and asset==32) or (ns==4 and issuer in (20,32) and 1<=asset<=64)
        if not valid or _int(fields,5)>38: raise LCEError("asset identity")
    elif t==0x0030:
        if _int(fields,1)!=1 or _int(fields,8)==0 or _int(fields,13)==0: raise LCEError("bridge transfer")
        exact(11,32)
    elif t==0x0034:
        exact(1,64); exact(2,32); exact(4,32); exact(7,32)
        if _int(fields,3)==0 or _int(fields,8)<_int(fields,3): raise LCEError("inclusion height")
    elif t==0x0035:
        exact(2,64); exact(3,64); exact(5,32); exact(6,64)
        transfer=bytes.fromhex(fields[1]["value"]["raw_hex"])
        if _raw(fields[2])!=hashlib.sha3_512(b"LITHO_BRIDGE_TRANSFER_V1\x00"+transfer).digest(): raise LCEError("bridge transfer ID mismatch")
    elif t==0x0036:
        if _int(fields,1)==0 or _int(fields,3) not in (1,2,3) or (_int(fields,8)!=0 and _int(fields,8)<=_int(fields,7)) or (_int(fields,3)==3 and _int(fields,4)==0): raise LCEError("finality profile")
    elif t==0x0042:
        exact(4,64)
        profiles=fields[2]["value"]; lifecycles=fields[3]["value"]
        profile_ids=[_int({f["tag"]:f for f in x["fields"]},1) for x in profiles]
        lifecycle_ids=[_int({f["tag"]:f for f in x["fields"]},1) for x in lifecycles]
        if not profile_ids or profile_ids!=sorted(set(profile_ids)): raise LCEError("registry profile order")
        if not lifecycle_ids or lifecycle_ids!=sorted(set(lifecycle_ids)): raise LCEError("registry lifecycle order")
        if profile_ids!=lifecycle_ids: raise LCEError("registry profile lifecycle bijection")
    elif t==0x0040:
        if _int(fields,1)==0 or _int(fields,11)==0 or not 1<=len(fields[2]["value"])<=64: raise LCEError("profile definition")
        exact(3,32); exact(4,32); exact(5,64); exact(9,64); exact(10,64)
    elif t==0x0041:
        op=_int(fields,3);target=_int(fields,4);prior=_int(fields,5);requested=_int(fields,6)
        scheduled=_int(fields,7);activation=_int(fields,8);profile=fields.get(11)
        commitment=_raw(fields[9]); zero=not any(commitment)
        if op not in (1,2,3,4) or target==0 or scheduled==0 or _int(fields,1)==0 or _int(fields,10)==0: raise LCEError("registry mutation common")
        if op==1:
            if prior!=0 or requested!=1 or activation!=scheduled or profile is None: raise LCEError("registry define matrix")
            pf={f["tag"]:f for f in profile["value"]["fields"]}
            expected=hashlib.sha3_512(b"LITHO_CRYPTO_PROFILE_DEFINITION_V1\x00"+bytes.fromhex(profile["value"]["raw_hex"])).digest()
            if _int(pf,1)!=target or _int(pf,11)!=scheduled or zero or commitment!=expected: raise LCEError("registry define profile")
        elif op==2:
            if profile is not None or not zero or (prior,requested) not in {(1,2),(2,3),(3,4)} or activation<=scheduled: raise LCEError("registry schedule matrix")
        elif op==3:
            if profile is not None or not zero or prior not in (1,2,3) or requested!=0 or activation!=0: raise LCEError("registry cancel matrix")
        elif profile is not None or not zero or prior not in (1,2,3) or requested!=4 or activation<=scheduled:
            raise LCEError("registry emergency matrix")
    elif t==0x0044:
        state,next_state=_int(fields,2),_int(fields,4);next_height=_int(fields,5)
        edges={(1,2),(1,4),(2,3),(2,4),(3,4)}
        if state not in (1,2,3,4) or ((next_state==0)!=(next_height==0)) or (next_state and (state,next_state) not in edges): raise LCEError("registry lifecycle")
    elif t==0x0050:
        kind=_int(fields,3); lengths={1:20,2:32,3:20,4:32,5:32,6:32}
        if _int(fields,2)==0 or kind not in lengths or _blen(fields,4)!=lengths[kind] or _int(fields,5)==0 or _int(fields,8)==0 or _int(fields,10)==0: raise LCEError("policy local invariants")
    elif t==0x0051:
        node=_int(fields,1); params_obj=fields[2]["value"]; params=params_obj["object_type"]; children=fields.get(3,{"value":[]})["value"]
        expected={1:(0x0052,0,0),2:(0x0053,2,16),3:(0x0054,1,16),4:(0x0055,1,1),5:(0x0056,1,1)}.get(node)
        if expected is None or params!=expected[0] or not expected[1]<=len(children)<=expected[2]: raise LCEError("policy node schema")
        hashes=[hashlib.sha3_512(b"LITHO_POLICY_NODE_V1\x00"+bytes.fromhex(child["raw_hex"])).digest() for child in children]
        if hashes!=sorted(set(hashes)): raise LCEError("policy child order")
        if node==3:
            threshold_fields={f["tag"]:f for f in params_obj["fields"]}
            if _int(threshold_fields,1)>len(children): raise LCEError("threshold exceeds child count")
        if node in (2,3):
            def authorities(n:dict[str,Any])->list[bytes]:
                nf={f["tag"]:f for f in n["fields"]};kind=_int(nf,1)
                if kind==1:
                    pf={f["tag"]:f for f in nf[2]["value"]["fields"]};return [_raw(pf[6])]
                result=[]
                for child in nf.get(3,{"value":[]})["value"]:result.extend(authorities(child))
                return result
            keys=[]
            for child in children:keys.extend(authorities(child))
            if len(keys)!=len(set(keys)): raise LCEError("duplicate threshold authority")
    elif t==0x0054:
        if _int(fields,1)==0: raise LCEError("zero threshold")
    elif t==0x0052:
        if _int(fields,1)==0 or _int(fields,3)==0 or _int(fields,4)==0 or _int(fields,5)!=4: raise LCEError("key params")
    elif t==0x0056:
        exact(1,32)
        if _int(fields,2) not in (1,2,3) or _int(fields,4)==0 or _int(fields,5)==0 or _int(fields,7) not in (1,2,3): raise LCEError("rate limit")
    elif t==0x0060:
        kinds=set(range(0x0001,0x0014))|{0x0020,0x0021}
        if _int(fields,1) not in kinds or _int(fields,3)==0 or not 1<=len(fields[4]["value"])<=64: raise LCEError("artifact commitment")
    elif t in (0x0061,0x0062):
        if _int(fields,2)==0 or _int(fields,3)==0: raise LCEError("authority state")
        principals=[bytes.fromhex(x["raw_hex"]) for x in fields[5]["value"]]
        if not principals or principals!=sorted(set(principals)): raise LCEError("authority principal order")
    elif t==0x0064:
        if _int(fields,6)==0 or _int(fields,7)==0: raise LCEError("route policy")
    elif t==0x0065:
        if _int(fields,1)==0 or _int(fields,4)==0 or not 1<=len(fields[2]["value"])<=64: raise LCEError("proof format")
    elif t==0x0066:
        if _int(fields,1) not in range(1,8): raise LCEError("security reason")
    elif t==0x0017:
        if not any(_raw(fields[3])): raise LCEError("pending activation")
    elif t==0x0018:
        if _int(fields,3)==0 or _int(fields,5)==0 or _int(fields,8)==0: raise LCEError("active authorization state")
        if 6 in fields:
            pending={f["tag"]:f for f in fields[6]["value"]["fields"]}
            if _int(pending,9)!=_int(fields,3)+1 or _int(pending,11)!=_int(fields,5)+1: raise LCEError("pending counters")
        keys=fields[7]["value"]; order=[]
        for key in keys:
            kf={f["tag"]:f for f in key["fields"]}; order.append((_int(kf,1),_int(kf,2)))
        if not keys or order!=sorted(set(order)): raise LCEError("key state order")
    elif t==0x001A:
        if _int(fields,1)==0 or _int(fields,3) not in range(1,7) or _int(fields,6)==0: raise LCEError("lifecycle record")
    elif t==0x001B:
        op=_int(fields,1); domains={1:0x0004,2:0x0005,3:0x0007,4:0x0008}; results={1:4,2:4,3:6,4:4}
        proposed=any(_raw(fields[12])); prior=_int(fields,13); prior_slot=_int(fields,15)
        if op not in domains or _int(fields,2)!=domains[op] or _int(fields,8)!=op or _int(fields,14)!=results[op]: raise LCEError("pending mutation dispatch")
        if _int(fields,4)==0 or _int(fields,5)==0 or _int(fields,6)<=_int(fields,7) or _int(fields,9)==0 or _int(fields,11)==0: raise LCEError("pending mutation counters")
        if (op==3 and proposed) or (op!=3 and not proposed) or ((op==1)!=(prior==0)) or ((op==1)!=(prior_slot==0)) or (op in (2,3) and prior_slot!=_int(fields,4)) or (op==4 and prior_slot==0): raise LCEError("pending mutation key semantics")
    elif t==0x001D:
        payer={f["tag"]:f for f in fields[1]["value"]["fields"]}
        if _int(payer,1) not in (1,2) or _int(fields,2)!=0x000d or not any(_raw(fields[3])) or not 1<=len(fields[4]["value"])<=32: raise LCEError("fee payment action")
    elif t==0x001C:
        action=bytes.fromhex(fields[1]["value"]["raw_hex"]); action_commit=hashlib.sha3_512(b"LITHO_ACTIVATE_PENDING_MUTATION_V1\x00"+action).digest()
        fee=bytes.fromhex(fields[4]["value"]["raw_hex"]); fee_commit=hashlib.sha3_512(b"LITHO_FEE_PAYMENT_ACTION_V1\x00"+fee).digest()
        fee_fields={f["tag"]:f for f in fields[4]["value"]["fields"]}; payer={f["tag"]:f for f in fee_fields[1]["value"]["fields"]}; auth={f["tag"]:f for f in fields[5]["value"]["fields"]}; payload={f["tag"]:f for f in auth[1]["value"]["fields"]}
        if _int(fields,2)!=0x000d or _raw(fields[3])!=action_commit or _raw(fee_fields[3])!=action_commit: raise LCEError("permissionless action binding")
        if _int(payload,5)!=1 or _int(payload,6)!=3 or _int(payload,7)!=1 or _raw(payload[8])!=_raw(payer[2]) or _int(payload,16)!=0x0017 or _raw(payload[17])!=fee_commit or payload[14]["value"]!=fee_fields[4]["value"] or _int(payload,15)>_int(fee_fields,5): raise LCEError("fee payer authorization dispatch")
    elif t==0x0019:
        if _int(fields,1)==0 or _int(fields,2)==0 or _int(fields,5) not in range(1,8): raise LCEError("key state")
        material={f["tag"]:f for f in fields[4]["value"]["fields"]}
        if _int(material,1)!=_int(fields,3): raise LCEError("key profile mismatch")
    elif t==0x0045:
        if _int(fields,1) not in (1,2,3) or _int(fields,3)==0 or not 1<=len(fields[4]["value"])<=64: raise LCEError("profile artifact")
    elif t==0x0046:
        authority=_raw(fields[1]); policy={f["tag"]:f for f in fields[2]["value"]["fields"]}; state={f["tag"]:f for f in fields[3]["value"]["fields"]}
        if not any(authority) or _int(fields,4)==0 or _int(fields,6)==0 or _int(policy,3)!=4 or _raw(policy[4])!=authority or 7 in policy: raise LCEError("emergency authority identity")
        policy_raw=bytes.fromhex(fields[2]["value"]["raw_hex"]); policy_commit=hashlib.sha3_512(b"LITHO_POLICY_STATE_V1\x00"+policy_raw).digest()
        if _int(state,1)!=4 or _raw(state[2])!=authority or _int(policy,2)!=_int(state,3) or _int(policy,5)!=_int(state,5) or _raw(state[4])!=policy_commit: raise LCEError("emergency policy/state binding")
        root={f["tag"]:f for f in policy[6]["value"]["fields"]}; params={f["tag"]:f for f in root[2]["value"]["fields"]}; children=root.get(3,{"value":[]})["value"]
        if _int(root,1)!=3 or _int(params,1)!=2 or len(children)!=3: raise LCEError("emergency threshold")
        state_keys={}
        for item in state[7]["value"]:
            k={f["tag"]:f for f in item["fields"]}
            if _int(k,5)==4: state_keys[_int(k,1)]=k
        if set(state_keys)!={1,2,3}: raise LCEError("emergency active key slots")
        signers=[]; commitments=[]; slots=[]; profiles=[]
        for child in children:
            c={f["tag"]:f for f in child["fields"]}; kp={f["tag"]:f for f in c[2]["value"]["fields"]}
            if _int(c,1)!=1 or _int(kp,1) not in (0x0201,0x0102) or _int(kp,5)!=4: raise LCEError("emergency key profile")
            slot=_int(kp,3); sk=state_keys.get(slot)
            if sk is None or _int(sk,2)!=_int(kp,4) or _int(sk,3)!=_int(kp,1): raise LCEError("emergency key state")
            material=bytes.fromhex(sk[4]["value"]["raw_hex"]); expected=hashlib.sha3_512(b"LITHO_PUBLIC_KEY_COMMITMENT_V1\x00"+material).digest()
            if _raw(kp[6])!=expected: raise LCEError("emergency key commitment")
            slots.append(slot);signers.append(_raw(kp[2]));commitments.append(_raw(kp[6]));profiles.append(_int(kp,1))
        if set(slots)!={1,2,3} or len(set(signers))!=3 or len(set(commitments))!=3 or len(set(profiles))!=1: raise LCEError("emergency key distinctness")
    elif t==0x0115:
        op=_int(fields,3); has_issuer=7 in fields; has_state=10 in fields; has_lifecycle=11 in fields
        if op not in (1,2,3) or _int(fields,4) not in range(1,7) or _int(fields,8)==0 or _int(fields,9)==0: raise LCEError("provenance mutation")
        if (op in (1,2)) != has_issuer or (op in (1,2)) != has_state or (op in (1,2)) != has_lifecycle: raise LCEError("provenance mutation evidence")
        if (op==1 and any(_raw(fields[6]))) or (op!=1 and not any(_raw(fields[6]))): raise LCEError("provenance predecessor")
        if has_issuer:
            issuer={f["tag"]:f for f in fields[7]["value"]["fields"]}
            if _int(issuer,2)!=_int(fields,4) or _raw(issuer[1])!=_raw(fields[5]) or _int(issuer,6)!=_int(fields,8): raise LCEError("provenance target/proposed mismatch")
            if (op==1 and (_int(issuer,4)!=1 or _int(issuer,5)!=1 or any(_raw(fields[11])))) or (op==2 and (_int(issuer,4)<2 or _int(issuer,5)<2 or not any(_raw(fields[11])))): raise LCEError("provenance lifecycle evidence")
    elif t==0x0110:
        if _int(fields,2) not in range(1,7) or _int(fields,4)==0 or _int(fields,5)==0 or _int(fields,6)==0 or (_int(fields,7)!=0 and _int(fields,7)<=_int(fields,6)): raise LCEError("provenance issuer")
    elif t==0x0111:
        issuers=fields[2]["value"];identities=[];order=[]
        for issuer in issuers:
            q={f["tag"]:f for f in issuer["fields"]};identities.append(_raw(q[1]));order.append((_int(q,2),_raw(q[1])))
        if len(identities)!=len(set(identities)) or order!=sorted(order): raise LCEError("provenance issuer role separation/order")
    elif t==0x0117:
        old,new=_int(fields,2),_int(fields,3); path=fields[6]["value"]
        if old>new or len(path)>64: raise LCEError("consistency bounds")
        if old==new and path: raise LCEError("equal-size consistency path")
        if 0<old<new and not path: raise LCEError("missing consistency path")
    elif t==0x0113:
        size,index=_int(fields,2),_int(fields,3)
        if size==0 or index>=size or len(fields[5]["value"])>64: raise LCEError("inclusion bounds")
    elif t in (0x0100,0x0102):
        if t==0x0100 and (len(fields[3]["value"])!=40 or any(c not in "0123456789abcdef" for c in fields[3]["value"])): raise LCEError("commit")
        if t==0x0102 and (len(fields[7]["value"])!=40 or any(c not in "0123456789abcdef" for c in fields[7]["value"])): raise LCEError("remediation commit")
    elif t==0x010E:
        if _int(fields,1) not in (0x0100,0x0101,0x0102,0x0103) or _int(fields,2) not in (0x0030,0x0031,0x0032,0x0033) or _int(fields,4)==0: raise LCEError("provenance statement")
    elif t==0x010F:
        records={0x0100:(0x0030,"LITHO_BUILD_PROVENANCE_V1",1,1),0x0101:(0x0031,"LITHO_COMPILER_MANIFEST_V1",2,2),0x0102:(0x0032,"LITHO_AUDIT_REVIEW_V1",3,3),0x0103:(0x0033,"LITHO_DEPLOYMENT_ATTESTATION_V1",4,4)}
        record_type=_int(fields,1);rule=records.get(record_type)
        if rule is None or fields[2]["value"]["object_type"]!=record_type or _int(fields,3)!=rule[0] or _int(fields,6)!=rule[2]: raise LCEError("provenance envelope dispatch")
        record=bytes.fromhex(fields[2]["value"]["raw_hex"]);commit=hashlib.sha3_512(rule[1].encode()+b"\x00"+record).digest()
        if _raw(fields[4])!=commit: raise LCEError("provenance record commitment")
        statement={f["tag"]:f for f in fields[10]["value"]["fields"]}
        if _int(statement,1)!=record_type or _int(statement,2)!=rule[0] or _raw(statement[3])!=commit or _int(statement,4)!=_int(fields,7) or _raw(statement[5])!=_raw(fields[8]): raise LCEError("provenance statement binding")
        statement_raw=bytes.fromhex(fields[10]["value"]["raw_hex"]);statement_commit=hashlib.sha3_512(b"LITHO_PROVENANCE_STATEMENT_V1\x00"+statement_raw).digest()
        auth={f["tag"]:f for f in fields[9]["value"]["fields"]};payload={f["tag"]:f for f in auth[1]["value"]["fields"]};policy={f["tag"]:f for f in auth[3]["value"]["fields"]}
        record_fields={f["tag"]:f for f in fields[2]["value"]["fields"]}
        if _int(payload,5)!=6 or _int(payload,6)!=rule[3] or _int(payload,7)!=6 or _raw(payload[8])!=_raw(fields[5]) or _int(payload,16)!=0x003b or _raw(payload[17])!=statement_commit or _int(payload,12)!=_int(fields,7) or _int(record_fields,1)!=_int(fields,7): raise LCEError("provenance authorization payload")
        if _int(policy,3)!=6 or _raw(policy[4])!=_raw(fields[5]) or _raw(payload[10])!=hashlib.sha3_512(b"LITHO_POLICY_STATE_V1\x00"+bytes.fromhex(auth[3]["value"]["raw_hex"])).digest(): raise LCEError("provenance policy")
    elif t==0x0114:
        if _int(fields,1) not in (1,2): raise LCEError("merkle side")
        exact(2,64)


def _validate_field(field:Field,depth:int)->None:
    if not 1<=field.tag<=0xFFFF or field.wire not in KNOWN_WIRES: raise LCEError("field identity")
    if field.wire==ASCII and len(field.payload)>MAX_ASCII: raise LCEError("ASCII too large")
    if field.wire==BYTES and len(field.payload)>MAX_BYTES: raise LCEError("bytes too large")
    expected=FIXED_LENGTHS.get(field.wire)
    if expected is not None and len(field.payload)!=expected: raise LCEError("fixed width")
    if field.wire==BOOL and field.payload not in (b"\x00",b"\x01"): raise LCEError("Boolean")
    if field.wire==ASCII and any(b<0x21 or b>0x7E for b in field.payload): raise LCEError("ASCII")
    if field.wire==OBJECT: decode_object(field.payload,depth+1)
    if field.wire==OBJECT_LIST: decode_object_list(field.payload,depth+1)


def encode_object(object_type:int,fields:list[Field],version:int=1)->bytes:
    if object_type not in SCHEMAS or version!=1 or len(fields)>MAX_FIELDS: raise LCEError("object header")
    out=bytearray(MAGIC+object_type.to_bytes(2,"big")+version.to_bytes(2,"big")+len(fields).to_bytes(2,"big")); previous=0
    for field in fields:
        if field.tag<=previous: raise LCEError("field order")
        _validate_field(field,1)
        out += field.tag.to_bytes(2,"big")+bytes([field.wire])+len(field.payload).to_bytes(4,"big")+field.payload
        previous=field.tag
    encoded=bytes(out)
    if len(encoded)>OBJECT_LIMITS.get(object_type,MAX_OBJECT): raise LCEError("object too large")
    decode_object(encoded)
    return encoded


def decode_object_list(data:bytes,depth:int)->list[dict[str,Any]]:
    if depth>MAX_DEPTH or len(data)<2: raise LCEError("list bounds")
    count=int.from_bytes(data[:2],"big")
    if count>MAX_LIST_ITEMS: raise LCEError("list count")
    cursor=2; items=[]
    for _ in range(count):
        if cursor+4>len(data): raise LCEError("list length")
        size=int.from_bytes(data[cursor:cursor+4],"big"); cursor+=4
        if size==0 or cursor+size>len(data): raise LCEError("list item")
        items.append(decode_object(data[cursor:cursor+size],depth)); cursor+=size
    if cursor!=len(data): raise LCEError("list trailing")
    return items


def decode_object(data:bytes,depth:int=1)->dict[str,Any]:
    if depth>MAX_DEPTH or len(data)<10 or len(data)>MAX_OBJECT or data[:4]!=MAGIC: raise LCEError("object bounds/magic")
    object_type=int.from_bytes(data[4:6],"big"); version=int.from_bytes(data[6:8],"big"); count=int.from_bytes(data[8:10],"big")
    if object_type not in SCHEMAS or version!=1 or count>MAX_FIELDS: raise LCEError("unknown object/schema")
    if len(data)>OBJECT_LIMITS.get(object_type,MAX_OBJECT): raise LCEError("object-specific limit")
    cursor=10; previous=0; fields=[]
    for _ in range(count):
        if cursor+7>len(data): raise LCEError("field header")
        tag=int.from_bytes(data[cursor:cursor+2],"big"); wire=data[cursor+2]; size=int.from_bytes(data[cursor+3:cursor+7],"big"); cursor+=7
        if tag==0 or tag<=previous or wire not in KNOWN_WIRES or cursor+size>len(data): raise LCEError("field identity/length")
        payload=data[cursor:cursor+size]; field=Field(tag,wire,payload); _validate_field(field,depth)
        value:Any=payload.hex()
        if wire==ASCII:value=payload.decode("ascii")
        elif wire in FIXED_LENGTHS:value=int.from_bytes(payload,"big")
        elif wire==OBJECT:value=decode_object(payload,depth+1)
        elif wire==OBJECT_LIST:value=decode_object_list(payload,depth+1)
        fields.append({"tag":tag,"wire":wire,"value":value}); cursor+=size; previous=tag
    if cursor!=len(data): raise LCEError("object trailing")
    schema=SCHEMAS[object_type]; present={f["tag"] for f in fields}; allowed=set(schema); required={t for t,r in schema.items() if r.required}
    if not present.issubset(allowed) or not required.issubset(present): raise LCEError("unknown/missing tag")
    by_tag={f["tag"]:f for f in fields}
    for tag in present:
        rule=schema[tag]; field=by_tag[tag]
        if field["wire"]!=rule.wire: raise LCEError("wrong schema wire")
        if rule.nested is not None and field["value"]["object_type"]!=rule.nested: raise LCEError("wrong child type")
        if rule.list_nested is not None and any(x["object_type"]!=rule.list_nested for x in field["value"]): raise LCEError("wrong list child")
    result={"object_type":object_type,"version":version,"fields":fields,"raw_hex":data.hex()}
    _semantic(result)
    return result
