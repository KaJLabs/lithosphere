//! `lithdev` — safe local-devnet lifecycle and deployment preflight.

use lithic_syntax::Contract;
use std::path::{Path, PathBuf};
use std::process::{Command as ProcessCommand, ExitCode};

const COMPOSE_RELATIVE_PATH: &str = "Makalu/docker-compose.dev.yml";

#[derive(Debug, PartialEq, Eq)]
enum Command {
    Up {
        file: Option<PathBuf>,
        build: bool,
    },
    Down {
        file: Option<PathBuf>,
    },
    Status {
        file: Option<PathBuf>,
    },
    Logs {
        file: Option<PathBuf>,
        follow: bool,
        service: Option<String>,
    },
    Check {
        source: PathBuf,
    },
    Abi {
        source: PathBuf,
    },
    Deploy {
        source: PathBuf,
    },
    Help,
    Version,
}

fn print_help() {
    println!(
        "lithdev {} — safe local-devnet lifecycle and deployment preflight\n\
\n\
USAGE:\n\
    lithdev <COMMAND> [OPTIONS]\n\
\n\
COMMANDS:\n\
    up [--build] [--file PATH]       Start the local stack in the background\n\
    down [--file PATH]               Stop the stack and preserve all volumes\n\
    status [--file PATH]             Show stack services and ports\n\
    logs [SERVICE] [--follow] [--file PATH]\n\
                                     Show stack logs\n\
    check <FILE.lithic>              Run parser and declaration checks\n\
    abi <FILE.lithic>                Print declaration-derived ABI to stdout\n\
    deploy <FILE.lithic>             Validate, then fail closed before broadcast\n\
\n\
`deploy` cannot broadcast until `lithc` emits approved deployable bytecode.\n\
Volume deletion, signing, RPC submission, and receipt verification are not\n\
implemented in this v0 boundary.",
        env!("CARGO_PKG_VERSION")
    );
}

fn parse_compose_options(
    args: &[String],
    allow_build: bool,
    allow_logs: bool,
) -> Result<(Option<PathBuf>, bool, bool, Option<String>), String> {
    let mut file = None;
    let mut build = false;
    let mut follow = false;
    let mut service = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--file" => {
                if file.is_some() {
                    return Err("--file may be supplied only once".into());
                }
                index += 1;
                let value = args.get(index).ok_or("--file requires a path")?;
                file = Some(PathBuf::from(value));
            }
            "--build" if allow_build => {
                if build {
                    return Err("--build may be supplied only once".into());
                }
                build = true;
            }
            "--follow" | "-f" if allow_logs => {
                if follow {
                    return Err("--follow may be supplied only once".into());
                }
                follow = true;
            }
            value if allow_logs && !value.starts_with('-') => {
                if service.is_some() {
                    return Err("logs accepts at most one service name".into());
                }
                service = Some(value.to_string());
            }
            value => return Err(format!("unsupported option or argument `{value}`")),
        }
        index += 1;
    }

    Ok((file, build, follow, service))
}

fn one_source(command: &str, args: &[String]) -> Result<PathBuf, String> {
    match args {
        [source] => Ok(PathBuf::from(source)),
        [] => Err(format!("{command} requires exactly one <FILE.lithic>")),
        _ => Err(format!("{command} accepts exactly one <FILE.lithic>")),
    }
}

fn parse_args(args: &[String]) -> Result<Command, String> {
    let (name, rest) = args.split_first().ok_or("no command supplied")?;
    match name.as_str() {
        "-h" | "--help" => {
            if rest.is_empty() {
                Ok(Command::Help)
            } else {
                Err("--help does not accept arguments".into())
            }
        }
        "--version" => {
            if rest.is_empty() {
                Ok(Command::Version)
            } else {
                Err("--version does not accept arguments".into())
            }
        }
        "up" => {
            let (file, build, _, _) = parse_compose_options(rest, true, false)?;
            Ok(Command::Up { file, build })
        }
        "down" => {
            let (file, _, _, _) = parse_compose_options(rest, false, false)?;
            Ok(Command::Down { file })
        }
        "status" => {
            let (file, _, _, _) = parse_compose_options(rest, false, false)?;
            Ok(Command::Status { file })
        }
        "logs" => {
            let (file, _, follow, service) = parse_compose_options(rest, false, true)?;
            Ok(Command::Logs {
                file,
                follow,
                service,
            })
        }
        "check" => Ok(Command::Check {
            source: one_source("check", rest)?,
        }),
        "abi" => Ok(Command::Abi {
            source: one_source("abi", rest)?,
        }),
        "deploy" => Ok(Command::Deploy {
            source: one_source("deploy", rest)?,
        }),
        other => Err(format!("unknown command `{other}`")),
    }
}

fn find_compose_file() -> Result<PathBuf, String> {
    let mut directory = std::env::current_dir().map_err(|error| error.to_string())?;
    loop {
        let repo_candidate = directory.join(COMPOSE_RELATIVE_PATH);
        if repo_candidate.is_file() {
            return Ok(repo_candidate);
        }
        let makalu_candidate = directory.join("docker-compose.dev.yml");
        if directory.file_name().and_then(|name| name.to_str()) == Some("Makalu")
            && makalu_candidate.is_file()
        {
            return Ok(makalu_candidate);
        }
        if !directory.pop() {
            return Err(format!(
                "could not find {COMPOSE_RELATIVE_PATH}; run inside the repository or pass --file PATH"
            ));
        }
    }
}

