//! `lithpkg` — Lithic package manager. Spec-only stub.

fn main() {
    println!(
        "lithpkg {} — Lithic package manager (SPEC-ONLY, not yet implemented)\n\
\n\
Planned responsibilities:\n\
  * `lithpkg.toml` manifests with semver dependency resolution\n\
  * fetch/vendor reusable Lithic modules (e.g. LEP100 standards library)\n\
  * lockfile + reproducible builds, integrated with lithc include paths\n\
\n\
This binary currently exits without managing packages. See toolchain/README.md.",
        env!("CARGO_PKG_VERSION")
    );
}
