const crypto = require("crypto");
const fs = require("fs");
const { ethers } = require("ethers");

const CANDIDATE = Object.freeze({
  tag: "multx-audit-candidate-v0.5.0-20260809",
  commit: "620e300bce9c7d967ace6a778ba7ee84e79e5d86",
  multXBridgeRuntimeSha256: "6bfdb3d2c8e7ae5f26169ac8c1b982c86eded4dda74a1940cbb3e88093b11cfc",
});

const NETWORKS = Object.freeze({
  kamet: { chainId: 900523, hardhatNetwork: "litho_kamet" },
  makalu: { chainId: 700777, hardhatNetwork: "litho_makalu" },
});

const fail = (message) => {
  throw new Error(message);
};

const requiredText = (value, field) => {
  if (typeof value !== "string" || !value.trim() || /[<>]/.test(value)) {
    fail(`${field} must be an approved non-placeholder value`);
  }
  return value.trim();
};

const utcTimestamp = (value, field) => {
  const normalized = requiredText(value, field);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(normalized) || Number.isNaN(Date.parse(normalized))) {
    fail(`${field} must be an exact UTC timestamp (YYYY-MM-DDTHH:MM:SSZ)`);
  }
  return normalized;
};

const assertWithinChangeWindow = (approval, now = Date.now()) => {
  const start = Date.parse(approval.changeWindowStartUtc);
  const end = Date.parse(approval.changeWindowEndUtc);
  if (!Number.isFinite(now) || now < start || now > end) {
    fail("execution is outside the approved UTC change window");
  }
};

const address = (value, field) => {
  requiredText(value, field);
  let normalized;
  try {
    normalized = ethers.utils.getAddress(value);
  } catch {
    fail(`${field} must be a valid EVM address`);
  }
  if (normalized === ethers.constants.AddressZero) fail(`${field} cannot be the zero address`);
  return normalized;
};

const positiveIntegerString = (value, field) => {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) {
    fail(`${field} must be a positive base-unit integer string`);
  }
  return value;
};

const sha256Hex = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

const loadManifest = (manifestPath) => {
  if (!manifestPath) fail("MULTX_DEPLOYMENT_MANIFEST is required");
  const raw = fs.readFileSync(manifestPath);
  let manifest;
  try {
    manifest = JSON.parse(raw.toString("utf8"));
  } catch (error) {
    fail(`manifest is not valid JSON: ${error.message}`);
  }
  return { manifest, manifestSha256: sha256Hex(raw) };
};

const validateManifest = (manifest, networkKey) => {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) fail("manifest must be an object");
  if (manifest.schemaVersion !== 1) fail("schemaVersion must be 1");

  for (const [field, expected] of Object.entries(CANDIDATE)) {
    if (!manifest.candidate || manifest.candidate[field] !== expected) {
      fail(`candidate.${field} must equal the immutable v0.5 candidate value`);
    }
  }

  const approval = manifest.approval || {};
  const normalizedApproval = {
    record: requiredText(approval.record, "approval.record"),
    changeWindowStartUtc: utcTimestamp(approval.changeWindowStartUtc, "approval.changeWindowStartUtc"),
    changeWindowEndUtc: utcTimestamp(approval.changeWindowEndUtc, "approval.changeWindowEndUtc"),
    rollbackOwner: requiredText(approval.rollbackOwner, "approval.rollbackOwner"),
  };
  if (Date.parse(normalizedApproval.changeWindowEndUtc) <= Date.parse(normalizedApproval.changeWindowStartUtc)) {
    fail("approval.changeWindowEndUtc must be after approval.changeWindowStartUtc");
  }

  const set = manifest.validatorSet || {};
  if (!Array.isArray(set.validators) || set.validators.length !== 7) {
    fail("validatorSet.validators must contain exactly seven approved addresses");
  }
  if (set.signaturesRequired !== 5) fail("validatorSet.signaturesRequired must be 5");
  const validators = set.validators.map((value, index) => address(value, `validatorSet.validators[${index}]`));
  if (new Set(validators.map((value) => value.toLowerCase())).size !== validators.length) {
    fail("validatorSet.validators must be unique");
  }

  const expectedNetwork = NETWORKS[networkKey];
  if (!expectedNetwork) fail("MULTX_NETWORK_KEY must be kamet or makalu");
  const input = manifest.networks && manifest.networks[networkKey];
  if (!input || typeof input !== "object") fail(`networks.${networkKey} is required`);
  if (input.chainId !== expectedNetwork.chainId) fail(`networks.${networkKey}.chainId must be ${expectedNetwork.chainId}`);
  if (input.hardhatNetwork !== expectedNetwork.hardhatNetwork) {
    fail(`networks.${networkKey}.hardhatNetwork must be ${expectedNetwork.hardhatNetwork}`);
  }

  const expectedDeployer = address(input.expectedDeployer, `networks.${networkKey}.expectedDeployer`);
  const governanceOwner = address(input.governanceOwner, `networks.${networkKey}.governanceOwner`);
  const pauseGuardian = address(input.pauseGuardian, `networks.${networkKey}.pauseGuardian`);
  if (governanceOwner === pauseGuardian) fail("governanceOwner and pauseGuardian must be independent addresses");
  const roleAddresses = new Set([expectedDeployer, governanceOwner, pauseGuardian].map((value) => value.toLowerCase()));
  if (roleAddresses.size !== 3) fail("expectedDeployer, governanceOwner, and pauseGuardian must be independent addresses");
  if (validators.some((value) => roleAddresses.has(value.toLowerCase()))) {
    fail("bridge validators must be independent from deployer and governance roles");
  }

  if (!Array.isArray(input.tokens) || input.tokens.length === 0) {
    fail(`networks.${networkKey}.tokens must contain at least one approved token`);
  }
  const symbols = new Set();
  const tokenAddresses = new Set();
  const tokens = input.tokens.map((token, index) => {
    if (!token || typeof token !== "object") fail(`tokens[${index}] must be an object`);
    const symbol = requiredText(token.symbol, `tokens[${index}].symbol`);
    if (!/^[A-Za-z0-9]{2,12}$/.test(symbol)) fail(`tokens[${index}].symbol is invalid`);
    const tokenAddress = address(token.address, `tokens[${index}].address`);
    const dailyCapBaseUnits = positiveIntegerString(token.dailyCapBaseUnits, `tokens[${index}].dailyCapBaseUnits`);
    if (symbols.has(symbol.toUpperCase())) fail(`duplicate token symbol: ${symbol}`);
    if (tokenAddresses.has(tokenAddress.toLowerCase())) fail(`duplicate token address: ${tokenAddress}`);
    symbols.add(symbol.toUpperCase());
    tokenAddresses.add(tokenAddress.toLowerCase());
    return { symbol, address: tokenAddress, dailyCapBaseUnits };
  });

  return {
    candidate: CANDIDATE,
    approval: normalizedApproval,
    validatorSet: { validators, signaturesRequired: 5 },
    network: {
      key: networkKey,
      chainId: expectedNetwork.chainId,
      hardhatNetwork: expectedNetwork.hardhatNetwork,
      expectedDeployer,
      governanceOwner,
      pauseGuardian,
      tokens,
    },
  };
};

module.exports = {
  CANDIDATE,
  NETWORKS,
  assertWithinChangeWindow,
  loadManifest,
  sha256Hex,
  validateManifest,
};
