#!/usr/bin/env node
/**
 * Lithosphere flaky-test quarantine processor.
 *
 * Pipeline:
 *   1. Read `.test-quarantine.yaml` from repo root.
 *   2. For each of api / indexer / explorer, load
 *      `Makalu/<pkg>/test-results.json` (vitest's JSON reporter output,
 *      already emitted in CI per Makalu/api/vitest.config.ts).
 *   3. For every test result, compute its `fullName` as
 *      `<ancestorTitles> > <title>` — identical to the format produced
 *      by `scripts/flake-tracker.sh`, so an entry copied from a flake-
 *      tracker report drops in unchanged.
 *   4. Split failures into:
 *        - "real" — name not in the allowlist
 *        - "quarantined" — name in the allowlist
 *   5. Flag stale entries (older than 30 days) with `::warning::`.
 *   6. Append a "Quarantined Failures" subtable to /tmp/pr-summary.md
 *      (which the existing PR test-summary step already wrote) when
 *      there were active quarantined failures this run.
 *   7. Exit 1 iff any real (non-quarantined) failures exist.
 *
 * The Test job in ci.yaml runs as `continue-on-error: true` today, so
 * this exit code is advisory. The day Phase 6 flips Test to blocking,
 * the quarantine already does the right thing — real failures gate,
 * quarantined ones don't.
 *
 * Local invocation:
 *   node scripts/process-test-results.mjs
 * CI invocation:
 *   same — wired into ci.yaml's Test job as the last step.
 */

