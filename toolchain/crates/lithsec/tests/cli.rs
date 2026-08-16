use std::process::Command;

#[test]
fn reports_the_package_version() {
    let output = Command::new(env!("CARGO_BIN_EXE_lithsec"))
        .arg("--version")
        .output()
        .expect("run lithsec");

    assert!(output.status.success());
    assert_eq!(String::from_utf8_lossy(&output.stdout), "lithsec 0.0.1\n");
    assert!(output.stderr.is_empty());
}

#[test]
fn scan_mode_fails_instead_of_reporting_unreviewed_security_results() {
    let output = Command::new(env!("CARGO_BIN_EXE_lithsec"))
        .arg("--scan")
        .output()
        .expect("run lithsec");

    assert_eq!(output.status.code(), Some(3));
    assert!(output.stdout.is_empty());
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        stderr.contains("no security scan is performed"),
        "stderr: {stderr}"
    );
}

#[test]
fn source_paths_are_rejected_until_rules_are_approved() {
    let output = Command::new(env!("CARGO_BIN_EXE_lithsec"))
        .arg("contract.lithic")
        .output()
        .expect("run lithsec");

    assert_eq!(output.status.code(), Some(2));
    assert!(String::from_utf8_lossy(&output.stderr).contains("unsupported arguments"));
}
