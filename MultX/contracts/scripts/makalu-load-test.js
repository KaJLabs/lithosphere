#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function usage() {
  console.log(`
Makalu EVM load generator

Usage:
  node scripts/makalu-load-test.js [options]

Options:
  --rpc-url <url>              EVM RPC endpoint
  --chain-id <id>              Chain ID (default: 700777)
  --wallet-file <path>         JSON wallet file from makalu-fund-load-wallets.js
  --duration <seconds>         Send window (default: 120)
  --target-tps <n>             Intended send rate across all wallets (default: 25)
  --max-pending <n>            Max in-flight txs per wallet (default: 32)
  --confirm-timeout <seconds>  Receipt wait timeout (default: 180)
  --drain-timeout <seconds>    Max post-send receipt drain time (default: 60)
  --gas-limit <n>              Gas limit per tx (default: 21000)
  --gas-price-gwei <n>         Override gas price
  --value-wei <n>              Tx value in wei (default: 0)
  --recipient-mode <mode>      fixed | self | pool (default: pool)
  --recipient <address>        Fixed recipient address
  --recipient-pool-size <n>    Pool size for pool mode (default: 1000)
  --results-dir <path>         Output dir (default: ../docs/load-test-results)
  --start-signal-file <path>   Write JSON marker when the send window starts
  --label <text>               Optional run label
  --dry-run                    Validate config and inspect chain only
  --help                       Show this help

Environment:
  MAKALU_LOAD_TEST_RPC_URL
  MAKALU_LOAD_TEST_CHAIN_ID
  MAKALU_LOAD_TEST_WALLET_FILE
  MAKALU_LOAD_TEST_PRIVATE_KEYS   Comma-separated funded EVM private keys
  MAKALU_LOAD_TEST_DURATION
  MAKALU_LOAD_TEST_TARGET_TPS
  MAKALU_LOAD_TEST_MAX_PENDING
  MAKALU_LOAD_TEST_CONFIRM_TIMEOUT
  MAKALU_LOAD_TEST_DRAIN_TIMEOUT
  MAKALU_LOAD_TEST_GAS_LIMIT
  MAKALU_LOAD_TEST_GAS_PRICE_GWEI
  MAKALU_LOAD_TEST_VALUE_WEI
  MAKALU_LOAD_TEST_RECIPIENT_MODE
  MAKALU_LOAD_TEST_RECIPIENT
  MAKALU_LOAD_TEST_RECIPIENT_POOL_SIZE
  MAKALU_LOAD_TEST_RESULTS_DIR
  MAKALU_LOAD_TEST_START_SIGNAL_FILE

Examples:
  node scripts/makalu-load-test.js --dry-run
  node scripts/makalu-load-test.js --target-tps 250 --duration 300
`);
}

function argOrEnv(args, argName, envName, fallback) {
  if (args[argName] !== undefined) {
    return args[argName];
  }
  if (process.env[envName] !== undefined) {
    return process.env[envName];
  }
  return fallback;
}

function envOnly(name, fallback) {
  if (process.env[name] !== undefined) {
    return process.env[name];
  }
  return fallback;
}

function envOrArg(args, argName, envName, fallback) {
  if (args[argName] !== undefined) {
    return args[argName];
  }
  if (process.env[envName] !== undefined) {
    return process.env[envName];
  }
  return fallback;
}

function toInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function toFloat(value, fallback) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return new Date().toISOString();
}

function makeRecipientPool(size) {
  const pool = [];
  for (let i = 0; i < size; i += 1) {
    pool.push(ethers.Wallet.createRandom().address);
  }
  return pool;
}

function getRecipient(state, walletState) {
  if (state.config.recipientMode === "self") {
    return walletState.wallet.address;
  }
  if (state.config.recipientMode === "fixed") {
    return state.config.recipient;
  }
  const recipient = state.recipientPool[state.recipientIndex % state.recipientPool.length];
  state.recipientIndex += 1;
  return recipient;
}

