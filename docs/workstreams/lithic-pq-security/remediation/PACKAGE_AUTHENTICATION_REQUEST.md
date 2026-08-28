# Package Authentication Requirement

Internal hashes do not authenticate KaJ Labs as issuer. R8 remains unsigned
during design re-review. Only after Autha closes the design, KaJ Labs must
perform one of these actions over the exact final freeze ZIP:

1. publish the ZIP and SHA-256 in a signed KaJLabs/Lithosphere GitHub release;
2. produce a detached signature with an approved KaJ Labs organizational key
   and provide the public verification identity; or
3. produce an approved Sigstore attestation bound to the ZIP SHA-256.

The signature/attestation must be created after the final ZIP digest is known.
No personal or unregistered key may be represented as KaJ Labs authentication.

Autha should receive the ZIP, digest, authentication artifact, signer identity,
and verification command. Private signing keys are never shared.
