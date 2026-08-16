# `lithtest` implementation specification

Status: reviewed specification only. The `lithtest` crate remains at `0.0.1`
and must not discover, execute, or report Lithic tests as passing. This matches
the original toolchain target, which lists the test runner as specification-only
in this scaffold.

## Required owner inputs

Implementation is blocked until the Lithic/compiler and LithoVM owners approve:

- test module/file discovery rules and the exact test annotation syntax;
- setup, teardown, fixtures, parameterization, and expected-failure semantics;
- assertion and failure/revert behavior;
- account, caller, value, time, block, storage, and chain-state isolation rules;
- supported cheatcodes and their security boundary;
- gas accounting and whether coverage is a v0 release gate;
- the compiler/VM conformance vectors that the runner must execute.

No syntax or runtime behavior in this list may be inferred from raw function-body
text or from another smart-contract language.

## Minimum implementation boundary

A future implementation may be called a test runner only when it:

1. compiles the approved test language through the same typed compiler and
   deterministic bytecode path used for deployable contracts;
2. executes each test in an approved LithoVM implementation, with deterministic
   state isolation and explicit environment configuration;
3. treats unsupported syntax, compilation failures, VM errors, unexpected
   reverts, timeouts, and tests with no executable body as failures rather than
   passes;
4. reports source-backed failure locations and preserves the underlying compiler
   and VM diagnostics;
5. uses stable exit codes for success, test failure, invalid input/configuration,
   and unavailable infrastructure;
6. never accesses production RPC endpoints, production keys, or shared state;
7. labels gas and coverage data only when the approved VM instrumentation
   produces those values.

## Required verification

- Discovery fixtures for included, excluded, duplicate, malformed, and empty
  tests after the syntax is approved.
- Compiler failure, expected/unexpected revert, assertion, timeout, panic, and VM
  infrastructure cases with exact exit-code assertions.
- Per-test and per-file isolation fixtures for storage, balances, caller, value,
  block/time, events, and deployed contracts.
- Deterministic repeated and parallel runs with stable ordering and output.
- Source-location tests including non-ASCII text and generated code/source maps.
- Approved compiler/LithoVM conformance vectors on Linux, Windows, and macOS.
- Release-owner acceptance of output format, gas reporting, coverage scope, and
  supported editor/CI integrations.

## Rejected draft boundary

The local uncommitted draft reviewed on 2026-08-16 is not acceptable for release.
It promotes the crate to `0.1.0` and scans raw body strings for assertion-like
text. It can match comments or literals, ignores arbitrary non-assertion code,
passes tests with no assertions, evaluates no contract state or control flow,
and executes no LithoVM bytecode. None of that draft is included in this slice.
