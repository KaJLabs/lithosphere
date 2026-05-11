#!/usr/bin/env tsx
/**
 * Print the api's GraphQL SDL to stdout.
 *
 * The schema lives as a tagged `gql` template literal in `src/schema.ts`.
 * To produce a portable, machine-readable artifact we re-print it via
 * `graphql`'s `print()` — same output as what Apollo would expose at
 * `/graphql?query={ __schema { ... } }`, but available without a running
 * server.
 *
 * Pipeline (via the `print-schema` npm script):
 *   tsx scripts/print-schema.ts > ../../docs/api-reference/schema.graphql
 *
 * Drift gate: `verify-schema-in-sync` runs this and `git diff --exit-code`
 * against the committed copy in `docs/api-reference/schema.graphql`. CI
 * fails if a typeDefs change isn't accompanied by a re-export. Same pattern
 * as the contract ABI sync gate.
 */

import { print } from 'graphql';
import { typeDefs } from '../src/schema.js';

// `typeDefs` is a parsed DocumentNode (apollo-server's `gql` returns one).
// `print` round-trips it to canonical SDL.
process.stdout.write(print(typeDefs));
process.stdout.write('\n');
