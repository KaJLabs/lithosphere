const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const expectedContractHashes = {
  "LithoCCIPResolver.sol":
    "bd90e5324be1ea03ced78a7b3b3a333254a398b8215287429519e15ffe3eabd5",
  "LithoRegistrarController.sol":
    "2da904075ba554d37c70d74fe64d6bdb374e703c5b24c64ef889a3b6fc4f621f",
  "LithoStablePriceOracle.sol":
    "b5be05e049218b3cf5e5e35387e68b846bebc60193fa5b5026e736f7506e4be9",
  "ZeroPriceOracle.sol":
    "9dad2959729eb9c642076ca72cb16f17c068758746f7d14b053207c539b7839d",
};
const forbiddenFiles = [
  "BNB_CCIP_DEPLOY_CHECKLIST.md",
  "scripts/09-redeploy-controller-permanent.js",
  "scripts/09-sweep-names-permanent.js",
];
const forbiddenPatterns = [
  /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
  /aws\s+secretsmanager/i,
  /--secret-id/i,
  /kamet-val/i,
  /D:[/\\]Playground/i,
  /GATEWAY_PRIVATE_KEY/,
  /REGISTRY_DEPLOYER_PRIVATE_KEY/,
  /(?<!DNNS_)\bDEPLOYER_PRIVATE_KEY\b/,
];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (["node_modules", "artifacts", "cache"].includes(entry.name)) return [];
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

for (const relative of forbiddenFiles) {
  if (fs.existsSync(path.join(root, relative))) {
    throw new Error(`Restricted operational file is present: ${relative}`);
  }
}

for (const absolute of walk(root)) {
  if (absolute.endsWith("package-lock.json")) continue;
  const relative = path.relative(root, absolute).replaceAll("\\", "/");
  if (relative === "scripts/verify-public-boundary.js") continue;
  const content = fs.readFileSync(absolute, "utf8");
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(content))
      throw new Error(`Forbidden public-boundary value in ${relative}`);
  }
}

for (const [file, expectedHash] of Object.entries(expectedContractHashes)) {
  const content = fs
    .readFileSync(path.join(root, "contracts", file), "utf8")
    .replaceAll("\r\n", "\n");
  const actualHash = crypto.createHash("sha256").update(content).digest("hex");
  if (actualHash !== expectedHash)
    throw new Error(`Unexpected deployed-source change in ${file}`);
}

console.log("DNNS public boundary and deployed-source hashes verified");
