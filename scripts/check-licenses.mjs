#!/usr/bin/env node
/**
 * Lithosphere license-policy gate.
 *
 * Pipeline:
 *   1. Read `.license-policy.yaml` from repo root.
 *   2. Spawn `pnpm licenses list --recursive --prod --json` in `Makalu/`
 *      (the workspace root). pnpm walks every dependency in every package
 *      and groups them by their declared SPDX license.
 *   3. For each (license, packages[]) entry:
 *        - If the license is `deny`-listed → fail loudly.
 *        - Else if it's a compound SPDX expression, decompose it and
 *          require AND-conjuncts to all be allowed, OR-disjuncts to have
 *          at least one allowed.
 *        - Else if it's in `allow`, pass.
 *        - Else check per-package exceptions; pass if matched.
 *        - Otherwise fail as "needs review".
 *   4. Print a summary table and exit 0 (clean) or 1 (drift).
 *
 * Local invocation: `node scripts/check-licenses.mjs`
 * CI invocation:    same — wired into ci.yaml as the `license-check` job.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const policyPath = resolve(repoRoot, '.license-policy.yaml');
const workspaceDir = resolve(repoRoot, 'Makalu');

// Minimal YAML — we only handle the subset the policy file uses (lists of
// strings, lists of objects with key:value pairs, block-style scalars).
// Pulling in a real YAML dep would add a transitive dep that itself needs
// license-checking — the bootstrap problem. So we hand-parse.
function parsePolicy(yaml) {
  const out = { allow: [], deny: [], exceptions: [] };
  const lines = yaml.split(/\r?\n/);
  let section = null;
  let pendingException = null;
  let pendingReason = null;
  let reasonAccumulator = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (/^\s*#/.test(raw) || raw.trim() === '') {
      // mid-block comments and blank lines flush reason accumulators
      if (reasonAccumulator && pendingException) {
        pendingException.reason = reasonAccumulator.trim();
        reasonAccumulator = null;
      }
      continue;
    }

    // Section header (`allow:` / `deny:` / `exceptions:` at column 0).
    const sectionMatch = raw.match(/^([a-z_]+):\s*$/);
    if (sectionMatch) {
      if (pendingException) {
        if (reasonAccumulator) pendingException.reason = reasonAccumulator.trim();
        out.exceptions.push(pendingException);
        pendingException = null;
        reasonAccumulator = null;
      }
      section = sectionMatch[1];
      continue;
    }

    // List item under allow/deny (`  - MIT`).
    const simpleItem = raw.match(/^\s*-\s*([^#]+?)\s*(#.*)?$/);
    if (simpleItem && (section === 'allow' || section === 'deny')) {
      out[section].push(simpleItem[1].trim());
      continue;
    }

    // Exception block start (`  - package: ...`).
    const excStart = raw.match(/^\s*-\s+package:\s*(.+?)\s*$/);
    if (excStart && section === 'exceptions') {
      if (pendingException) {
        if (reasonAccumulator) pendingException.reason = reasonAccumulator.trim();
        out.exceptions.push(pendingException);
      }
      pendingException = { package: excStart[1].trim() };
      reasonAccumulator = null;
      continue;
    }
    if (section === 'exceptions' && pendingException) {
      const licenseMatch = raw.match(/^\s+license:\s*(.+?)\s*$/);
      if (licenseMatch) {
        pendingException.license = licenseMatch[1].trim();
        continue;
      }
      const reasonStart = raw.match(/^\s+reason:\s*\|\s*$/);
      if (reasonStart) {
        reasonAccumulator = '';
        continue;
      }
      if (reasonAccumulator !== null) {
        // accumulate multiline reason (block scalar)
        reasonAccumulator += raw.replace(/^\s{6}/, '') + '\n';
        continue;
      }
      const inlineReason = raw.match(/^\s+reason:\s*(.+?)\s*$/);
      if (inlineReason) {
        pendingException.reason = inlineReason[1].trim();
        continue;
      }
    }
  }

  if (pendingException) {
    if (reasonAccumulator) pendingException.reason = reasonAccumulator.trim();
    out.exceptions.push(pendingException);
  }
  return out;
}

function evaluateExpression(licenseExpression, allowed) {
  // Strip outer parens and split on top-level AND/OR. SPDX expressions can
  // nest but the ones we see in practice (e.g. "(MIT AND BSD-3-Clause)",
  // "(MIT OR CC0-1.0)") are flat. If a more complex one shows up we punt to
  // "needs review" rather than misjudge.
  const stripped = licenseExpression.replace(/^\(|\)$/g, '').trim();
  if (/\sAND\s.*\sOR\s|\sOR\s.*\sAND\s/.test(stripped)) {
    return { ok: false, reason: 'nested SPDX expression — needs manual review' };
  }
  if (/\sAND\s/.test(stripped)) {
    const parts = stripped.split(/\sAND\s/).map((p) => p.trim());
    const missing = parts.filter((p) => !allowed.has(p));
    return missing.length === 0
      ? { ok: true }
      : { ok: false, reason: `AND-compound — not allowed: ${missing.join(', ')}` };
  }
  if (/\sOR\s/.test(stripped)) {
    const parts = stripped.split(/\sOR\s/).map((p) => p.trim());
    const anyOk = parts.some((p) => allowed.has(p));
    return anyOk
      ? { ok: true }
      : { ok: false, reason: `OR-compound — none allowed: ${parts.join(', ')}` };
  }
  return null; // not a compound expression
}

function main() {
  const policyYaml = readFileSync(policyPath, 'utf8');
  const policy = parsePolicy(policyYaml);
  const allowed = new Set(policy.allow);
  const denied = new Set(policy.deny);
  const exceptions = new Map(
    policy.exceptions.map((e) => [`${e.package}|${e.license}`, e]),
  );

  console.log(`License policy: ${allowed.size} allowed, ${denied.size} denied, ${exceptions.size} exceptions.`);
  console.log(`Scanning workspace at ${workspaceDir}...`);

  const proc = spawnSync(
    'pnpm',
    ['licenses', 'list', '--recursive', '--prod', '--json'],
    {
      cwd: workspaceDir,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      // shell: true so Windows resolves `pnpm` → `pnpm.cmd` and Unix shells
      // still find pnpm on PATH. Without it spawnSync returns status:null
      // on Windows even though the command works from the shell directly.
      shell: true,
    },
  );

  if (proc.status !== 0) {
    console.error('pnpm licenses list failed:');
    console.error(proc.stderr);
    process.exit(2);
  }

  let licenses;
  try {
    licenses = JSON.parse(proc.stdout);
  } catch (err) {
    console.error('Failed to parse pnpm output as JSON:', err.message);
    process.exit(2);
  }

  const violations = [];
  const grantedExceptions = [];
  let packagesScanned = 0;

  for (const [licenseId, packages] of Object.entries(licenses)) {
    packagesScanned += packages.length;
    const trimmedLicense = licenseId.trim();

    if (denied.has(trimmedLicense)) {
      for (const pkg of packages) {
        violations.push({
          package: pkg.name,
          versions: pkg.versions,
          license: trimmedLicense,
          severity: 'denied',
          reason: 'license is explicitly on the deny-list',
        });
      }
      continue;
    }

    if (allowed.has(trimmedLicense)) continue;

    // Compound SPDX expression?
    if (/[()]|\sAND\s|\sOR\s/.test(trimmedLicense)) {
      const result = evaluateExpression(trimmedLicense, allowed);
      if (result?.ok) continue;
      if (result) {
        for (const pkg of packages) {
          violations.push({
            package: pkg.name,
            versions: pkg.versions,
            license: trimmedLicense,
            severity: 'needs-review',
            reason: result.reason,
          });
        }
        continue;
      }
    }

    // Per-package exception?
    for (const pkg of packages) {
      const ex = exceptions.get(`${pkg.name}|${trimmedLicense}`);
      if (ex) {
        grantedExceptions.push({ package: pkg.name, license: trimmedLicense, reason: ex.reason });
      } else {
        violations.push({
          package: pkg.name,
          versions: pkg.versions,
          license: trimmedLicense,
          severity: 'needs-review',
          reason: `license '${trimmedLicense}' not in allow-list; no exception entry for ${pkg.name}`,
        });
      }
    }
  }

  console.log(`Scanned ${packagesScanned} (name, license) entries.`);
  if (grantedExceptions.length > 0) {
    console.log(`\nExceptions granted (${grantedExceptions.length}):`);
    for (const e of grantedExceptions) {
      console.log(`  - ${e.package} (${e.license})`);
    }
  }

  if (violations.length === 0) {
    console.log('\nLicense check passed.');
    process.exit(0);
  }

  console.error(`\nLicense check failed — ${violations.length} violation(s):`);
  for (const v of violations) {
    const versions = Array.isArray(v.versions) ? v.versions.join(', ') : '?';
    console.error(`  [${v.severity}] ${v.package}@${versions}`);
    console.error(`     license: ${v.license}`);
    console.error(`     reason:  ${v.reason}`);
  }
  console.error('\nFix options:');
  console.error('  1. Replace the dependency with an allowable-license alternative.');
  console.error('  2. If review concludes the license is acceptable, add a per-package');
  console.error('     entry under `exceptions:` in .license-policy.yaml with a `reason:`.');
  console.error('  3. If a new permissive license should be globally allowed, add it');
  console.error('     to `allow:` in .license-policy.yaml.');
  process.exit(1);
}

main();
