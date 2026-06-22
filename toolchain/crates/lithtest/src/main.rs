//! `lithtest` — Lithic test runner. Spec-only stub.

fn main() {
    println!(
        "lithtest {} — Lithic test runner (SPEC-ONLY, not yet implemented)\n\
\n\
Planned responsibilities:\n\
  * discover and run `#[test]`-style functions in .lithic test modules\n\
  * execute against an in-process LithoVM with cheatcodes (warp, prank, expect)\n\
  * report pass/fail with gas usage and coverage\n\
\n\
This binary currently exits without running tests. See toolchain/README.md.",
        env!("CARGO_PKG_VERSION")
    );
}
