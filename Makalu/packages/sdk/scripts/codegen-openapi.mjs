#!/usr/bin/env node
/**
 * Regenerate `src/generated/openapi.ts` from the committed OpenAPI spec.
 *
 * Source:  ../../../docs/api-reference/openapi.yaml
 * Output:  ./src/generated/openapi.ts
 *
 * Why ts (not d.ts)? tsup bundles the SDK and treats .ts as input. The file
 * exports types only, so the emitted .js is essentially empty.
 *
 * Drift gate: CI runs this script and `git diff --exit-code` on the generated
 * file. The route SET is already drift-gated against the running Express
 * router (`api/scripts/list-routes.ts`); this gate is the symmetric guard on
 * the consumer side — "if the YAML changed, types must be regenerated."
 *
 * Run from anywhere:
 *   cd Makalu/packages/sdk && pnpm codegen:openapi
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import openapiTS, { astToString } from 'openapi-typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..');
const repoRoot = resolve(pkgRoot, '..', '..', '..');
const specPath = resolve(repoRoot, 'docs', 'api-reference', 'openapi.yaml');
const outPath = resolve(pkgRoot, 'src', 'generated', 'openapi.ts');

const ast = await openapiTS(new URL(`file://${specPath}`), {
  alphabetize: true,
  arrayLength: false,
  exportType: true,
});

const banner = [
  '/* eslint-disable */',
  '/**',
  ' * GENERATED FILE — DO NOT EDIT.',
  ' *',
  ' * Regenerate via:  pnpm --filter @lithosphere/sdk codegen:openapi',
  ' * Source of truth: docs/api-reference/openapi.yaml',
  ' *',
  ' * Drift-gated in CI: `openapi-codegen-check` runs the codegen and fails',
  ' * on `git diff --exit-code`. If you see a diff locally, commit it.',
  ' */',
  '',
].join('\n');

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, banner + astToString(ast), 'utf8');

console.log(`[codegen-openapi] wrote ${outPath}`);
