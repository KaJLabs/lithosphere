//! `lithls` — Lithic language-server specification marker.

use std::process::ExitCode;

const STATUS: &str = "lithls is specification-only in this scaffold; no LSP server is available";

fn print_help() {
    println!(
        "lithls {} — Lithic language server (specification-only)\n\
\n\
USAGE:\n\
    lithls [--help | --version | --stdio]\n\
\n\
OPTIONS:\n\
    --stdio    Fail explicitly because the LSP server is not implemented\n\
    --version  Print the package version\n\
    -h, --help Print this help\n\
\n\
See toolchain/specs/lithls.md for the reviewed implementation boundary.",
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
            println!("lithls {}", env!("CARGO_PKG_VERSION"));
            ExitCode::SUCCESS
        }
        [arg] if arg == "--stdio" => {
            eprintln!("lithls: unavailable: {STATUS}");
            ExitCode::from(3)
        }
        _ => {
            eprintln!("lithls: error: unsupported arguments");
            ExitCode::from(2)
        }
    }
}
