//! `lithpkg` — Lithic package-manager specification marker.

use std::process::ExitCode;

const STATUS: &str =
    "lithpkg is specification-only in this scaffold; no package operation is performed";

fn print_help() {
    println!(
        "lithpkg {} — Lithic package manager (specification-only)\n\
\n\
USAGE:\n\
    lithpkg [--help | --version | --resolve]\n\
\n\
OPTIONS:\n\
    --resolve  Fail explicitly because package resolution is unavailable\n\
    --version  Print the package version\n\
    -h, --help Print this help\n\
\n\
See toolchain/specs/lithpkg.md for the reviewed implementation boundary.",
        env!("CARGO_PKG_VERSION")
    );
}

fn main() -> ExitCode {
    let args: Vec<_> = std::env::args().skip(1).collect();
    match args.as_slice() {
        [] => {
            println!("{STATUS}");
            ExitCode::SUCCESS
        }
        [arg] if arg == "-h" || arg == "--help" => {
            print_help();
            ExitCode::SUCCESS
        }
        [arg] if arg == "--version" => {
            println!("lithpkg {}", env!("CARGO_PKG_VERSION"));
            ExitCode::SUCCESS
        }
        [arg] if arg == "--resolve" => {
            eprintln!("lithpkg: unavailable: {STATUS}");
            ExitCode::from(3)
        }
        _ => {
            eprintln!("lithpkg: error: unsupported arguments");
            ExitCode::from(2)
        }
    }
}
