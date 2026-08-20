const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const lock = JSON.parse(
  fs.readFileSync(path.join(root, "package-lock.json"), "utf8"),
);
const expected = {
  version: "1.4.0",
  resolved:
    "https://registry.npmjs.org/@ensdomains/ens-contracts/-/ens-contracts-1.4.0.tgz",
  integrity:
    "sha512-h10r9igVCycW8vvkEcNageOtXLJss5k3cb5jQUeLFSppp4VE3aXhwI+UapsqxKwDxSit2XxzAD9Zbwbhj2q4Fw==",
};

if (packageJson.dependencies?.["@ensdomains/ens-contracts"]) {
  throw new Error(
    "@ensdomains/ens-contracts must remain a build-only devDependency",
  );
}
if (
  packageJson.devDependencies?.["@ensdomains/ens-contracts"] !==
  expected.version
) {
  throw new Error(
    `@ensdomains/ens-contracts must remain pinned to ${expected.version}`,
  );
}

const installed = lock.packages?.["node_modules/@ensdomains/ens-contracts"];
for (const field of ["version", "resolved", "integrity"]) {
  if (installed?.[field] !== expected[field]) {
    throw new Error(
      `Unexpected @ensdomains/ens-contracts ${field} in package-lock.json`,
    );
  }
}

console.log("DNNS ENS build dependency pin verified");
