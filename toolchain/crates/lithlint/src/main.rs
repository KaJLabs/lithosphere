//! `lithlint` — the Lithic linter and static analyzer.
//!
//! v0 ships a handful of real, AST-driven rules:
//!   * L001 contract names should be UpperCamelCase
//!   * L002 function names should be snake_case
//!   * L003 const names should be SCREAMING_SNAKE_CASE
//!   * L004 `pub async fn` (which can call the AI primitive) should declare an
//!          `@ai_budget` to bound its cost
//!
//! Findings are warnings by default; pass `--deny-warnings` to exit non-zero.

use lithic_syntax::Contract;
use std::process::exit;

fn print_help() {
    eprintln!(
        "lithlint {} — Lithic linter (v0)\n\
\n\
USAGE:\n\
    lithlint [OPTIONS] <FILE.lithic>\n\
\n\
OPTIONS:\n\
    --deny-warnings  Exit with code 1 if any finding is reported\n\
    -h, --help       Print this help",
        env!("CARGO_PKG_VERSION")
    );
}

fn is_upper_camel(s: &str) -> bool {
    !s.is_empty() && s.chars().next().map(|c| c.is_ascii_uppercase()).unwrap_or(false) && !s.contains('_')
}

fn is_snake(s: &str) -> bool {
    !s.is_empty() && s.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
}

fn is_screaming_snake(s: &str) -> bool {
    !s.is_empty() && s.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || c == '_')
}

fn lint(c: &Contract) -> Vec<String> {
    let mut findings = Vec::new();

    if !is_upper_camel(&c.name) {
        findings.push(format!("L001 contract `{}` should be UpperCamelCase", c.name));
    }
    for cst in c.consts() {
        if !is_screaming_snake(&cst.name) {
            findings.push(format!("L003 const `{}` should be SCREAMING_SNAKE_CASE", cst.name));
        }
    }
    for f in c.funcs() {
        if !is_snake(&f.name) {
            findings.push(format!("L002 function `{}` should be snake_case", f.name));
        }
        if f.is_pub && f.is_async && !f.has_attr("ai_budget") {
            findings.push(format!(
                "L004 `pub async fn {}` may invoke the AI primitive; add @ai_budget to bound its cost",
                f.name
            ));
        }
    }

    findings
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let mut path: Option<String> = None;
    let mut deny = false;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--deny-warnings" => deny = true,
            "-h" | "--help" => {
                print_help();
                return;
            }
            s if !s.starts_with('-') => path = Some(s.to_string()),
            other => {
                eprintln!("lithlint: error: unknown option '{}'", other);
                exit(2);
            }
        }
        i += 1;
    }

    let path = match path {
        Some(p) => p,
        None => {
            eprintln!("lithlint: error: no input file given\n");
            print_help();
            exit(2);
        }
    };

    let src = match std::fs::read_to_string(&path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("lithlint: error: cannot read {}: {}", path, e);
            exit(2);
        }
    };

    let res = lithic_syntax::parse(&src);
    for d in &res.diagnostics {
        eprintln!("{}", d.render(&src, &path));
    }
    if res.error_count() > 0 {
        eprintln!("lithlint: error: cannot lint {} due to parse errors", path);
        exit(1);
    }

    let contract = match res.contract {
        Some(c) => c,
        None => {
            eprintln!("lithlint: error: no contract found in {}", path);
            exit(1);
        }
    };

    let findings = lint(&contract);
    for f in &findings {
        println!("{}: warning: {}", path, f);
    }

    if findings.is_empty() {
        println!("{}: clean (0 findings)", path);
    } else {
        println!("lithlint: {} finding(s)", findings.len());
        if deny {
            exit(1);
        }
    }
}
