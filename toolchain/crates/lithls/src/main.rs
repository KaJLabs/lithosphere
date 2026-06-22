//! `lithls` — Lithic language server. Spec-only stub.

fn main() {
    println!(
        "lithls {} — Lithic language server (SPEC-ONLY, not yet implemented)\n\
\n\
Planned responsibilities:\n\
  * LSP server over stdio for editors (VS Code, Neovim, JetBrains)\n\
  * diagnostics on save (reuse lithic-syntax + lithlint)\n\
  * go-to-definition, hover types, completion for contract members\n\
  * document symbols / outline from the declaration AST\n\
\n\
This binary currently exits without serving. See toolchain/README.md.",
        env!("CARGO_PKG_VERSION")
    );
}
