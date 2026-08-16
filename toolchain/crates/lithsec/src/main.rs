//! `lithsec` — Lithic security-scanner specification marker.

use std::process::ExitCode;

const STATUS: &str =
    "lithsec is specification-only in this scaffold; no security scan is performed";

fn print_help() {
    println!(
        "lithsec {} — capability and storage safety scanner (specification-only)\n\
\n\
USAGE:\n\
    lithsec [--help | --version | --scan]\n\
\n\
OPTIONS:\n\
    --scan     Fail explicitly because the reviewed scanner is unavailable\n\
    --version  Print the package version\n\
    -h, --help Print this help\n\
\n\
See toolchain/specs/lithsec.md for the reviewed implementation boundary.",
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
            println!("lithsec {}", env!("CARGO_PKG_VERSION"));
            ExitCode::SUCCESS
        }
        [arg] if arg == "--scan" => {
            eprintln!("lithsec: unavailable: {STATUS}");
            ExitCode::from(3)
        }
        _ => {
            eprintln!("lithsec: error: unsupported arguments");
            ExitCode::from(2)
        }
    }
}
