//! `lithdev` — local devnet and deployment helper. Spec-only stub.

fn main() {
    println!(
        "lithdev {} — local devnet & deployment helper (SPEC-ONLY, not yet implemented)\n\
\n\
Planned responsibilities:\n\
  * `lithdev up` — start a local LithoVM devnet (wraps the existing\n\
    docker-compose.dev.yml / anvil stack)\n\
  * `lithdev deploy <FILE.lithic>` — compile via lithc and deploy to a target\n\
    RPC (defaults to the local devnet, or rpc.litho.ai for Makalu)\n\
  * `lithdev call/send` — interact with a deployed contract using its ABI\n\
\n\
This binary currently exits without acting. See toolchain/README.md.",
        env!("CARGO_PKG_VERSION")
    );
}
