//! `lithfmt` — the Lithic formatter.
//!
//! v0 performs *safe* whitespace normalisation only — it never rewrites code
//! structure, so it cannot corrupt a contract:
//!   * tabs are expanded to four spaces,
//!   * trailing whitespace is stripped from every line,
//!   * the file is terminated by exactly one newline.
//!
//! The input is parsed first; a file with parse errors is left untouched.
//! Full AST-driven formatting (canonical indentation, alignment) is a later
//! phase.

use std::process::exit;

fn print_help() {
    eprintln!(
        "lithfmt {} — Lithic formatter (v0: whitespace normalisation)\n\
\n\
USAGE:\n\
    lithfmt [OPTIONS] <FILE.lithic>\n\
\n\
OPTIONS:\n\
    --check     Do not write; exit 1 if the file is not already formatted\n\
    -h, --help  Print this help",
        env!("CARGO_PKG_VERSION")
    );
}

fn format_source(src: &str) -> String {
    let mut out = String::with_capacity(src.len());
    for line in src.lines() {
        let expanded = line.replace('\t', "    ");
        out.push_str(expanded.trim_end());
        out.push('\n');
    }
    // Collapse to exactly one trailing newline (handles empty input too).
    while out.ends_with("\n\n") {
        out.pop();
    }
    if out.is_empty() {
        out.push('\n');
    }
    out
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let mut path: Option<String> = None;
    let mut check = false;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--check" => check = true,
            "-h" | "--help" => {
                print_help();
                return;
            }
            s if !s.starts_with('-') => path = Some(s.to_string()),
            other => {
                eprintln!("lithfmt: error: unknown option '{}'", other);
                exit(2);
            }
        }
        i += 1;
    }

    let path = match path {
        Some(p) => p,
        None => {
            eprintln!("lithfmt: error: no input file given\n");
            print_help();
            exit(2);
        }
    };

    let src = match std::fs::read_to_string(&path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("lithfmt: error: cannot read {}: {}", path, e);
            exit(2);
        }
    };

    // Refuse to format invalid source.
    let res = lithic_syntax::parse(&src);
    if res.error_count() > 0 {
        for d in &res.diagnostics {
            eprintln!("{}", d.render(&src, &path));
        }
        eprintln!("lithfmt: error: not formatting {} due to parse errors", path);
        exit(1);
    }

    let formatted = format_source(&src);

    if check {
        if formatted != src {
            eprintln!("lithfmt: {} is not formatted", path);
            exit(1);
        }
        return;
    }

    if formatted != src {
        if let Err(e) = std::fs::write(&path, formatted) {
            eprintln!("lithfmt: error: cannot write {}: {}", path, e);
            exit(2);
        }
        eprintln!("lithfmt: formatted {}", path);
    }
}
