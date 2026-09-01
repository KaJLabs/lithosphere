# NIST vector provenance

The key-generation known-answer checks are selected from NIST's public
ACVP-Server sample vectors at commit:

`975de31eb83d87039ec88934fdc47d8c312b892d`

Source files:

- `gen-val/json-files/ML-DSA-keyGen-FIPS204/internalProjection.json`
- `gen-val/json-files/SLH-DSA-keyGen-FIPS205/internalProjection.json`
- `gen-val/json-files/ML-DSA-sigGen-FIPS204/internalProjection.json`
- `gen-val/json-files/ML-DSA-sigVer-FIPS204/internalProjection.json`
- `gen-val/json-files/SLH-DSA-sigGen-FIPS205/internalProjection.json`
- `gen-val/json-files/SLH-DSA-sigVer-FIPS205/internalProjection.json`

Selected cases:

| Profile | ACVP case | Expected public-key SHA-256 | Expected secret-key SHA-256 |
| --- | ---: | --- | --- |
| ML-DSA-65 | 26 | `b1a7d0d2f0d7a04b9d5ffccd9bd578864dab4a01cdd7f70a05cd1f4f0672e43a` | `56c53ac82fbff7d81b7a8cfbbc73011ceccad677e16dc53f2ece66d49aa11edd` |
| ML-DSA-87 | 51 | `33f49649f05ec2fc3b050007b18ade043bbc8d1c0ded03a269d540486daaa5f4` | `c64e15742f27d7d8e2832f7d55a5c014f2c9536082f3a3181cfc6246908dd649` |
| SLH-DSA-SHAKE-256s | 91 | `49a30ef4ed23a45399324c774fab8572e668f0266575c152783c8187395d9365` | `3411ecdfeac0db9c1bba94f9d3384e8ef0e82b08bdb373c71884e9a6348ae86d` |

The reduced signature fixture manifest is
`fixtures/nist/manifest.json` (SHA-256
`756599cf7726563346a3875f42e194e40825176cee323d54622cbbe2c305c87d`).
It records the SHA-256 of every full upstream JSON source and every extracted
binary. `fixtures/generate_from_nist.py` deterministically regenerates it from
those immutable sources. The Phase 1 package verifier enforces this commitment
against both the candidate and self-contained reproduction copies.

| Profile | Operation | ACVP group/case | Expected result |
| --- | --- | --- | --- |
| ML-DSA-65 | sigGen | tg3/tc31 | exact signature bytes |
| ML-DSA-87 | sigGen | tg5/tc61 | exact signature bytes |
| SLH-DSA-SHAKE-256s | sigGen | tg29/tc252 | exact signature bytes |
| ML-DSA-65 | sigVer | tg3/tc33, tc31 | valid, invalid |
| ML-DSA-87 | sigVer | tg5/tc63, tc61 | valid, invalid |
| SLH-DSA-SHAKE-256s | sigVer | tg29/tc399, tc393 | valid, invalid |

The ACVP signature cases exercise their published NIST contexts. Separate
tests exercise the exact frozen LITHO contexts and prove fail-closed behavior
for a wrong context, altered message, altered signature, wrong public key, and
N-1/N+1 key or signature encodings for every profile. Both ML-DSA profiles
also route a repeated-hint encoding through the public verifier.

These checks establish agreement with independently generated NIST samples.
They are evidence for the disabled Phase 1 candidate only; they are not FIPS
140 validation, a claim of NIST module certification, or activation approval.
