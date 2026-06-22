//! `lithsec` — capability and storage safety scanner. Spec-only stub.

fn main() {
    println!(
        "lithsec {} — capability & storage safety scanner (SPEC-ONLY, not yet implemented)\n\
\n\
Planned responsibilities:\n\
  * capability analysis: which functions can mint/burn/pause, and who holds the\n\
    roles that gate them\n\
  * storage safety: detect unbounded growth, missing access checks on state\n\
    mutation, and reentrancy-prone external calls\n\
  * AI-primitive review: flag `await ai.request` paths without an @ai_budget\n\
\n\
This binary currently exits without scanning. See toolchain/README.md.",
        env!("CARGO_PKG_VERSION")
    );
}
