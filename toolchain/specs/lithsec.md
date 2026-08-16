# `lithsec` implementation specification

Status: reviewed specification only. The `lithsec` crate remains at `0.0.1` and
must not claim that a contract was scanned or found safe. This matches the
original toolchain target, which lists the capability and storage safety scanner
as specification-only in this scaffold.

## Required owner inputs

Implementation is blocked until the Lithic/compiler, LithoVM, and security owners
approve a versioned threat model containing:

- the supported Lithic language and bytecode versions;
- capability creation, delegation, revocation, and authorization semantics;
- storage visibility, aliasing, initialization, mutation, growth, and upgrade
  semantics;
- external/internal call, callback, await, atomicity, revert, and reentrancy
  behavior;
- AI primitive capability, budget, charging, failure, and result-trust rules;
- privileged lifecycle operations and whether EVM-compatible low-level operations
  exist in the supported language;
- rule identifiers, severity, confidence, suppression, baseline, and versioning
  policy;
- the accepted false-positive and false-negative thresholds for each rule.

No Solidity keyword, EVM opcode, authorization pattern, state-write pattern, or
async/reentrancy relationship may be inferred without that approved model.

## Minimum implementation boundary

A future implementation may be called a security scanner only when it:

1. consumes typed compiler IR and resolved call/storage/capability information,
   not raw body substrings;
2. identifies comments, literals, identifiers, operators, calls, assignments,
   effects, and control-flow paths structurally;
3. ties every finding to an approved, versioned rule with a real source span,
   severity, confidence, explanation, and actionable remediation;
4. distinguishes proven findings from heuristics and never reports “safe” merely
   because no heuristic matched;
5. validates suppression directives against an approved policy and records them
   in machine-readable output;
6. supports deterministic human and machine-readable output with stable exit
   codes for findings, invalid input/configuration, and unavailable analysis;
7. fails closed on unsupported compiler/IR versions or incomplete analysis;
8. runs without RPC, key, network, or production-state access unless a separate
   approved dynamic-analysis mode explicitly requires it.

## Required verification

- A security-owner-reviewed positive and negative fixture corpus for every rule.
- Fixtures proving that comments, strings, similarly named identifiers, dead
  code, guards unrelated to authorization, and unsupported syntax do not create
  misleading results.
- Interprocedural and path-sensitive fixtures for capability flow, storage
  effects, callbacks, awaits, reverts, and privileged operations.
- Stable rule/severity/suppression behavior across compiler and scanner versions.
- Exact source spans including non-ASCII and generated/source-mapped code.
- False-positive/negative measurements against the approved corpus and both
  tracked Makalu Lithic contracts.
- Deterministic Linux, Windows, and macOS output plus independent compiler and
  security-owner acceptance.

## Rejected draft boundary

The local uncommitted draft reviewed on 2026-08-16 is not acceptable for release.
It promotes the crate to `0.1.0` and applies SEC001–SEC005 with raw substring and
line matching. It assumes unapproved Solidity/EVM constructs and Lithic runtime
semantics, can match comments or literals, treats any `assert` as access control,
and treats a textual state write after `await` as reentrancy evidence without
typed control-flow or call analysis. None of that draft is included in this
slice.
