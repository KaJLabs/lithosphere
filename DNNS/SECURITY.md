# DNNS dependency security boundary

DNNS uses a build-only subset of `@ensdomains/ens-contracts@1.4.0` for the
Kamet v0 registry, registrar, resolver, and reverse-registrar contracts. The
version, npm registry URL, and package integrity are fixed in
`package-lock.json` and enforced before installation by
`scripts/verify-dependency-pins.js`.

Two upstream advisories require explicit treatment:

- [GHSA-58x9-4xmp-8mg5](https://github.com/advisories/GHSA-58x9-4xmp-8mg5)
  identifies malicious package version `1.6.1`. DNNS pins `1.4.0` and refuses
  version or integrity drift.
- [GHSA-c6rr-7pmc-73wc](https://github.com/advisories/GHSA-c6rr-7pmc-73wc)
  affects ENS DNSSEC RSA verification. DNNS v0 does not import, compile, or
  deploy `DNSSECImpl`, `DNSRegistrar`, `RSASHA256Algorithm`, or
  `RSASHA1Algorithm`; `.litho` registration does not use DNSSEC.

Because ecosystem scanners may conservatively flag the package name or all
versions, the advisory must remain visible and this scope analysis must be
reviewed whenever imports or the pinned version change. Do not suppress the
advisory globally and never install `1.6.1`.

All dependencies in this directory are build/development dependencies; DNNS
does not ship a Node.js runtime. `npm audit --omit=dev` therefore reports no
runtime vulnerabilities. The legacy Hardhat 2/ethers 5 build graph still has
unresolved development-tool advisories. Install and compile only in an
ephemeral, unprivileged environment without credentials. Do not install this
toolchain on a validator, signer, or administrator workstation, and do not use
it for a new deployment until the build toolchain has been separately
upgraded and reviewed.

The custom Solidity source remains unchanged from the recorded deployed-source
provenance. A future DNNS contract migration requires a separate audit and
deployment approval.
