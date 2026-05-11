#!/usr/bin/env tsx
/**
 * Drift gate for the committed GraphQL schema artifact.
 *
 * Re-prints the api's current typeDefs via `print()` from `graphql`, reads
 * the checked-in `docs/api-reference/schema.graphql`, and exits non-zero
 * if they differ. Wired into CI as the `Schema Sync Check` job so a
 * typeDefs change without a matching schema-artifact update fails on the
 * PR.
 *
 * Cross-platform Node implementation (no shell redirects) so it runs the
 * same on Linux (CI) and Windows (local dev).
 */

import { print } from 'graphql';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { typeDefs } from '../src/schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(__dirname, '..', '..', '..', 'docs', 'api-reference', 'schema.graphql');

const expected = print(typeDefs) + '\n';
const actual = readFileSync(schemaPath, 'utf8');

if (expected === actual) {
  console.log('GraphQL schema is in sync with src/schema.ts.');
  process.exit(0);
}

console.error('GraphQL schema drift detected.');
console.error(`  expected (from src/schema.ts): ${expected.length} chars`);
console.error(`  actual   (committed artifact): ${actual.length} chars`);
console.error('');
console.error('To fix:');
console.error('  cd Makalu/api');
console.error('  pnpm --silent run print-schema > ../../docs/api-reference/schema.graphql');
console.error('  git add ../../docs/api-reference/schema.graphql');
console.error('  git commit -m \'docs(api): regenerate GraphQL schema\'');
process.exit(1);
