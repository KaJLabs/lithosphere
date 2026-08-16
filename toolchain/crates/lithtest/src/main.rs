//! `lithtest` — Lithic test-runner specification marker.

use std::process::ExitCode;

const STATUS: &str =
    "lithtest is specification-only in this scaffold; no Lithic tests are executed";

fn print_help() {
    println!(
        "lithtest {} — Lithic test runner (specification-only)\n\
\n\
USAGE:\n\
    lithtest [--help | --version | --run]\n\
\n\
OPTIONS:\n\
    --run      Fail explicitly because VM-backed test execution is unavailable\n\
    --version  Print the package version\n\
    -h, --help Print this help\n\
\n\
See toolchain/specs/lithtest.md for the reviewed implementation boundary.",
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
            println!("lithtest {}", env!("CARGO_PKG_VERSION"));
            ExitCode::SUCCESS
        }
        [arg] if arg == "--run" => {
            eprintln!("lithtest: unavailable: {STATUS}");
            ExitCode::from(3)
        }
        _ => {
            eprintln!("lithtest: error: unsupported arguments");
            ExitCode::from(2)
        }
    }
}
