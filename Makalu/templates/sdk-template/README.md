# Lithosphere SDK starter

Starter scaffold for **building a custom SDK** on top of Lithosphere.
Copied verbatim by `create-litho-app` when you pick the `sdk` template.

This is **not** the published `@lithosphere/sdk` — that package is already a
runtime dependency of this scaffold. The scaffold is here to give you the
publishing infrastructure (tsup dual-output, vitest, linting, sizing) plus
one worked example of layering domain helpers on top of `LithoClient`.

## Quick start

```bash
# Inside the scaffolded directory:
pnpm install
pnpm test
pnpm build
```

## What you get

```
src/
  index.ts            # Re-exports your extension class (rename freely)
  extensions.ts       # Example: LithosphereExtensions wrapping LithoClient
  __tests__/
    extensions.test.ts
```

`extensions.ts` shows the pattern: own a `LithoClient`, expose your own
methods, let the SDK handle retry/backoff/typed errors at the RPC layer.
Replace its body with whatever your project actually needs (or delete it
entirely — the directory structure is the load-bearing part).

## Using the underlying SDK

The SDK is already a dependency, so you can `import` from it directly:

```typescript
import { LithoClient, NETWORKS, LithoError, ErrorCode } from '@lithosphere/sdk';

const client = new LithoClient('mainnet');
const { formatted, symbol } = await client.getBalance('0x22d...387');
console.log(`${formatted} ${symbol}`);
```

For the full surface (LEP-100 ABI exports, network registry, error codes,
retry config) see [`@lithosphere/sdk`](https://www.npmjs.com/package/@lithosphere/sdk).

## Layering on top — the `LithosphereExtensions` example

```typescript
import { LithoClient } from '@lithosphere/sdk';
import { LithosphereExtensions } from 'your-package-name';

const client = new LithoClient('mainnet');
const ext = new LithosphereExtensions(client);

const activity = await ext.recentActivity(
  '0x22d279d24f0b7ca5d49c5a7a7f032da416f72387',
  ['0xtxhash1...', '0xtxhash2...'],
);

console.log(`${activity.count} known txs for ${activity.address}`);
for (const entry of activity.entries) {
  console.log(`  ${entry.hash}: ${entry.status} at block ${entry.blockNumber}`);
}
```

## Publishing your package

1. **Rename it.** Edit `package.json` — change `name`, `description`,
   `repository`, `author`, `keywords`, `homepage`, `bugs.url`.
2. **Drop `"private": true`** when you're ready to publish.
3. **Pick an npm scope you control** — the scaffold uses `@lithosphere/...`
   placeholders that are reserved for the Lithosphere org.
4. `pnpm build` → produces `dist/index.{mjs,cjs,d.ts,d.cts}`.
5. `npm publish --access public` (or `pnpm publish` if you use pnpm's
   publish flow).

## What changed in this scaffold refresh

Prior versions of this scaffold copied `@lithosphere/sdk`'s `client.ts`,
`types.ts`, and an ABI file directly into the new project. That made the
scaffold easy to fork but locked the resulting package onto a frozen
snapshot of the SDK — a published `@lithosphere/sdk` bug fix never reached
the user.

Today the scaffold depends on `@lithosphere/sdk` as a regular npm
dependency. Use `pnpm update @lithosphere/sdk` to pick up upstream fixes;
build your domain-specific work in `extensions.ts` (or your own renamed
modules). If you genuinely need to fork the client — e.g. for a non-EVM
chain — clone the SDK's `Makalu/packages/sdk/` directory instead.
