#!/usr/bin/env node
/**
 * Sync Hardhat-compiled ABIs into @lithosphere/blockchain-core.
 *
 * Why: the SDK ships JSON ABIs as part of its public surface
 * (`@lithosphere/blockchain-core/abis`). Those files were hand-copied at
 * package-creation time and have no automated link back to the Solidity
 * sources. Any contract change risks silently shipping an SDK that's a
 * version behind. This script makes the contract artifact the
 * source-of-truth and re-emits the SDK copies whenever it runs.
 *
 * Invoked by:
 *   - `pnpm --filter @lithosphere/contracts run sync-abis` (local)
 *   - `ci-contracts.yaml` -> `abi-sync-check` job (CI), which fails if
 *     running the script produces a non-empty `git diff`. That's the
 *     drift gate: a contract change merged without a re-sync fails CI.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const contractsRoot = resolve(__dirname, '..');
const sdkAbiDir = resolve(contractsRoot, '..', 'packages', 'blockchain-core', 'src', 'abis');

// Map: Hardhat artifact name (matches the Solidity contract name) -> SDK ABI
// filename. The SDK uses uppercase LEP100 by convention; the source contract
// is `Lep100`. Keep both in sync explicitly so a rename in either repo
// produces a loud failure rather than silent drift.
const SYNC_MAP = [
  { artifact: 'Lep100',      sdk: 'LEP100' },
  { artifact: 'WLITHO',      sdk: 'WLITHO' },
  { artifact: 'LITHONative', sdk: 'LITHONative' },
];

function loadArtifactAbi(name) {
  const path = resolve(contractsRoot, 'artifacts', 'src', `${name}.sol`, `${name}.json`);
  if (!existsSync(path)) {
    throw new Error(
      `Artifact missing: ${path}\n` +
      `Hint: run \`pnpm --filter @lithosphere/contracts run compile\` first.`,
    );
  }
  const artifact = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(artifact.abi)) {
    throw new Error(`Artifact at ${path} has no \`abi\` array.`);
  }
  return artifact.abi;
}

function writeSdkAbi(name, abi) {
  mkdirSync(sdkAbiDir, { recursive: true });
  const path = resolve(sdkAbiDir, `${name}.json`);
  // Pretty-print with 2-space indent — matches the hand-written originals so
  // the first sync after this script lands produces zero diff.
  writeFileSync(path, JSON.stringify(abi, null, 2) + '\n');
  return path;
}

function main() {
  console.log('Syncing ABIs: contracts/artifacts/ -> packages/blockchain-core/src/abis/');
  for (const { artifact, sdk } of SYNC_MAP) {
    const abi = loadArtifactAbi(artifact);
    const out = writeSdkAbi(sdk, abi);
    console.log(`  ${artifact} -> ${out.replace(contractsRoot, '<contracts>')}`);
  }
  console.log('Done. Run `git status` to see if anything drifted.');
}

main();
