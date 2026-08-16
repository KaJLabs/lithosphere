use std::process::Command;

#[test]
fn reports_the_package_version() {
    let output = Command::new(env!("CARGO_BIN_EXE_lithls"))
        .arg("--version")
        .output()
        .expect("run lithls");

    assert!(output.status.success());
    assert_eq!(String::from_utf8_lossy(&output.stdout), "lithls 0.0.1\n");
    assert!(output.stderr.is_empty());
}

#[test]
fn stdio_mode_fails_explicitly_instead_of_claiming_lsp_support() {
    let output = Command::new(env!("CARGO_BIN_EXE_lithls"))
        .arg("--stdio")
        .output()
        .expect("run lithls");

    assert_eq!(output.status.code(), Some(3));
    assert!(output.stdout.is_empty());
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(stderr.contains("specification-only"), "stderr: {stderr}");
}

#[test]
fn unsupported_arguments_are_rejected() {
    let output = Command::new(env!("CARGO_BIN_EXE_lithls"))
        .arg("--serve")
        .output()
        .expect("run lithls");

    assert_eq!(output.status.code(), Some(2));
    assert!(String::from_utf8_lossy(&output.stderr).contains("unsupported arguments"));
}
