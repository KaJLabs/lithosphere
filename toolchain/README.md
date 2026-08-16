# Lithosphere Developer Toolchain

A Rust workspace for the Lithic smart-contract language that targets LithoVM
bytecode (EVM-compatible). This is the **scaffold** stage: the front-end of the
pipeline is real, and the remaining tools are honest spec-only stubs.

The language surface is defined by the example contracts in
`Makalu/contracts/src/*.lithic` (`DOGE.lithic`, `FinesseWarriors.lithic`), which
the parser is tested against as golden files.

## Tools

| Tool       | Status        | What it does today |
|------------|---------------|--------------------|
| `lithc`    | **real (front-end)** | Lex + parse `.lithic`, reject unambiguous declaration-name collisions, and support `--emit summary\|ast\|abi\|check`. Full type checking and bytecode codegen are next. |
| `lithfmt`  | **real (v0)** | Safe whitespace normalisation (tabs→spaces, strip trailing, single trailing newline); refuses to touch files with parse errors. `--check` for CI. |
| `lithlint` | **real (v0)** | AST-driven lint rules L001–L004 (naming + `@ai_budget` on `pub async fn`). `--deny-warnings` for CI. |
| `lithls`   | spec-only stub | Language server (LSP). |
| `lithdev`  | spec-only stub | Local devnet + deploy helper. |
| `lithtest` | spec-only stub | Test runner. |
| `lithsec`  | spec-only stub | Capability + storage safety scanner. |
| `lithpkg`  | spec-only stub | Package manager. |

The shared crate `lithic-syntax` holds the lexer, parser, AST and diagnostics;
every tool builds on it.

## Design notes

- **Zero external dependencies.** The whole workspace is std-only, so it builds
  offline without a crates.io fetch. JSON and argument parsing are hand-rolled.
- **Declaration-level parsing.** Contract / const / state / event / function
  *signatures*, attributes and types (including nested `map<.., map<..>>`) are
  fully parsed. Function bodies are captured as raw source via balanced-brace
  scanning — full statement/expression parsing is a later phase. This keeps the
  scaffold robust against syntax the front-end does not model yet.
- **The lexer never fails.** Unknown characters become `Other` tokens so body
  capture and tooling keep working.

## Build & test

```sh
cd toolchain
cargo build
cargo test            # includes golden tests against the real .lithic examples
```

## Try it

```sh
cargo run -p lithc -- ../Makalu/contracts/src/DOGE.lithic
cargo run -p lithc -- --emit abi ../Makalu/contracts/src/DOGE.lithic
cargo run -p lithlint -- ../Makalu/contracts/src/FinesseWarriors.lithic
cargo run -p lithfmt -- --check ../Makalu/contracts/src/DOGE.lithic
```

## Roadmap (next phases)

1. `lithc`: specify and implement name resolution + type checking over the declaration AST. The current conservative pass intentionally does not infer unapproved type, overload, map-key, or return rules.
2. `lithc`: full statement/expression parsing of function bodies.
3. `lithc`: lower to LithoVM/EVM bytecode + canonical ABI JSON.
4. `lithfmt`: AST-driven canonical formatting.
5. `lithdev`: wire to the existing devnet (`Makalu/docker-compose.dev.yml`).
6. Promote the stubs (`lithls`, `lithtest`, `lithsec`, `lithpkg`) to real tools.
