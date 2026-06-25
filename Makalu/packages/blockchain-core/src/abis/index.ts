/**
 * Typed ABI exports for the contracts that ship with Lithosphere:
 *  - LEP100: the LEP-100 fungible/NFT token standard
 *  - WLITHO: wrapped LITHO (EIP-20 compatible)
 *  - LITHONative: native LITHO interface for cross-chain ops
 *
 * `as const` lets `viem`, `abitype`, and similar tooling infer return / input
 * types directly from the ABI at the call site:
 *
 * @example
 * ```ts
 * import { LEP100_ABI } from '@lithosphere/blockchain-core';
 * import { createPublicClient, http } from 'viem';
 *
 * const client = createPublicClient({ transport: http('https://rpc.litho.ai') });
 * const balance = await client.readContract({
 *   address: '0x...',
 *   abi: LEP100_ABI,
 *   functionName: 'balanceOf',
 *   args: ['0xowner...'],
 * });
 * // balance is bigint, inferred from the ABI
 * ```
 */
import LEP100 from './LEP100.json' with { type: 'json' };
import LITHONative from './LITHONative.json' with { type: 'json' };
import WLITHO from './WLITHO.json' with { type: 'json' };

/**
 * Note on typing: these are exported as the imported JSON value (not `as const`).
 * TypeScript can't preserve const-ness across JSON imports during dts emission.
 * Consumers who want strict `abitype` / `viem` inference can re-assert at the
 * call site: `const abi = LEP100_ABI as const`. Most consumers don't need it —
 * `viem.readContract({ abi: LEP100_ABI, functionName: 'balanceOf', args: [...] })`
 * still type-checks because viem accepts `readonly Abi`.
 */
export const LEP100_ABI = LEP100;
export const WLITHO_ABI = WLITHO;
export const LITHONATIVE_ABI = LITHONative;
