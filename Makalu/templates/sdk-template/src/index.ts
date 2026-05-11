/**
 * Starter scaffold for building a custom SDK on top of Lithosphere.
 *
 * Copied verbatim by `create-litho-app` when the user picks the `sdk`
 * template. After scaffolding, you own the resulting package — rename it,
 * publish it under your scope, build your domain abstractions on top.
 *
 * What this scaffold gives you:
 *   - A working `pnpm install && pnpm build && pnpm test` loop
 *   - `@lithosphere/sdk` already installed as a dependency
 *   - The `LithosphereExtensions` example class showing the pattern for
 *     wrapping the official client with your own domain methods
 *
 * What it deliberately does NOT do:
 *   - Re-export the public surface of `@lithosphere/sdk`. Consumers should
 *     `import { LithoClient } from '@lithosphere/sdk'` directly. This
 *     package's purpose is to *add* to the SDK, not relay it.
 */

export {
  LithosphereExtensions,
  type RecentActivity,
  type RecentActivityEntry,
} from './extensions.js';