fn resolve_compose_file(explicit: Option<PathBuf>) -> Result<PathBuf, String> {
    let path = match explicit {
        Some(path) => path,
        None => find_compose_file()?,
    };
    if !path.is_file() {
        return Err(format!("compose file does not exist: {}", path.display()));
    }
    std::fs::canonicalize(&path)
        .map_err(|error| format!("cannot resolve compose file {}: {error}", path.display()))
}

fn run_compose(file: &Path, args: &[&str]) -> Result<ExitCode, String> {
    let status = ProcessCommand::new("docker")
        .arg("compose")
        .arg("--file")
        .arg(file)
        .args(args)
        .status()
        .map_err(|error| format!("cannot run `docker compose`: {error}"))?;
    let code = status.code().unwrap_or(1);
    Ok(ExitCode::from(u8::try_from(code).unwrap_or(1)))
}

fn checked_contract(path: &Path) -> Result<Contract, u8> {
    let source = match std::fs::read_to_string(path) {
        Ok(source) => source,
        Err(error) => {
            eprintln!("lithdev: error: cannot read {}: {error}", path.display());
            return Err(2);
        }
    };
    let parsed = lithic_syntax::parse(&source);
    for diagnostic in &parsed.diagnostics {
        eprintln!(
            "{}",
            diagnostic.render(&source, path.to_string_lossy().as_ref())
        );
    }
    if parsed.error_count() > 0 {
        eprintln!(
            "lithdev: error: cannot inspect {} due to parse errors",
            path.display()
        );
        return Err(1);
    }
    let contract = match parsed.contract {
        Some(contract) => contract,
        None => {
            eprintln!("lithdev: error: no contract found in {}", path.display());
            return Err(1);
        }
    };
    let findings = lithic_syntax::check(&contract);
    for finding in &findings {
        eprintln!("{}", finding.render(path.to_string_lossy().as_ref()));
    }
    if lithic_syntax::sema::error_count(&findings) > 0 {
        eprintln!(
            "lithdev: error: declaration checks failed for {}",
            path.display()
        );
        return Err(1);
    }
    Ok(contract)
}

fn execute(command: Command) -> Result<ExitCode, String> {
    match command {
        Command::Help => {
            print_help();
            Ok(ExitCode::SUCCESS)
        }
        Command::Version => {
            println!("lithdev {}", env!("CARGO_PKG_VERSION"));
            Ok(ExitCode::SUCCESS)
        }
        Command::Up { file, build } => {
            let file = resolve_compose_file(file)?;
            let mut args = vec!["up", "--detach", "--remove-orphans"];
            if build {
                args.push("--build");
            }
            run_compose(&file, &args)
        }
        Command::Down { file } => {
            let file = resolve_compose_file(file)?;
            run_compose(&file, &["down", "--remove-orphans", "--timeout", "15"])
        }
        Command::Status { file } => {
            let file = resolve_compose_file(file)?;
            run_compose(&file, &["ps"])
        }
        Command::Logs {
            file,
            follow,
            service,
        } => {
            let file = resolve_compose_file(file)?;
            let mut args = vec!["logs", "--tail", "200"];
            if follow {
                args.push("--follow");
            }
            if let Some(service) = service.as_deref() {
                args.push(service);
            }
            run_compose(&file, &args)
        }
        Command::Check { source } => match checked_contract(&source) {
            Ok(_) => {
                eprintln!("{}: declaration checks clean", source.display());
                Ok(ExitCode::SUCCESS)
            }
            Err(code) => Ok(ExitCode::from(code)),
        },
        Command::Abi { source } => match checked_contract(&source) {
            Ok(contract) => {
                println!("{}", contract.to_abi_json());
                Ok(ExitCode::SUCCESS)
            }
            Err(code) => Ok(ExitCode::from(code)),
        },
        Command::Deploy { source } => match checked_contract(&source) {
            Ok(contract) => {
                eprintln!(
                    "lithdev: unavailable: `{}` passed declaration checks, but lithc emits no approved deployable bytecode; no file was written and no RPC request was sent",
                    contract.name
                );
                Ok(ExitCode::from(3))
            }
            Err(code) => Ok(ExitCode::from(code)),
        },
    }
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let command = match parse_args(&args) {
        Ok(command) => command,
        Err(error) => {
            eprintln!("lithdev: error: {error}");
            return ExitCode::from(2);
        }
    };
    match execute(command) {
        Ok(code) => code,
        Err(error) => {
            eprintln!("lithdev: error: {error}");
            ExitCode::from(2)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{parse_args, Command};
    use std::path::PathBuf;

    fn args(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn parses_non_destructive_down() {
        assert_eq!(
            parse_args(&args(&["down", "--file", "stack.yml"])),
            Ok(Command::Down {
                file: Some(PathBuf::from("stack.yml"))
            })
        );
    }

    #[test]
    fn rejects_volume_deletion_flag() {
        let error = parse_args(&args(&["down", "--volumes"])).expect_err("must reject");
        assert!(error.contains("unsupported option"));
    }

    #[test]
    fn rejects_extra_contract_paths() {
        let error =
            parse_args(&args(&["deploy", "one.lithic", "two.lithic"])).expect_err("must reject");
        assert!(error.contains("exactly one"));
    }

    #[test]
    fn parses_one_log_service_and_follow_mode() {
        assert_eq!(
            parse_args(&args(&["logs", "api", "--follow"])),
            Ok(Command::Logs {
                file: None,
                follow: true,
                service: Some("api".into())
            })
        );
    }
}
