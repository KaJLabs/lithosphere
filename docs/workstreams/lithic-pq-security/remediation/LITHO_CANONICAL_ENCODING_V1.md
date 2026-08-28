# LITHO Canonical Encoding V1 (LCE1)

**Normative status:** Phase 0 remediation candidate R8; disabled/non-consensus
**Applies to:** PQ authorization, registry, bridge, manifest, provenance, and deployment records

The key words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, and MAY are normative.

## 1. Byte order and object header

All integers are unsigned, fixed-width, and big-endian. An LCE1 object is:

| Offset | Size | Meaning |
|---:|---:|---|
| 0 | 4 | ASCII magic `LCE1` (`4c434531`) |
| 4 | 2 | object type (`u16`) |
| 6 | 2 | schema version (`u16`), exactly `1` for this specification |
| 8 | 2 | field count (`u16`) |
| 10 | variable | exactly `field_count` fields |

Each field is:

| Offset | Size | Meaning |
|---:|---:|---|
| 0 | 2 | field tag (`u16`) |
| 2 | 1 | wire type (`u8`) |
| 3 | 4 | payload length (`u32`) |
| 7 | variable | payload |

Tags MUST be non-zero and strictly increasing. Duplicate, missing-required, unexpected, or out-of-order tags are invalid. Schema definitions enumerate every permitted optional tag; v1 has no generic extensions.

## 2. Wire types

| Code | Name | Payload rule |
|---:|---|---|
| `0x01` | `U8` | exactly 1 byte |
| `0x02` | `U16` | exactly 2 bytes |
| `0x03` | `U32` | exactly 4 bytes |
| `0x04` | `U64` | exactly 8 bytes |
| `0x05` | `U256` | exactly 32 bytes; leading zero bytes retained |
| `0x06` | `BOOL` | exactly 1 byte, only `00` or `01` |
| `0x10` | `BYTES` | length defined by the object schema |
| `0x11` | `ASCII` | bytes `0x21..0x7e`; no whitespace, NUL, Unicode, normalization, or case folding |
| `0x20` | `OBJECT` | exactly one complete canonical LCE1 object |
| `0x21` | `OBJECT_LIST` | `u16 count`, then repeated `u32 item_length || LCE1 object`; no trailing bytes |

No `NULL`, floating point, signed integer, map, implicit default, indefinite length, varint, UTF-8 string, or alternate Boolean representation exists in v1. Optional values are represented only by absence of a schema-declared optional field.

Lists are ordered. Where a schema treats a list as a set, it MUST define a canonical sort key and reject duplicate or unsorted entries. Empty lists are allowed only when the object schema explicitly permits them.

## 3. Decoder algorithm

A conforming decoder MUST:

1. Reject input larger than the object-specific limit before allocating.
2. Require the exact magic, known object type, and schema version.
3. Read the field count and reject counts exceeding the object-specific maximum.
4. For every field, ensure the seven-byte header is present before reading it.
5. Reject tag zero, non-increasing tags, unknown tags, wrong wire types, and lengths exceeding the remaining input or schema limit.
6. Validate fixed-width values, Boolean values, and ASCII bytes before constructing application objects.
7. Recursively validate nested objects with depth starting at 1 and never exceeding 8.
8. Require nested object type/version exactly as specified by the parent schema.
9. Require complete consumption of each nested object/list item and the outer object.
10. Reject on the first error without invoking cryptographic verification.

There is no permissive mode. A decoder MUST NOT normalize, reorder, ignore, coerce, or preserve unknown data.

## 4. Encoder algorithm

A conforming encoder MUST validate the schema first, sort nothing implicitly, emit required and present optional fields once in ascending tag order, use the exact declared wire type and width, and emit no bytes outside the structure above.

## 5. Global ceilings

- Absolute LCE1 object: 1,048,576 bytes.
- Nesting depth: 8.
- Fields per object: 64.
- Items per object list: 128.
- Individual `BYTES` field: 65,536 bytes unless a smaller schema limit applies.
- Individual `ASCII` field: 128 bytes unless a smaller schema limit applies.

Object-specific limits in `RESOURCE_LIMITS_V1.md` override these downward, never upward.

## 6. Hashing convention

`SHA3_256(x)` and `SHA3_512(x)` mean FIPS 202 SHA3 with a byte-string input and 32-byte or 64-byte output. Domain tags are exact printable ASCII followed by one NUL byte (`00`).

No raw concatenation of variable-length fields is permitted. Every structured
protocol commitment is registered in `HASH_DOMAIN_REGISTRY_V1.md` and is:

```text
Hash(exact_domain_tag || CanonicalEncode(exact_typed_object))
```

## 7. Conformance

The files in `vectors/` are normative. A decoder must accept every golden vector and reject every negative vector with no partial object. Two independently written decoders must agree before the format can be frozen.

Structural parsing alone is not conformance. A conforming decoder MUST use the
object schema registry, reject unknown object types, require every mandatory
tag, reject undeclared tags, check each exact wire type and length/value range,
enforce parent/child object types, and run object-specific semantic validation.
The reference decoders and vectors implement structural parsing,
object-specific semantic validation, and encoded-object ceilings. Stateful
authorization admission, cryptographic verification, gas accounting, and
block-wide counters are separate normative runtime stages and are not claimed
as codec responsibilities.
