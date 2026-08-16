# Reviewed examples

`hello.lithic` exercises only the currently reviewed declaration front-end. CI
parses and checks it with `lithc --emit check`; this does not generate bytecode
or deploy a contract.

Test-runner and package-manifest examples are intentionally excluded while
`lithtest` and `lithpkg` remain specification-only.
