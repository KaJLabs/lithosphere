use std::process::Command;

#[test]
fn reports_the_package_version() {
    let output = Command::new(env!("CARGO_BIN_EXE_lithtest"))
        .arg("--version")
        .output()
        .expect("run lithtest");

    assert!(output.status.success());
    assert_eq!(String::from_utf8_lossy(&output.stdout), "lithtest 0.0.1\n");
    assert!(output.stderr.is_empty());
}

#[test]
fn run_mode_fails_instead_of_reporting_fake_test_results() {
    let output = Command::new(env!("CARGO_BIN_EXE_lithtest"))
        .arg("--run")
        .output()
        .expect("run lithtest");

    assert_eq!(output.status.code(), Some(3));
    assert!(output.stdout.is_empty());
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        stderr.contains("no Lithic tests are executed"),
        "stderr: {stderr}"
    );
}

#[test]
fn source_paths_are_rejected_until_test_syntax_is_approved() {
    let output = Command::new(env!("CARGO_BIN_EXE_lithtest"))
        .arg("sample.lithic")
        .output()
        .expect("run lithtest");

    assert_eq!(output.status.code(), Some(2));
    assert!(String::from_utf8_lossy(&output.stderr).contains("unsupported arguments"));
}
