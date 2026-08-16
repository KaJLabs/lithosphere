use std::process::Command;

#[test]
fn reports_the_package_version() {
    let output = Command::new(env!("CARGO_BIN_EXE_lithpkg"))
        .arg("--version")
        .output()
        .expect("run lithpkg");

    assert!(output.status.success());
    assert_eq!(String::from_utf8_lossy(&output.stdout), "lithpkg 0.0.1\n");
    assert!(output.stderr.is_empty());
}

#[test]
fn resolve_mode_fails_instead_of_writing_an_untrusted_lockfile() {
    let output = Command::new(env!("CARGO_BIN_EXE_lithpkg"))
        .arg("--resolve")
        .output()
        .expect("run lithpkg");

    assert_eq!(output.status.code(), Some(3));
    assert!(output.stdout.is_empty());
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        stderr.contains("no package operation is performed"),
        "stderr: {stderr}"
    );
}

#[test]
fn manifest_paths_are_rejected_until_the_format_is_approved() {
    let output = Command::new(env!("CARGO_BIN_EXE_lithpkg"))
        .arg("lithpkg.toml")
        .output()
        .expect("run lithpkg");

    assert_eq!(output.status.code(), Some(2));
    assert!(String::from_utf8_lossy(&output.stderr).contains("unsupported arguments"));
}
