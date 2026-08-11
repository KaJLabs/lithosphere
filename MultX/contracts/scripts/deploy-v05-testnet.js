/**
 * Preflight or execute a paused MultX v0.5 testnet deployment from an approved
 * public manifest. Private keys are read only from a protected local file.
 *
 * Preflight:
 *   MULTX_DEPLOYMENT_MANIFEST=... MULTX_NETWORK_KEY=kamet \
 *   npx hardhat run scripts/deploy-v05-testnet.js --network litho_kamet
 *
 * Execution additionally requires:
 *   MULTX_EXECUTE=true
 *   DEPLOYER_PRIVATE_KEY_FILE=/protected/path/deployer.key
 *   APPROVED_MANIFEST_SHA256=<sha256>
 *   APPROVED_CHANGE_RECORD=<exact manifest approval.record>
 */

const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { CANDIDATE, loadManifest, sha256Hex, validateManifest } = require("./v05-testnet-manifest");

const waitFor = async (label, transaction) => {
  const receipt = await transaction.wait();
  if (receipt.status !== 1) throw new Error(`${label} transaction failed`);
  console.log(`${label}: ${transaction.hash} (block ${receipt.blockNumber})`);
  return { hash: transaction.hash, blockNumber: receipt.blockNumber };
};

const artifactRuntime = async () => {
  const artifact = await hre.artifacts.readArtifact("MultXBridge");
  const bytes = Buffer.from(artifact.deployedBytecode.slice(2), "hex");
  const sha256 = sha256Hex(bytes);
  if (sha256 !== CANDIDATE.multXBridgeRuntimeSha256) {
    throw new Error(`compiled MultXBridge runtime SHA-256 ${sha256} does not match candidate evidence`);
  }
  return { artifact, sha256, bytes: bytes.length };
};

const verifyTokens = async (provider, tokens) => {
  const abi = ["function symbol() view returns (string)"];
  for (const token of tokens) {
    const code = await provider.getCode(token.address);
    if (code === "0x") throw new Error(`${token.symbol} has no contract code at ${token.address}`);
    const contract = new hre.ethers.Contract(token.address, abi, provider);
    const onChainSymbol = await contract.symbol();
    if (onChainSymbol.toUpperCase() !== token.symbol.toUpperCase()) {
      throw new Error(`${token.address} reports symbol ${onChainSymbol}, expected ${token.symbol}`);
    }
  }
};

const readPrivateKey = (filePath) => {
  if (!filePath) throw new Error("DEPLOYER_PRIVATE_KEY_FILE is required for execution");
  const stat = fs.statSync(filePath);
  if (process.platform !== "win32" && (stat.mode & 0o077) !== 0) {
    throw new Error("DEPLOYER_PRIVATE_KEY_FILE must not be group/world accessible");
  }
  const value = fs.readFileSync(filePath, "utf8").trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error("deployer key file must contain one hex private key");
  return value;
};

