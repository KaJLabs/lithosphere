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
Correlate a Makalu profiled load-test run

Usage:
  node scripts/makalu-correlate-profiled-run.js --manifest <path> [options]

Options:
  --manifest <path>   Artifact manifest from makalu-profiled-load-test.sh
  --rpc-url <url>     Override the RPC URL used to fetch block metadata
  --out <path>        Output JSON path (default: docs/load-test-results/correlated-*.json)
  --help              Show this help
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

function sanitizeLabel(raw) {
  return String(raw || "makalu-profiled-run")
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "-");
}

function normalizeLocalPath(rawPath, baseDir = process.cwd()) {
  if (!rawPath) {
    return "";
  }

  if (path.isAbsolute(rawPath) && fs.existsSync(rawPath)) {
    return rawPath;
  }

  if (/^[A-Za-z]:[\\/]/.test(rawPath) && fs.existsSync(rawPath)) {
    return rawPath;
  }

  const mntMatch = rawPath.match(/^\/mnt\/([A-Za-z])\/(.*)$/);
  if (mntMatch) {
    const drive = `${mntMatch[1].toUpperCase()}:`;
    const tail = mntMatch[2].replace(/\//g, path.win32.sep);
    const windowsPath = path.win32.join(drive, tail);
    if (fs.existsSync(windowsPath)) {
      return windowsPath;
    }
    return windowsPath;
  }

  const windowsMatch = rawPath.match(/^([A-Za-z]):\\(.*)$/);
  if (windowsMatch && process.platform !== "win32") {
    const unixPath = `/mnt/${windowsMatch[1].toLowerCase()}/${windowsMatch[2].replace(/\\/g, "/")}`;
    if (fs.existsSync(unixPath)) {
      return unixPath;
    }
    return unixPath;
  }

  const resolved = path.resolve(baseDir, rawPath);
  if (fs.existsSync(resolved)) {
    return resolved;
  }

  return resolved;
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function toIso(ms) {
  return new Date(ms).toISOString();
}

function toSeconds(valueMs) {
  return Number((valueMs / 1000).toFixed(3));
}

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function avg(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function classifyPhase(timestampMs, sendStartMs, sendEndMs, finishedMs) {
  if (timestampMs < sendStartMs) {
    return "before-send-window";
  }
  if (timestampMs <= sendEndMs) {
    return "within-send-window";
  }
  if (timestampMs <= finishedMs) {
    return "during-drain-window";
  }
  return "after-finished";
}

function summarizePhaseCounts(snapshots) {
  const counts = {
    "before-send-window": 0,
    "within-send-window": 0,
    "during-drain-window": 0,
    "after-finished": 0,
  };

  for (const snapshot of snapshots) {
    counts[snapshot.phase] = (counts[snapshot.phase] || 0) + 1;
  }

  return counts;
}

async function fetchBlocks(provider, startBlock, endBlock) {
  const blocks = [];
  if (!Number.isFinite(startBlock) || !Number.isFinite(endBlock) || endBlock < startBlock) {
    return blocks;
  }

  for (let height = startBlock; height <= endBlock; height += 1) {
    const block = await provider.getBlock(height);
    if (!block) {
      continue;
    }
    blocks.push({
      number: block.number,
      timestamp: block.timestamp,
      timestampMs: block.timestamp * 1000,
      timestampIso: new Date(block.timestamp * 1000).toISOString(),
      txCount: Array.isArray(block.transactions) ? block.transactions.length : 0,
    });
  }

  return blocks;
}

function summarizeBlocksForWallWindow(blocks, windowStartMs, windowEndMs) {
  const matching = blocks.filter((block) => block.timestampMs >= windowStartMs && block.timestampMs <= windowEndMs);
  const txCount = matching.reduce((sum, block) => sum + block.txCount, 0);
  const wallWindowSeconds = Math.max((windowEndMs - windowStartMs) / 1000, 1);
  const firstBlock = matching[0] || null;
  const lastBlock = matching[matching.length - 1] || null;
  const observedBlockSpanSeconds = matching.length >= 2
    ? (matching[matching.length - 1].timestamp - matching[0].timestamp)
    : 0;

  return {
    blockCount: matching.length,
    txCount,
    wallWindowSeconds: round(wallWindowSeconds, 3),
    networkTpsOverWallWindow: round(txCount / wallWindowSeconds, 2),
    firstBlock: firstBlock ? firstBlock.number : null,
    lastBlock: lastBlock ? lastBlock.number : null,
    firstBlockAt: firstBlock ? firstBlock.timestampIso : "",
    lastBlockAt: lastBlock ? lastBlock.timestampIso : "",
    observedBlockSpanSeconds: round(observedBlockSpanSeconds, 3),
    networkTpsOverObservedBlockSpan: observedBlockSpanSeconds > 0
      ? round(txCount / observedBlockSpanSeconds, 2)
      : 0,
  };
}

function nearestBlocksForTimestamp(blocks, timestampMs) {
  if (!blocks.length) {
    return { previous: null, next: null, nearest: null };
  }

  let previous = null;
  let next = null;
  for (const block of blocks) {
    if (block.timestampMs <= timestampMs) {
      previous = block;
      continue;
    }
    next = block;
    break;
  }

  if (!previous) {
    return { previous: null, next, nearest: next };
  }

  if (!next) {
    return { previous, next: null, nearest: previous };
  }

  const previousDelta = Math.abs(timestampMs - previous.timestampMs);
  const nextDelta = Math.abs(next.timestampMs - timestampMs);
  return {
    previous,
    next,
    nearest: previousDelta <= nextDelta ? previous : next,
  };
}

function compactBlock(block, timestampMs) {
  if (!block) {
    return null;
  }
  return {
    number: block.number,
    timestamp: block.timestampIso,
    txCount: block.txCount,
    deltaFromSnapshotSeconds: round((timestampMs - block.timestampMs) / 1000, 3),
  };
}

function summarizeTarget(snapshots) {
  return {
    snapshotCount: snapshots.length,
    avgLithodCpuPct: round(avg(snapshots.map((item) => item.cpu.lithodCpuPct || 0)), 2),
    avgMemoryPressurePct: round(avg(snapshots.map((item) => item.memory.pressurePct || 0)), 2),
    currentProposerLocalCount: snapshots.filter((item) => item.consensus.currentProposerIsLocal).length,
    lastProposerLocalCount: snapshots.filter((item) => item.consensus.lastProposerIsLocal).length,
    maxUnconfirmedTxs: Math.max(...snapshots.map((item) => item.consensus.unconfirmedTxs || 0), 0),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }

  if (!args.manifest) {
    throw new Error("--manifest is required");
  }

  const manifestPath = normalizeLocalPath(args.manifest);
  const manifestDir = path.dirname(manifestPath);
  const manifest = loadJson(manifestPath);
  const loadResultPath = normalizeLocalPath(manifest.loadTest.resultFile, manifestDir);
  const loadResult = loadJson(loadResultPath);

  const rpcUrl = argOrEnv(args, "rpc-url", "MAKALU_LOAD_TEST_RPC_URL", loadResult.config.rpcUrl || manifest.loadTest.rpcUrl || "");
  const sendStartMs = Date.parse(loadResult.startedAt);
  const finishedMs = Date.parse(loadResult.finishedAt);
  const durationSeconds = Number(loadResult.config.durationSeconds || manifest.loadTest.durationSeconds || 0);
  const sendEndMs = sendStartMs + (durationSeconds * 1000);
  const preparationStartedMs = loadResult.preparationStartedAt ? Date.parse(loadResult.preparationStartedAt) : sendStartMs;

  const snapshots = [];
  const profileAttempts = Array.isArray(manifest.profileAttempts) && manifest.profileAttempts.length
    ? manifest.profileAttempts
    : (manifest.profileAttempt ? [manifest.profileAttempt] : []);
  for (const attempt of profileAttempts) {
    const jsonFiles = Array.isArray(attempt.jsonFiles) && attempt.jsonFiles.length
      ? attempt.jsonFiles
      : (attempt.jsonFile ? [attempt.jsonFile] : []);
    for (let index = 0; index < jsonFiles.length; index += 1) {
      const filePath = normalizeLocalPath(jsonFiles[index], manifestDir);
      if (!fs.existsSync(filePath)) {
        continue;
      }
      const snapshot = loadJson(filePath);
      const timestampMs = Date.parse(snapshot.timestamp);
      snapshots.push({
        target: attempt.target,
        snapshotIndex: index + 1,
        file: filePath,
        timestamp: snapshot.timestamp,
        timestampMs,
        offsetFromSendStartSeconds: round((timestampMs - sendStartMs) / 1000, 3),
        offsetFromSendEndSeconds: round((timestampMs - sendEndMs) / 1000, 3),
        phase: classifyPhase(timestampMs, sendStartMs, sendEndMs, finishedMs),
        cpu: {
          lithodCpuPct: snapshot.cpu && snapshot.cpu.lithod_cpu_pct !== undefined ? snapshot.cpu.lithod_cpu_pct : 0,
          load1m: snapshot.cpu && snapshot.cpu.load_1m !== undefined ? snapshot.cpu.load_1m : 0,
        },
        memory: {
          pressurePct: snapshot.memory && snapshot.memory.pressure_pct !== undefined ? snapshot.memory.pressure_pct : 0,
          lithodRssBytes: snapshot.memory && snapshot.memory.lithod_rss_bytes !== undefined ? snapshot.memory.lithod_rss_bytes : 0,
        },
        consensus: {
          latestHeight: snapshot.consensus && snapshot.consensus.latest_height !== undefined ? snapshot.consensus.latest_height : 0,
          avgBlockTimeSeconds: snapshot.consensus && snapshot.consensus.avg_block_time_s !== undefined ? snapshot.consensus.avg_block_time_s : 0,
          currentProposerIsLocal: Boolean(snapshot.consensus && snapshot.consensus.current_proposer_is_local),
          lastProposerIsLocal: Boolean(snapshot.consensus && snapshot.consensus.last_proposer_is_local),
          triggeredTimeoutPrecommit: Boolean(snapshot.consensus && snapshot.consensus.triggered_timeout_precommit),
          unconfirmedTxs: snapshot.consensus && snapshot.consensus.unconfirmed_txs !== undefined ? snapshot.consensus.unconfirmed_txs : 0,
          unconfirmedTotal: snapshot.consensus && snapshot.consensus.unconfirmed_total !== undefined ? snapshot.consensus.unconfirmed_total : 0,
          currentStep: snapshot.consensus && snapshot.consensus.current_step !== undefined ? snapshot.consensus.current_step : null,
        },
      });
    }
  }

  snapshots.sort((a, b) => a.timestampMs - b.timestampMs || a.target.localeCompare(b.target));

  const phaseCounts = summarizePhaseCounts(snapshots);
  const snapshotsByTarget = {};
  for (const snapshot of snapshots) {
    if (!snapshotsByTarget[snapshot.target]) {
      snapshotsByTarget[snapshot.target] = [];
    }
    snapshotsByTarget[snapshot.target].push(snapshot);
  }

  let blocks = [];
  let blockFetchError = "";
  if (rpcUrl) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl, loadResult.config.chainId || manifest.loadTest.chainId);
      blocks = await fetchBlocks(provider, loadResult.chainWindow.startBlock, loadResult.chainWindow.endBlock);
    } catch (error) {
      blockFetchError = error.message;
    }
  } else {
    blockFetchError = "RPC URL was not provided";
  }

  const enrichedSnapshots = snapshots.map((snapshot) => {
    const nearest = nearestBlocksForTimestamp(blocks, snapshot.timestampMs);
    return {
      ...snapshot,
      blocks: {
        previous: compactBlock(nearest.previous, snapshot.timestampMs),
        next: compactBlock(nearest.next, snapshot.timestampMs),
        nearest: compactBlock(nearest.nearest, snapshot.timestampMs),
      },
    };
  });

  const targetSummaries = Object.fromEntries(
    Object.entries(snapshotsByTarget).map(([target, targetSnapshots]) => [target, summarizeTarget(targetSnapshots)]),
  );

  const maxUnconfirmedSnapshot = enrichedSnapshots.reduce((currentMax, snapshot) => {
    if (!currentMax || (snapshot.consensus.unconfirmedTxs || 0) > (currentMax.consensus.unconfirmedTxs || 0)) {
      return snapshot;
    }
    return currentMax;
  }, null);

  const sendWindowSummary = summarizeBlocksForWallWindow(blocks, sendStartMs, sendEndMs);
  const lifecycleSummary = summarizeBlocksForWallWindow(blocks, sendStartMs, finishedMs);

  const summary = {
    manifest: {
      path: manifestPath,
      label: manifest.label,
      runTag: manifest.runTag,
    },
    loadResult: {
      path: loadResultPath,
      label: loadResult.label,
      preparationStartedAt: loadResult.preparationStartedAt || "",
      startedAt: loadResult.startedAt,
      sendWindowEndsAt: loadResult.timeline && loadResult.timeline.sendWindowEndsAt ? loadResult.timeline.sendWindowEndsAt : toIso(sendEndMs),
      finishedAt: loadResult.finishedAt,
      preparationDurationSeconds: toSeconds(sendStartMs - preparationStartedMs),
      senderSummary: loadResult.senderSummary,
      originalChainWindow: loadResult.chainWindow,
    },
    profileSummary: {
      requestedTargets: manifest.profileSummary && Array.isArray(manifest.profileSummary.requestedTargets)
        ? manifest.profileSummary.requestedTargets
        : Object.keys(targetSummaries),
      totalSnapshots: enrichedSnapshots.length,
      phaseCounts,
      targetSummaries,
      alignmentWarning: phaseCounts["before-send-window"] === enrichedSnapshots.length && enrichedSnapshots.length > 0
        ? "all profile snapshots landed before the send window"
        : "",
      maxUnconfirmedSnapshot: maxUnconfirmedSnapshot ? {
        target: maxUnconfirmedSnapshot.target,
        file: maxUnconfirmedSnapshot.file,
        timestamp: maxUnconfirmedSnapshot.timestamp,
        offsetFromSendStartSeconds: maxUnconfirmedSnapshot.offsetFromSendStartSeconds,
        phase: maxUnconfirmedSnapshot.phase,
        unconfirmedTxs: maxUnconfirmedSnapshot.consensus.unconfirmedTxs,
        triggeredTimeoutPrecommit: maxUnconfirmedSnapshot.consensus.triggeredTimeoutPrecommit,
        nearestBlock: maxUnconfirmedSnapshot.blocks.nearest,
      } : null,
    },
    alignedChainWindows: {
      sendWindow: sendWindowSummary,
      lifecycleWindow: lifecycleSummary,
      blockFetchError,
    },
    snapshots: enrichedSnapshots.map((snapshot) => ({
      target: snapshot.target,
      snapshotIndex: snapshot.snapshotIndex,
      timestamp: snapshot.timestamp,
      phase: snapshot.phase,
      offsetFromSendStartSeconds: snapshot.offsetFromSendStartSeconds,
      offsetFromSendEndSeconds: snapshot.offsetFromSendEndSeconds,
      cpu: snapshot.cpu,
      memory: snapshot.memory,
      consensus: snapshot.consensus,
      blocks: snapshot.blocks,
      file: snapshot.file,
    })),
  };

  const outputPath = args.out
    ? normalizeLocalPath(args.out)
    : path.join(manifestDir, `correlated-${sanitizeLabel(manifest.label || loadResult.label)}-${manifest.runTag || "run"}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));

  console.log("Correlated Makalu profiled run");
  console.log("------------------------------------------------------------------------");
  console.log(`Manifest:                     ${manifestPath}`);
  console.log(`Load result:                  ${loadResultPath}`);
  console.log(`Preparation before send:      ${summary.loadResult.preparationDurationSeconds.toFixed(3)}s`);
  console.log(`Send window:                  ${loadResult.startedAt} -> ${summary.loadResult.sendWindowEndsAt}`);
  console.log(`Run finished:                 ${loadResult.finishedAt}`);
  console.log(`Snapshots before send:        ${phaseCounts["before-send-window"]}/${enrichedSnapshots.length}`);
  console.log(`Snapshots during send:        ${phaseCounts["within-send-window"]}/${enrichedSnapshots.length}`);
  console.log(`Snapshots during drain:       ${phaseCounts["during-drain-window"]}/${enrichedSnapshots.length}`);
  console.log(`Snapshots after finish:       ${phaseCounts["after-finished"]}/${enrichedSnapshots.length}`);
  if (summary.profileSummary.alignmentWarning) {
    console.log(`Alignment warning:            ${summary.profileSummary.alignmentWarning}`);
  }
  console.log(`Original network TPS:         ${round(loadResult.chainWindow.networkTps || 0, 2).toFixed(2)}`);
  console.log(`Aligned send-window TPS:      ${summary.alignedChainWindows.sendWindow.networkTpsOverWallWindow.toFixed(2)}`);
  console.log(`Aligned lifecycle TPS:        ${summary.alignedChainWindows.lifecycleWindow.networkTpsOverWallWindow.toFixed(2)}`);
  if (summary.profileSummary.maxUnconfirmedSnapshot) {
    console.log(`Max unconfirmed txs:          ${summary.profileSummary.maxUnconfirmedSnapshot.unconfirmedTxs}`);
    console.log(`Max unconfirmed snapshot:     ${summary.profileSummary.maxUnconfirmedSnapshot.target} at ${summary.profileSummary.maxUnconfirmedSnapshot.timestamp} (${summary.profileSummary.maxUnconfirmedSnapshot.phase}, ${summary.profileSummary.maxUnconfirmedSnapshot.offsetFromSendStartSeconds.toFixed(3)}s from send start)`);
  }
  if (blockFetchError) {
    console.log(`Block correlation warning:    ${blockFetchError}`);
  }
  console.log(`Output file:                  ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
