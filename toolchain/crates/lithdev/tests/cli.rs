use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

fn source_file(label: &str, source: &str) -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock")
        .as_nanos();
    let path = std::env::temp_dir().join(format!(
        "lithdev-{label}-{}-{nonce}.lithic",
        std::process::id()
    ));
    fs::write(&path, source).expect("write Lithic fixture");
    path
}

#[test]
fn check_reports_conservative_declaration_checks() {
    let source = source_file("check", "contract Token { state { value: u256; } }");
    let output = Command::new(env!("CARGO_BIN_EXE_lithdev"))
        .arg("check")
        .arg(&source)
        .output()
        .expect("run lithdev");
    fs::remove_file(&source).expect("remove Lithic fixture");

    assert!(output.status.success());
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        stderr.contains("declaration checks clean"),
        "stderr: {stderr}"
    );
    assert!(!stderr.contains("type-check"), "stderr: {stderr}");
}

#[test]
fn abi_writes_only_to_stdout() {
    let source = source_file("abi", "contract Token { pub fn balance() -> u256 {} }");
    let output_path = source.with_extension("abi.json");
    let output = Command::new(env!("CARGO_BIN_EXE_lithdev"))
        .arg("abi")
        .arg(&source)
        .output()
        .expect("run lithdev");
    fs::remove_file(&source).expect("remove Lithic fixture");

    assert!(output.status.success());
    assert!(String::from_utf8_lossy(&output.stdout).contains("balance"));
    assert!(!output_path.exists(), "ABI command must not create a file");
}

#[test]
fn deploy_fails_closed_without_writing_or_contacting_rpc() {
    let source = source_file("deploy", "contract Token {}");
    let output_path = source.with_extension("abi.json");
    let output = Command::new(env!("CARGO_BIN_EXE_lithdev"))
        .arg("deploy")
        .arg(&source)
        .output()
        .expect("run lithdev");
    fs::remove_file(&source).expect("remove Lithic fixture");

    assert_eq!(output.status.code(), Some(3));
    assert!(output.stdout.is_empty());
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(stderr.contains("no file was written"), "stderr: {stderr}");
    assert!(
        stderr.contains("no RPC request was sent"),
        "stderr: {stderr}"
    );
    assert!(
        !output_path.exists(),
        "deploy preflight must not create ABI"
    );
}

#[test]
fn volume_deletion_is_rejected_before_docker_is_invoked() {
    let output = Command::new(env!("CARGO_BIN_EXE_lithdev"))
        .args(["down", "--volumes"])
        .output()
        .expect("run lithdev");

    assert_eq!(output.status.code(), Some(2));
    assert!(String::from_utf8_lossy(&output.stderr).contains("unsupported option"));
}
