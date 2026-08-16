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
        "lithc-{label}-{}-{nonce}.lithic",
        std::process::id()
    ));
    fs::write(&path, source).expect("write Lithic fixture");
    path
}

#[test]
fn check_mode_accepts_a_clean_contract() {
    let path = source_file("clean", "contract C { state { value: u256; } }");
    let output = Command::new(env!("CARGO_BIN_EXE_lithc"))
        .args(["--emit", "check"])
        .arg(&path)
        .output()
        .expect("run lithc");
    fs::remove_file(&path).expect("remove Lithic fixture");

    assert!(
        output.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(String::from_utf8_lossy(&output.stderr).contains("declaration checks clean"));
    assert!(output.stdout.is_empty());
}

#[test]
fn check_mode_rejects_an_unambiguous_name_collision() {
    let path = source_file(
        "duplicate",
        "contract C { state { value: u256; } state { value: bool; } }",
    );
    let output = Command::new(env!("CARGO_BIN_EXE_lithc"))
        .args(["--emit", "check"])
        .arg(&path)
        .output()
        .expect("run lithc");
    fs::remove_file(&path).expect("remove Lithic fixture");

    assert!(!output.status.success());
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        stderr.contains("[E002] duplicate state field `value`"),
        "stderr: {stderr}"
    );
    assert!(stderr.contains("aborting due to 1 declaration error(s)"));
}