import { existsSync, readFileSync, appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const quarantinePath = resolve(repoRoot, '.test-quarantine.yaml');
const summaryPath = process.env.PR_SUMMARY_PATH || '/tmp/pr-summary.md';
const STALE_DAYS = 30;

const PACKAGES = ['api', 'indexer', 'explorer'];

/**
 * Minimal YAML — only the subset .test-quarantine.yaml uses.
 * Same hand-parse approach as scripts/check-licenses.mjs (avoids a
 * transitive dep that would itself need license-checking).
 */
function parseQuarantine(yaml) {
  const out = { entries: [] };
  const lines = yaml.split(/\r?\n/);
  let inEntries = false;
  let current = null;

  for (const raw of lines) {
    if (/^\s*#/.test(raw) || raw.trim() === '') continue;

    if (/^entries:\s*\[\s*\]\s*$/.test(raw)) {
      // empty list shorthand
      return out;
    }

    if (/^entries:\s*$/.test(raw)) {
      inEntries = true;
      continue;
    }

    if (!inEntries) continue;

    const itemStart = raw.match(/^\s*-\s+package:\s*(.+?)\s*$/);
    if (itemStart) {
      if (current) out.entries.push(current);
      current = { package: itemStart[1].trim() };
      continue;
    }

    if (current) {
      const field = raw.match(/^\s+([a-zA-Z]+):\s*(.+?)\s*$/);
      if (field) {
        let value = field[2].trim();
        // strip wrapping quotes (single or double)
        if (
          (value.startsWith("'") && value.endsWith("'")) ||
          (value.startsWith('"') && value.endsWith('"'))
        ) {
          value = value.slice(1, -1);
        }
        current[field[1]] = value;
      }
    }
  }
  if (current) out.entries.push(current);
  return out;
}

function loadResults(pkg) {
  const path = resolve(repoRoot, 'Makalu', pkg, 'test-results.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    console.warn(`Failed to parse ${path}: ${err.message}`);
    return null;
  }
}

function collectFailures(pkg, results) {
  if (!results) return [];
  const failures = [];
  for (const file of results.testResults || []) {
    for (const assertion of file.assertionResults || []) {
      if (assertion.status !== 'failed') continue;
      const fullName = [...(assertion.ancestorTitles || []), assertion.title].join(' > ');
      failures.push({ package: pkg, fullName });
    }
  }
  return failures;
}

function daysSince(isoDate) {
  const parsed = Date.parse(isoDate);
  if (Number.isNaN(parsed)) return 0;
  return Math.floor((Date.now() - parsed) / 86400000);
}

function appendSummary(quarantinedFailures, staleEntries) {
  if (quarantinedFailures.length === 0 && staleEntries.length === 0) return;

  let md = '\n\n## Quarantined Failures\n\n';
  if (quarantinedFailures.length > 0) {
    md += '| Package | Test | Reason | Since | Owner |\n';
    md += '|---------|------|--------|-------|-------|\n';
    for (const f of quarantinedFailures) {
      md += `| ${f.package} | ${f.fullName} | ${f.reason} | ${f.since} | ${f.owner} |\n`;
    }
    md += '\nThese failures matched an entry in `.test-quarantine.yaml` and did NOT fail the build. Track the underlying flakes via the linked issues; un-quarantine when the test stabilises.\n';
  } else {
    md += '_No quarantined tests failed in this run._\n';
  }

  if (staleEntries.length > 0) {
    md += '\n### Stale quarantine entries (>30 days)\n\n';
    md += '| Package | Test | Since | Age (days) | Owner |\n';
    md += '|---------|------|-------|-----------:|-------|\n';
    for (const e of staleEntries) {
      md += `| ${e.package} | ${e.testName} | ${e.since} | ${daysSince(e.since)} | ${e.owner} |\n`;
    }
    md += '\nThese entries have been quarantined for more than 30 days. The owner should either fix the test or escalate to a team-wide call on permanently retiring it.\n';
  }

  // appendFileSync creates the file with O_APPEND|O_CREAT if it doesn't
  // exist, so no existsSync pre-check is needed (and that pattern triggered
  // CodeQL js/file-system-race as a TOCTOU). The PR-summary step in
  // ci.yaml always runs before this script, so the file is present in
  // practice; the create-on-demand path is purely defensive.
  appendFileSync(summaryPath, md);
}

function main() {
  const policy = existsSync(quarantinePath)
    ? parseQuarantine(readFileSync(quarantinePath, 'utf8'))
    : { entries: [] };

  console.log(`Quarantine policy: ${policy.entries.length} entries.`);

  // Index by "package|testName" for O(1) lookup.
  const allowlist = new Map(
    policy.entries.map((e) => [`${e.package}|${e.testName}`, e]),
  );

  const allFailures = [];
  let scanned = 0;
  for (const pkg of PACKAGES) {
    const results = loadResults(pkg);
    if (!results) {
      console.log(`  ${pkg}: no test-results.json (skipped)`);
      continue;
    }
    const failures = collectFailures(pkg, results);
    scanned += results.numTotalTests || 0;
    console.log(`  ${pkg}: ${results.numPassedTests}/${results.numTotalTests} passed (${failures.length} failed)`);
    allFailures.push(...failures);
  }

  const realFailures = [];
  const quarantinedFailures = [];
  for (const f of allFailures) {
    const match = allowlist.get(`${f.package}|${f.fullName}`);
    if (match) {
      quarantinedFailures.push({
        ...f,
        reason: match.reason || '(no reason given)',
        since: match.since || '(unknown)',
        owner: match.owner || '(unassigned)',
      });
    } else {
      realFailures.push(f);
    }
  }

  // Stale entries: quarantined for too long without resolution.
  const staleEntries = policy.entries.filter((e) => {
    if (!e.since) return false;
    return daysSince(e.since) > STALE_DAYS;
  });
  for (const e of staleEntries) {
    console.log(`::warning::Stale quarantine entry (${daysSince(e.since)} days): ${e.package} > ${e.testName} (owner: ${e.owner || 'unassigned'})`);
  }

  console.log(`\nScanned ${scanned} results across ${PACKAGES.join(' / ')}.`);
  console.log(`${realFailures.length} real failures, ${quarantinedFailures.length} quarantined failures.`);

  appendSummary(quarantinedFailures, staleEntries);

  if (realFailures.length > 0) {
    console.error('\nReal failures (not in quarantine):');
    for (const f of realFailures) {
      console.error(`  [${f.package}] ${f.fullName}`);
    }
    console.error('\nIf one of these is a known flake, add it to .test-quarantine.yaml');
    console.error('with a reason + since + owner. See docs/governance/test-quarantine.md.');
    process.exit(1);
  }

  if (quarantinedFailures.length > 0) {
    console.log('\nAll failures matched the quarantine allowlist — exit clean.');
  }

  process.exit(0);
}

main();