async function main() {
  if (process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("unset DEPLOYER_PRIVATE_KEY; execution accepts DEPLOYER_PRIVATE_KEY_FILE only");
  }
  const networkKey = process.env.MULTX_NETWORK_KEY;
  const { manifest, manifestSha256 } = loadManifest(process.env.MULTX_DEPLOYMENT_MANIFEST);
  const config = validateManifest(manifest, networkKey);
  const runtime = await artifactRuntime();
  const provider = hre.ethers.provider;
  const liveNetwork = await provider.getNetwork();

  if (hre.network.name !== config.network.hardhatNetwork) {
    throw new Error(`Hardhat network ${hre.network.name} does not match manifest ${config.network.hardhatNetwork}`);
  }
  if (liveNetwork.chainId !== config.network.chainId) {
    throw new Error(`RPC chain ID ${liveNetwork.chainId} does not match manifest ${config.network.chainId}`);
  }
  await verifyTokens(provider, config.network.tokens);

  const preflight = {
    mode: process.env.MULTX_EXECUTE === "true" ? "execute" : "preflight",
    manifestSha256,
    network: config.network.key,
    chainId: config.network.chainId,
    candidate: config.candidate,
    runtimeBytes: runtime.bytes,
    validators: config.validatorSet.validators.length,
    signaturesRequired: config.validatorSet.signaturesRequired,
    supportedTokens: config.network.tokens.map(({ symbol, address, dailyCapBaseUnits }) => ({ symbol, address, dailyCapBaseUnits })),
  };
  console.log(JSON.stringify(preflight, null, 2));

  if (process.env.MULTX_EXECUTE !== "true") {
    console.log("Preflight passed. No transaction was signed or submitted.");
    return;
  }

  if (process.env.APPROVED_MANIFEST_SHA256 !== manifestSha256) {
    throw new Error("APPROVED_MANIFEST_SHA256 does not match the exact manifest file");
  }
  if (process.env.APPROVED_CHANGE_RECORD !== config.approval.record) {
    throw new Error("APPROVED_CHANGE_RECORD must exactly match approval.record");
  }

  const wallet = new hre.ethers.Wallet(readPrivateKey(process.env.DEPLOYER_PRIVATE_KEY_FILE), provider);
  if (wallet.address !== config.network.expectedDeployer) {
    throw new Error(`deployer ${wallet.address} does not match expectedDeployer ${config.network.expectedDeployer}`);
  }
  if ((await wallet.getBalance()).isZero()) throw new Error("approved deployer has zero balance");

  const factory = new hre.ethers.ContractFactory(runtime.artifact.abi, runtime.artifact.bytecode, wallet);
  const bridge = await factory.deploy(
    config.validatorSet.validators,
    config.validatorSet.signaturesRequired,
    { gasLimit: 7_000_000 }
  );
  const deployment = await waitFor("deploy", bridge.deployTransaction);
  const transactions = { deployment };

  transactions.pause = await waitFor("pause", await bridge.pause());
  transactions.pauseGuardian = await waitFor(
    "setPauseGuardian",
    await bridge.setPauseGuardian(config.network.pauseGuardian)
  );
  transactions.tokens = [];
  for (const token of config.network.tokens) {
    const support = await waitFor(`addSupportedToken ${token.symbol}`, await bridge.addSupportedToken(token.address));
    const cap = await waitFor(
      `setDailyCap ${token.symbol}`,
      await bridge.setDailyCap(token.address, token.dailyCapBaseUnits)
    );
    transactions.tokens.push({ symbol: token.symbol, support, cap });
  }
  if (wallet.address !== config.network.governanceOwner) {
    transactions.transferOwnership = await waitFor(
      "transferOwnership",
      await bridge.transferOwnership(config.network.governanceOwner)
    );
  }

  const deployedCode = await provider.getCode(bridge.address);
  const deployedRuntimeSha256 = sha256Hex(Buffer.from(deployedCode.slice(2), "hex"));
  if (deployedRuntimeSha256 !== CANDIDATE.multXBridgeRuntimeSha256) {
    throw new Error("deployed runtime bytecode does not match the approved candidate");
  }
  const [paused, owner, guardian, validators, threshold] = await Promise.all([
    bridge.paused(),
    bridge.owner(),
    bridge.pauseGuardian(),
    bridge.getValidators(),
    bridge.signaturesRequired(),
  ]);
  if (!paused) throw new Error("deployed bridge is not paused");
  if (owner !== config.network.governanceOwner) throw new Error("deployed owner mismatch");
  if (guardian !== config.network.pauseGuardian) throw new Error("deployed pause guardian mismatch");
  if (threshold.toNumber() !== config.validatorSet.signaturesRequired) throw new Error("deployed threshold mismatch");
  if (validators.map((v) => v.toLowerCase()).join(",") !== config.validatorSet.validators.map((v) => v.toLowerCase()).join(",")) {
    throw new Error("deployed validator set mismatch");
  }
  for (const token of config.network.tokens) {
    if (!(await bridge.supportedTokens(token.address))) throw new Error(`${token.symbol} is not supported after deployment`);
    if (!(await bridge.dailyCap(token.address)).eq(token.dailyCapBaseUnits)) throw new Error(`${token.symbol} daily cap mismatch`);
  }

  const record = {
    schemaVersion: 1,
    generatedAtUtc: new Date().toISOString(),
    candidate: config.candidate,
    approval: config.approval,
    approvedManifestSha256: manifestSha256,
    network: config.network.key,
    chainId: config.network.chainId,
    bridge: bridge.address,
    deployer: wallet.address,
    governanceOwner: owner,
    pauseGuardian: guardian,
    paused,
    validators,
    signaturesRequired: threshold.toNumber(),
    tokens: config.network.tokens,
    runtimeSha256: deployedRuntimeSha256,
    transactions,
  };
  const defaultOutput = path.resolve(
    __dirname,
    "../deployments",
    `${config.network.key}-v05-${Date.now()}.json`
  );
  const output = path.resolve(process.env.MULTX_DEPLOYMENT_OUTPUT || defaultOutput);
  fs.writeFileSync(output, `${JSON.stringify(record, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  console.log(`Deployment verified and recorded at ${output}`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
