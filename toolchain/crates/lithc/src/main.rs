//! `lithc` — the Lithic compiler.
//!
//! This scaffold implements the compiler front-end: it lexes and parses a
//! `.lithic` source file, reports diagnostics, and emits either a human
//! summary, the declaration AST as JSON, or a Lithic ABI as JSON. It performs
//! conservative declaration checks, while full type checking and LithoVM
//! bytecode codegen remain future phases (see README).

use std::process::exit;

fn print_help() {
    eprintln!(
        "lithc {} — Lithic compiler (front-end scaffold)\n\
\n\
USAGE:\n\
    lithc [OPTIONS] <FILE.lithic>\n\
\n\
OPTIONS:\n\
    --emit <KIND>   Output kind: summary (default), ast, abi, check\n\
    -h, --help      Print this help\n\
\n\
EXAMPLES:\n\
    lithc Makalu/contracts/src/DOGE.lithic\n\
    lithc --emit abi DOGE.lithic\n\
    lithc --emit check DOGE.lithic\n\
\n\
NOTE: check validates parsing and unambiguous declaration-name collisions.\n\
Full type checking and LithoVM bytecode emission are not yet implemented.",
        env!("CARGO_PKG_VERSION")
    );
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let mut path: Option<String> = None;
    let mut emit = String::from("summary");

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--emit" => {
                i += 1;
                if i < args.len() {
                    emit = args[i].clone();
                } else {
                    eprintln!("lithc: error: --emit requires a value");
                    exit(2);
                }
            }
            "-h" | "--help" => {
                print_help();
                return;
            }
            s if !s.starts_with('-') => path = Some(s.to_string()),
            other => {
                eprintln!("lithc: error: unknown option '{}'", other);
                exit(2);
            }
        }
        i += 1;
    }

    let path = match path {
        Some(p) => p,
        None => {
            eprintln!("lithc: error: no input file given\n");
            print_help();
            exit(2);
        }
    };

    let src = match std::fs::read_to_string(&path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("lithc: error: cannot read {}: {}", path, e);
            exit(2);
        }
    };

    let res = lithic_syntax::parse(&src);
    for d in &res.diagnostics {
        eprintln!("{}", d.render(&src, &path));
    }

    let errors = res.error_count();

    let contract = match res.contract {
        Some(c) => c,
        None => {
            eprintln!("lithc: error: no contract found in {}", path);
            exit(1);
        }
    };

    if errors > 0 {
        eprintln!("lithc: aborting due to {} error(s)", errors);
        exit(1);
    }

    let findings = lithic_syntax::check(&contract);
    for finding in &findings {
        eprintln!("{}", finding.render(&path));
    }
    let declaration_errors = lithic_syntax::sema::error_count(&findings);
    if declaration_errors > 0 {
        eprintln!(
            "lithc: aborting due to {} declaration error(s)",
            declaration_errors
        );
        exit(1);
    }

    match emit.as_str() {
        "check" => eprintln!("{}: declaration checks clean", path),
        "summary" => print!("{}", contract.summary()),
        "ast" => println!("{}", contract.to_json()),
        "abi" => println!("{}", contract.to_abi_json()),
        other => {
            eprintln!(
                "lithc: error: unknown emit kind '{}' (expected summary|ast|abi|check)",
                other
            );
            exit(2);
        }
    }
}
