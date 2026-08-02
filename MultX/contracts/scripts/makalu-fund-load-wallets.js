#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const os = require("os");
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
Makalu load-wallet funder

Usage:
  node scripts/makalu-fund-load-wallets.js [options]

Options:
  --rpc-url <url>          EVM RPC endpoint
  --chain-id <id>          Chain ID (default: 700777)
  --funding-mode <mode>    source | faucet (default: auto)
  --funding-key <hex>      Funded source private key
  --faucet-url <url>       Public faucet claim endpoint
  --faucet-delay-ms <n>    Delay between faucet claims (default: 1200)
  --faucet-max-attempts <n>
                          Max faucet attempts per wallet (default: 5)
  --faucet-retry-delay-ms <n>
                          Minimum wait after a faucet error (default: 5000)
  --wallet-count <n>       Number of wallets to create (default: 4)
  --amount-litho <n>       Amount to fund each wallet with (default: 10)
  --out <path>             Output JSON file (default: OS temp dir)
  --dry-run                Validate source wallet only, do not fund
  --help                   Show this help

Environment:
  MAKALU_LOAD_TEST_RPC_URL
  MAKALU_LOAD_TEST_CHAIN_ID
  MAKALU_LOAD_TEST_FUNDING_MODE
  MAKALU_LOAD_TEST_FUNDING_KEY
  MAKALU_LOAD_TEST_FAUCET_URL
  MAKALU_LOAD_TEST_FAUCET_DELAY_MS
  MAKALU_LOAD_TEST_FAUCET_MAX_ATTEMPTS
  MAKALU_LOAD_TEST_FAUCET_RETRY_DELAY_MS

Example:
  node scripts/makalu-fund-load-wallets.js --wallet-count 4 --amount-litho 25