function loadPrivateKeys(config) {
  if (config.walletFile) {
    const walletFileContents = fs.readFileSync(config.walletFile, "utf8");
    const parsed = JSON.parse(walletFileContents);
    if (!parsed || !Array.isArray(parsed.wallets)) {
      throw new Error(`Wallet file ${config.walletFile} does not contain a wallets array`);
    }
    return parsed.wallets
      .map((wallet) => (wallet && wallet.privateKey ? String(wallet.privateKey).trim() : ""))
      .filter(Boolean);
  }

  return (envOnly("MAKALU_LOAD_TEST_PRIVATE_KEYS", ""))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function getGasPrice(provider, config) {
  if (config.gasPriceWei) {
    return config.gasPriceWei;
  }
  const feeData = await provider.getFeeData();
  if (feeData.gasPrice && !feeData.gasPrice.isZero()) {
    return feeData.gasPrice;
  }
  return ethers.utils.parseUnits("1", "gwei");
}

async function waitForReceipt(provider, txResponse, walletState, state) {
  try {
    const receipt = await provider.waitForTransaction(txResponse.hash, 1, state.config.confirmTimeoutMs);
    if (receipt) {
      state.stats.mined += 1;
      state.stats.confirmationLatenciesMs.push(Date.now() - txResponse.__submittedAt);
      state.minedBlockNumbers.push(receipt.blockNumber);
    } else {
      state.stats.timeouts += 1;
    }
  } catch (error) {
    state.stats.timeouts += 1;
    state.errors.push({
      at: nowIso(),
      type: "receipt-timeout",
      hash: txResponse.hash,
      wallet: walletState.wallet.address,
      message: error.message,
    });
  } finally {
    walletState.inflight -= 1;
  }
}

async function refreshWalletNonce(state, walletState, cause) {
  if (walletState.nonceRefreshPromise) {
    await walletState.nonceRefreshPromise;
    return;
  }

  walletState.nonceRefreshPromise = (async () => {
    try {
      const pendingNonce = await state.provider.getTransactionCount(walletState.wallet.address, "pending");
      walletState.nextNonce = pendingNonce;
      walletState.nonceRefreshes += 1;
    } catch (refreshError) {
      state.errors.push({
        at: nowIso(),
        type: "nonce-refresh-failed",
        wallet: walletState.wallet.address,
        cause,
        message: refreshError.message,
      });
    } finally {
      walletState.nonceRefreshPromise = null;
    }
  })();

  await walletState.nonceRefreshPromise;
}

function queueSend(state, walletState) {
  const run = async () => sendOne(state, walletState);
  const queued = walletState.submitChain.then(run, run);
  walletState.submitChain = queued.catch(() => null);
  return queued;
}

async function sendOne(state, walletState) {
  if (walletState.inflight >= state.config.maxPendingPerWallet) {
    return null;
  }

  const recipient = getRecipient(state, walletState);
  const gasPrice = await getGasPrice(state.provider, state.config);
  const txRequest = {
    chainId: state.config.chainId,
    to: recipient,
    value: state.config.valueWei,
    gasLimit: state.config.gasLimit,
    gasPrice,
    nonce: walletState.nextNonce,
  };

  const attemptedNonce = txRequest.nonce;
  walletState.nextNonce += 1;
  walletState.inflight += 1;
  const submittedAt = Date.now();

  try {
    const signedTx = await walletState.wallet.signTransaction(txRequest);
    const txResponse = await state.provider.sendTransaction(signedTx);
    txResponse.__submittedAt = submittedAt;
    state.stats.broadcasted += 1;
    state.stats.submitLatenciesMs.push(Date.now() - submittedAt);
    state.hashes.push(txResponse.hash);
    state.receiptPromises.push(waitForReceipt(state.provider, txResponse, walletState, state));
    return true;
  } catch (error) {
    walletState.inflight -= 1;
    walletState.nextNonce = attemptedNonce;
    state.stats.failed += 1;
    state.errors.push({
      at: nowIso(),
      type: "broadcast-failed",
      wallet: walletState.wallet.address,
      nonce: attemptedNonce,
      message: error.message,
    });
    await refreshWalletNonce(state, walletState, "broadcast-failed");
    return false;
  }
}

async function sampleChainWindow(provider, startBlock, endBlock) {
  const summary = {
    startBlock,
    endBlock,
    blockCount: 0,
    txCount: 0,
    timestamps: [],
  };

  if (endBlock < startBlock) {
    return summary;
  }

  for (let height = startBlock; height <= endBlock; height += 1) {
    const block = await provider.getBlock(height);
    if (!block) {
      continue;
    }
    summary.blockCount += 1;
    summary.txCount += Array.isArray(block.transactions) ? block.transactions.length : 0;
    summary.timestamps.push(block.timestamp);
  }

  if (summary.timestamps.length >= 2) {
    const first = summary.timestamps[0];
    const last = summary.timestamps[summary.timestamps.length - 1];
    summary.windowSeconds = Math.max(last - first, 1);
    summary.avgBlockTimeSeconds = (last - first) / (summary.timestamps.length - 1);
    summary.networkTps = summary.txCount / summary.windowSeconds;
  } else {
    summary.windowSeconds = 0;
    summary.avgBlockTimeSeconds = 0;
    summary.networkTps = 0;
  }

  delete summary.timestamps;
  return summary;
}

function avg(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function writeJsonArtifact(filePath, value) {
  if (!filePath) {
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }

  const repoRoot = path.join(__dirname, "..", "..");
  const defaultResultsDir = path.join(repoRoot, "docs", "load-test-results");
  const config = {
    rpcUrl: envOrArg(args, "rpc-url", "MAKALU_LOAD_TEST_RPC_URL", ""),
    chainId: toInt(envOrArg(args, "chain-id", "MAKALU_LOAD_TEST_CHAIN_ID", "700777"), 700777),
    walletFile: envOrArg(args, "wallet-file", "MAKALU_LOAD_TEST_WALLET_FILE", ""),
    durationSeconds: toInt(envOrArg(args, "duration", "MAKALU_LOAD_TEST_DURATION", "120"), 120),
    targetTps: toFloat(envOrArg(args, "target-tps", "MAKALU_LOAD_TEST_TARGET_TPS", "25"), 25),
    maxPendingPerWallet: toInt(envOrArg(args, "max-pending", "MAKALU_LOAD_TEST_MAX_PENDING", "32"), 32),
    confirmTimeoutSeconds: toInt(envOrArg(args, "confirm-timeout", "MAKALU_LOAD_TEST_CONFIRM_TIMEOUT", "180"), 180),
    drainTimeoutSeconds: toInt(envOrArg(args, "drain-timeout", "MAKALU_LOAD_TEST_DRAIN_TIMEOUT", "60"), 60),
    gasLimit: toInt(envOrArg(args, "gas-limit", "MAKALU_LOAD_TEST_GAS_LIMIT", "21000"), 21000),
    gasPriceGwei: envOrArg(args, "gas-price-gwei", "MAKALU_LOAD_TEST_GAS_PRICE_GWEI", ""),
    valueWei: ethers.BigNumber.from(envOrArg(args, "value-wei", "MAKALU_LOAD_TEST_VALUE_WEI", "0")),
    recipientMode: envOrArg(args, "recipient-mode", "MAKALU_LOAD_TEST_RECIPIENT_MODE", "pool"),
    recipient: envOrArg(args, "recipient", "MAKALU_LOAD_TEST_RECIPIENT", ""),
    recipientPoolSize: toInt(envOrArg(args, "recipient-pool-size", "MAKALU_LOAD_TEST_RECIPIENT_POOL_SIZE", "1000"), 1000),
    resultsDir: envOrArg(args, "results-dir", "MAKALU_LOAD_TEST_RESULTS_DIR", defaultResultsDir),
    startSignalFile: envOrArg(args, "start-signal-file", "MAKALU_LOAD_TEST_START_SIGNAL_FILE", ""),
    label: envOrArg(args, "label", "MAKALU_LOAD_TEST_LABEL", "makalu-load-test"),
    dryRun: Boolean(args["dry-run"]),
  };

  if (!config.rpcUrl) {
    throw new Error("--rpc-url or MAKALU_LOAD_TEST_RPC_URL is required");
  }

  config.confirmTimeoutMs = config.confirmTimeoutSeconds * 1000;
  config.drainTimeoutMs = config.drainTimeoutSeconds * 1000;
  config.gasPriceWei = config.gasPriceGwei
    ? ethers.utils.parseUnits(String(config.gasPriceGwei), "gwei")
    : null;

  if (!["fixed", "self", "pool"].includes(config.recipientMode)) {
    throw new Error(`Unsupported recipient mode: ${config.recipientMode}`);
  }

  if (config.recipientMode === "fixed" && !config.recipient) {
    throw new Error("recipient mode 'fixed' requires --recipient or MAKALU_LOAD_TEST_RECIPIENT");
  }

  const privateKeys = loadPrivateKeys(config);

  if (!privateKeys.length && !config.dryRun) {
    throw new Error("A wallet file or MAKALU_LOAD_TEST_PRIVATE_KEYS is required unless --dry-run is used");
  }

  const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl, config.chainId);
  const network = await provider.getNetwork();
  const setupLatestBlock = await provider.getBlock("latest");
  const gasPrice = await getGasPrice(provider, config);

  console.log("=".repeat(72));
  console.log("Makalu load test");
  console.log("=".repeat(72));
  console.log(`RPC URL:           ${config.rpcUrl}`);
  console.log(`Configured chain:  ${config.chainId}`);
  console.log(`RPC chain:         ${network.chainId}`);
  console.log(`Latest block:      ${setupLatestBlock.number}`);
  console.log(`Block timestamp:   ${new Date(setupLatestBlock.timestamp * 1000).toISOString()}`);
  console.log(`Wallet source:     ${config.walletFile || "env:MAKALU_LOAD_TEST_PRIVATE_KEYS"}`);
  console.log(`Target TPS:        ${config.targetTps}`);
  console.log(`Duration:          ${config.durationSeconds}s`);
  console.log(`Recipient mode:    ${config.recipientMode}`);
  console.log(`Wallet count:      ${privateKeys.length}`);
  console.log(`Drain timeout:     ${config.drainTimeoutSeconds}s`);
  console.log(`Gas limit:         ${config.gasLimit}`);
  console.log(`Gas price:         ${ethers.utils.formatUnits(gasPrice, "gwei")} gwei`);
  console.log(`Value:             ${config.valueWei.toString()} wei`);
  console.log(`Dry run:           ${config.dryRun}`);
  console.log("=".repeat(72));

  if (config.dryRun) {
    return;
  }

  fs.mkdirSync(config.resultsDir, { recursive: true });

  const preparationStartedAt = Date.now();
  const walletStates = [];
  for (let i = 0; i < privateKeys.length; i += 1) {
    const wallet = new ethers.Wallet(privateKeys[i], provider);
    const nextNonce = await provider.getTransactionCount(wallet.address, "pending");
    const balance = await wallet.getBalance();
    walletStates.push({
      wallet,
      nextNonce,
      startNonce: nextNonce,
      inflight: 0,
      balanceWei: balance.toString(),
      nonceRefreshes: 0,
      nonceRefreshPromise: null,
      submitChain: Promise.resolve(),
    });
  }

  const state = {
    config,
    provider,
    recipientPool: config.recipientMode === "pool" ? makeRecipientPool(config.recipientPoolSize) : [],
    recipientIndex: 0,
    walletStates,
    walletCursor: 0,
    hashes: [],
    receiptPromises: [],
    minedBlockNumbers: [],
    stats: {
      broadcasted: 0,
      failed: 0,
      mined: 0,
      timeouts: 0,
      submitLatenciesMs: [],
      confirmationLatenciesMs: [],
    },
    errors: [],
  };

  const sendWindowReferenceBlock = await provider.getBlock("latest");
  const startBlock = sendWindowReferenceBlock.number + 1;
  const startAt = Date.now();
  const sendWindowEndsAt = startAt + (config.durationSeconds * 1000);
  writeJsonArtifact(config.startSignalFile, {
    label: config.label,
    preparationStartedAt: new Date(preparationStartedAt).toISOString(),
    preparationFinishedAt: new Date(startAt).toISOString(),
    preparationDurationMs: startAt - preparationStartedAt,
    startedAt: new Date(startAt).toISOString(),
    sendWindowEndsAt: new Date(sendWindowEndsAt).toISOString(),
    durationSeconds: config.durationSeconds,
    walletCount: walletStates.length,
    targetTps: config.targetTps,
    referenceBlockBeforeSend: sendWindowReferenceBlock.number,
  });
  let targetIssued = 0;
  let carry = 0;
  let lastTickAt = startAt;
  const maxQueuedAttempts = Math.max(
    1,
    Math.min(Math.ceil(config.targetTps), config.maxPendingPerWallet * walletStates.length),
  );

  while (Date.now() - startAt < config.durationSeconds * 1000) {
    const now = Date.now();
    carry = Math.min(carry + (((now - lastTickAt) / 1000) * config.targetTps), maxQueuedAttempts);
    lastTickAt = now;

    const budget = Math.floor(carry);
    if (budget < 1) {
      await sleep(25);
      continue;
    }

    const batch = [];
    for (let i = 0; i < budget && Date.now() - startAt < config.durationSeconds * 1000; i += 1) {
      const walletState = walletStates[state.walletCursor % walletStates.length];
      state.walletCursor += 1;
      batch.push(queueSend(state, walletState));
    }

    const batchResults = await Promise.all(batch);
    let launched = 0;
    for (const sendResult of batchResults) {
      if (sendResult === null) {
        continue;
      }
      launched += 1;
      targetIssued += 1;
      carry = Math.max(carry - 1, 0);
    }

    if (launched === 0) {
      await sleep(25);
      continue;
    }

    await sleep(25);
  }

  const drainStartedAt = Date.now();
  let receiptDrainTimedOut = false;
  if (state.receiptPromises.length) {
    const drainOutcome = await Promise.race([
      Promise.allSettled(state.receiptPromises).then(() => "complete"),
      sleep(config.drainTimeoutMs).then(() => "timeout"),
    ]);
    receiptDrainTimedOut = drainOutcome === "timeout";
  }
  const receiptDrainWaitMs = Date.now() - drainStartedAt;

  const endBlock = await provider.getBlockNumber();
  const chainWindow = await sampleChainWindow(provider, startBlock, endBlock);
  const finishedAt = Date.now();
  const elapsedWallSeconds = Math.max((finishedAt - startAt) / 1000, 1);

  const result = {
    label: config.label,
    preparationStartedAt: new Date(preparationStartedAt).toISOString(),
    startedAt: new Date(startAt).toISOString(),
    finishedAt: new Date(finishedAt).toISOString(),
    timeline: {
      preparationDurationMs: startAt - preparationStartedAt,
      sendWindowEndsAt: new Date(sendWindowEndsAt).toISOString(),
      sendWindowReferenceBlock: sendWindowReferenceBlock.number,
    },
    config: {
      rpcUrl: config.rpcUrl,
      chainId: config.chainId,
      durationSeconds: config.durationSeconds,
      targetTps: config.targetTps,
      maxPendingPerWallet: config.maxPendingPerWallet,
      confirmTimeoutSeconds: config.confirmTimeoutSeconds,
      drainTimeoutSeconds: config.drainTimeoutSeconds,
      gasLimit: config.gasLimit,
      gasPriceGwei: ethers.utils.formatUnits(gasPrice, "gwei"),
      valueWei: config.valueWei.toString(),
      recipientMode: config.recipientMode,
      recipient: config.recipient,
      recipientPoolSize: config.recipientPoolSize,
      walletCount: walletStates.length,
      startSignalFile: config.startSignalFile,
    },
    wallets: walletStates.map((stateItem) => ({
      address: stateItem.wallet.address,
      startNonce: stateItem.startNonce,
      endNonce: stateItem.nextNonce,
      balanceWei: stateItem.balanceWei,
      nonceRefreshes: stateItem.nonceRefreshes,
    })),
    chainWindow,
    senderSummary: {
      attemptedSends: targetIssued,
      broadcasted: state.stats.broadcasted,
      failed: state.stats.failed,
      mined: state.stats.mined,
      timeouts: state.stats.timeouts,
      ownSubmittedTps: state.stats.broadcasted / config.durationSeconds,
      ownMinedTpsOverDuration: state.stats.mined / config.durationSeconds,
      ownMinedTpsOverWallClock: state.stats.mined / elapsedWallSeconds,
      avgSubmitLatencyMs: avg(state.stats.submitLatenciesMs),
      avgConfirmationLatencyMs: avg(state.stats.confirmationLatenciesMs),
      nonceRefreshes: walletStates.reduce((sum, stateItem) => sum + stateItem.nonceRefreshes, 0),
      receiptDrainTimedOut,
      receiptDrainWaitMs,
      pendingReceiptsAtSummary: walletStates.reduce((sum, stateItem) => sum + stateItem.inflight, 0),
      sampleHashes: state.hashes.slice(0, 25),
    },
    errors: state.errors.slice(0, 100),
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(config.resultsDir, `${config.label}-${timestamp}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

  console.log("");
  console.log("Load test summary");
  console.log("-".repeat(72));
  console.log(`Blocks sampled:            ${chainWindow.blockCount}`);
  console.log(`Network tx count:          ${chainWindow.txCount}`);
  console.log(`Observed network TPS:      ${chainWindow.networkTps.toFixed(2)}`);
  console.log(`Observed block time:       ${chainWindow.avgBlockTimeSeconds.toFixed(3)}s`);
  console.log(`Broadcasted txs:           ${state.stats.broadcasted}`);
  console.log(`Mined txs:                 ${state.stats.mined}`);
  console.log(`Own TPS over duration:     ${(state.stats.mined / config.durationSeconds).toFixed(2)}`);
  console.log(`Own TPS over wall clock:   ${(state.stats.mined / elapsedWallSeconds).toFixed(2)}`);
  console.log(`Avg submit latency:        ${avg(state.stats.submitLatenciesMs).toFixed(2)}ms`);
  console.log(`Avg confirmation latency:  ${avg(state.stats.confirmationLatenciesMs).toFixed(2)}ms`);
  console.log(`Receipt drain wait:        ${(receiptDrainWaitMs / 1000).toFixed(2)}s`);
  console.log(`Receipt drain timed out:   ${receiptDrainTimedOut}`);
  console.log(`Failed broadcasts:         ${state.stats.failed}`);
  console.log(`Receipt timeouts:          ${state.stats.timeouts}`);
  console.log(`Results file:              ${outputPath}`);

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
