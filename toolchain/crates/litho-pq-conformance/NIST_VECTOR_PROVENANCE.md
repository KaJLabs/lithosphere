# NIST vector provenance

The key-generation known-answer checks are selected from NIST's public
ACVP-Server sample vectors at commit:

`975de31eb83d87039ec88934fdc47d8c312b892d`

Source files:

- `gen-val/json-files/ML-DSA-keyGen-FIPS204/internalProjection.json`
- `gen-val/json-files/SLH-DSA-keyGen-FIPS205/internalProjection.json`

Selected cases:

| Profile | ACVP case | Expected public-key SHA-256 | Expected secret-key SHA-256 |
| --- | ---: | --- | --- |
| ML-DSA-65 | 26 | `b1a7d0d2f0d7a04b9d5ffccd9bd578864dab4a01cdd7f70a05cd1f4f0672e43a` | `56c53ac82fbff7d81b7a8cfbbc73011ceccad677e16dc53f2ece66d49aa11edd` |
| ML-DSA-87 | 51 | `33f49649f05ec2fc3b050007b18ade043bbc8d1c0ded03a269d540486daaa5f4` | `c64e15742f27d7d8e2832f7d55a5c014f2c9536082f3a3181cfc6246908dd649` |
| SLH-DSA-SHAKE-256s | 91 | `49a30ef4ed23a45399324c774fab8572e668f0266575c152783c8187395d9365` | `3411ecdfeac0db9c1bba94f9d3384e8ef0e82b08bdb373c71884e9a6348ae86d` |

These checks establish agreement with an independently generated NIST sample
for key generation. They are evidence for the Phase 1 candidate only; they are
not a FIPS 140 validation and do not authorize activation.