`);
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

function nowTag() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toPositiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function fundWalletViaFaucet(wallet, config) {
  let lastError = null;

  for (let attempt = 1; attempt <= config.faucetMaxAttempts; attempt += 1) {
    try {
      const response = await fetch(config.faucetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: wallet.address,
          walletType: "WEB3",
          amount: `${config.amountLitho} LITHO`,
          reason: "makalu load test wallet funding",
          signature: "",
        }),
      });
      const bodyText = await response.text();
      let bodyJson = null;
      try {
        bodyJson = JSON.parse(bodyText);
      } catch (error) {
        bodyJson = null;
      }

      if (response.ok && bodyJson && bodyJson.ok === true) {
        if (bodyJson.message) {
          console.log(`  Faucet: ${bodyJson.message}`);
        }
        await sleep(config.faucetDelayMs);
        return bodyJson.txHash || bodyJson.message || "faucet-ok";
      }

      lastError = new Error(`Faucet funding failed for ${wallet.address}: ${bodyText}`);
      const cooldownSeconds = bodyJson && bodyJson.cooldownSeconds
        ? Number.parseInt(bodyJson.cooldownSeconds, 10)
        : 0;
      if (attempt >= config.faucetMaxAttempts) {
        throw lastError;
      }

      const retryDelayMs = Math.max(
        config.faucetRetryDelayMs,
        Number.isFinite(cooldownSeconds) && cooldownSeconds > 0 ? cooldownSeconds * 1000 : 0,
      );
      console.warn(`  Faucet attempt ${attempt}/${config.faucetMaxAttempts} failed: ${lastError.message}`);
      console.warn(`  Retrying in ${retryDelayMs}ms...`);
      await sleep(retryDelayMs);
    } catch (error) {
      lastError = error;
      if (attempt >= config.faucetMaxAttempts) {
        throw lastError;
      }

      console.warn(`  Faucet attempt ${attempt}/${config.faucetMaxAttempts} failed: ${error.message}`);
      console.warn(`  Retrying in ${config.faucetRetryDelayMs}ms...`);
      await sleep(config.faucetRetryDelayMs);
    }
  }

  throw lastError || new Error(`Faucet funding failed for ${wallet.address}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }

  const rawAmountLitho = envOrArg(args, "amount-litho", "MAKALU_LOAD_TEST_FUND_AMOUNT_LITHO", "");

  const config = {
    rpcUrl: envOrArg(args, "rpc-url", "MAKALU_LOAD_TEST_RPC_URL", "http://31.97.39.138:8545"),
    chainId: toInt(envOrArg(args, "chain-id", "MAKALU_LOAD_TEST_CHAIN_ID", "700777"), 700777),
    fundingMode: envOrArg(args, "funding-mode", "MAKALU_LOAD_TEST_FUNDING_MODE", "auto"),
    fundingKey: envOrArg(args, "funding-key", "MAKALU_LOAD_TEST_FUNDING_KEY", ""),
    faucetUrl: envOrArg(args, "faucet-url", "MAKALU_LOAD_TEST_FAUCET_URL", "https://makalu.litho.ai/api/faucet/claim"),
    faucetDelayMs: toInt(envOrArg(args, "faucet-delay-ms", "MAKALU_LOAD_TEST_FAUCET_DELAY_MS", "1200"), 1200),
    faucetMaxAttempts: toPositiveInt(envOrArg(args, "faucet-max-attempts", "MAKALU_LOAD_TEST_FAUCET_MAX_ATTEMPTS", "5"), 5),
    faucetRetryDelayMs: toPositiveInt(envOrArg(args, "faucet-retry-delay-ms", "MAKALU_LOAD_TEST_FAUCET_RETRY_DELAY_MS", "5000"), 5000),
    walletCount: toInt(envOrArg(args, "wallet-count", "MAKALU_LOAD_TEST_WALLET_COUNT", "4"), 4),
    amountLitho: rawAmountLitho,
    outPath: envOrArg(
      args,
      "out",
      "MAKALU_LOAD_TEST_WALLET_FILE",
      path.join(os.tmpdir(), `makalu-load-wallets-${nowTag()}.json`),
    ),
    dryRun: Boolean(args["dry-run"]),
  };

  if (!["auto", "source", "faucet"].includes(config.fundingMode)) {
    throw new Error(`Unsupported funding mode: ${config.fundingMode}`);
  }

  if (config.fundingMode === "auto") {
    config.fundingMode = config.fundingKey ? "source" : "faucet";
  }

  if (!config.amountLitho) {
    config.amountLitho = config.fundingMode === "faucet" ? "2" : "10";
  }

  if (config.fundingMode === "source" && !config.fundingKey && !config.dryRun) {
    throw new Error("Funding mode 'source' requires --funding-key or MAKALU_LOAD_TEST_FUNDING_KEY");
  }

  const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl, config.chainId);
  const network = await provider.getNetwork();
  const latestBlock = await provider.getBlock("latest");

  let sourceWallet = null;
  let sourceBalance = ethers.constants.Zero;
  if (config.fundingKey) {
    sourceWallet = new ethers.Wallet(config.fundingKey, provider);
    sourceBalance = await sourceWallet.getBalance();
  }

  console.log("=".repeat(72));
  console.log("Makalu load-wallet funder");
  console.log("=".repeat(72));
  console.log(`RPC URL:           ${config.rpcUrl}`);
  console.log(`Configured chain:  ${config.chainId}`);
  console.log(`RPC chain:         ${network.chainId}`);
  console.log(`Latest block:      ${latestBlock.number}`);
  console.log(`Funding mode:      ${config.fundingMode}`);
  console.log(`Wallet count:      ${config.walletCount}`);
  console.log(`Amount / wallet:   ${config.amountLitho} LITHO`);
  console.log(`Source wallet:     ${sourceWallet ? sourceWallet.address : "(none)"}`);
  console.log(`Source balance:    ${ethers.utils.formatUnits(sourceBalance, 18)} LITHO`);
  console.log(`Faucet URL:        ${config.fundingMode === "faucet" ? config.faucetUrl : "(unused)"}`);
  console.log(`Faucet attempts:   ${config.fundingMode === "faucet" ? config.faucetMaxAttempts : "(unused)"}`);
  console.log(`Faucet retry wait: ${config.fundingMode === "faucet" ? `${config.faucetRetryDelayMs}ms` : "(unused)"}`);
  console.log(`Output file:       ${config.outPath}`);
  console.log(`Dry run:           ${config.dryRun}`);
  console.log("=".repeat(72));

  if (config.dryRun) {
    return;
  }

  const amountWei = ethers.utils.parseUnits(String(config.amountLitho), 18);
  if (config.fundingMode === "source") {
    const requiredWei = amountWei.mul(config.walletCount);
    if (sourceBalance.lt(requiredWei)) {
      throw new Error(
        `Source balance ${ethers.utils.formatUnits(sourceBalance, 18)} is below required ${ethers.utils.formatUnits(requiredWei, 18)} LITHO`,
      );
    }
  }

  const wallets = [];
  for (let i = 0; i < config.walletCount; i += 1) {
    wallets.push(ethers.Wallet.createRandom());
  }

  const fundedWallets = [];
  for (let i = 0; i < wallets.length; i += 1) {
    const wallet = wallets[i];
    console.log(`Funding wallet ${i + 1}/${wallets.length}: ${wallet.address}`);
    let fundingRef = null;
    if (config.fundingMode === "source") {
      const tx = await sourceWallet.sendTransaction({
        to: wallet.address,
        value: amountWei,
      });
      const receipt = await tx.wait(1);
      fundingRef = receipt.transactionHash;
    } else {
      fundingRef = await fundWalletViaFaucet(wallet, config);
    }
    fundedWallets.push({
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic ? wallet.mnemonic.phrase : null,
      fundingTxHash: fundingRef,
      fundedAmountWei: amountWei.toString(),
    });
  }

  const payload = {
    createdAt: new Date().toISOString(),
    rpcUrl: config.rpcUrl,
    chainId: config.chainId,
    fundingMode: config.fundingMode,
    sourceAddress: sourceWallet ? sourceWallet.address : null,
    walletCount: config.walletCount,
    amountPerWalletLitho: String(config.amountLitho),
    wallets: fundedWallets,
  };

  fs.writeFileSync(config.outPath, JSON.stringify(payload, null, 2));

  console.log("");
  console.log("Funding summary");
  console.log("-".repeat(72));
  console.log(`Wallet file:        ${config.outPath}`);
  console.log(`Wallet addresses:   ${fundedWallets.map((wallet) => wallet.address).join(", ")}`);
  console.log("Private keys were written only to the wallet file above.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
