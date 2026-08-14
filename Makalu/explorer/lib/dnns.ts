/**
 * DNNS (Lithosphere Decentralized Naming Name Service) resolution.
 *
 * DNNS is an ENS fork deployed on **Kamet** (chainId 900523). Names live on
 * Kamet, so the Makalu explorer resolves them with a read-only RPC call to the
 * Kamet registry (same approach as the names-portal). EVM addresses are shared
 * across Lithosphere chains, so a `.litho` name resolves to the same 0x address
 * usable on Makalu.
 *
 * Forward:  name → registry.resolver(node) → resolver.addr(node)
 * Reverse:  addr → registry.resolver(reverseNode) → resolver.name(reverseNode)
 */
import { Contract, JsonRpcProvider, concat, getAddress, isAddress, keccak256, toUtf8Bytes, ZeroAddress } from 'ethers';

export const DNNS = {
  rpcUrl: 'https://rpc-3.litho.ai',
  chainId: 900523,
  registry: '0x316dc15bF377F7187e5BE38BA19e673Ca823d1ab',
  tld: 'litho',
} as const;

const REGISTRY_ABI = ['function resolver(bytes32 node) view returns (address)'];
const RESOLVER_ABI = [
  'function addr(bytes32 node) view returns (address)',
  'function name(bytes32 node) view returns (string)',
];

let cachedProvider: JsonRpcProvider | null = null;
function provider(): JsonRpcProvider {
  if (!cachedProvider) {
    cachedProvider = new JsonRpcProvider(DNNS.rpcUrl, { chainId: DNNS.chainId, name: 'lithosphere-kamet' });
  }
  return cachedProvider;
}

const ZERO_NODE = '0x' + '00'.repeat(32);

/** ENS namehash (computed manually to avoid ENS normalization edge cases on reverse nodes). */
export function namehash(name: string): string {
  let node = ZERO_NODE;
  if (!name) return node;
  for (const label of name.split('.').reverse()) {
    const labelHash = keccak256(toUtf8Bytes(label));
    node = keccak256(concat([node, labelHash]));
  }
  return node;
}

/** True if `input` looks like a `.litho` DNNS name. */
export function isDnnsName(input: string): boolean {
  const v = input.trim().toLowerCase();
  return v.endsWith(`.${DNNS.tld}`) && normalizeDnnsName(v) !== null;
}

/** Normalize the supported v0 2LD format, or return null when malformed. */
export function normalizeDnnsName(input: string): string | null {
  const v = input.trim().toLowerCase();
  const suffix = `.${DNNS.tld}`;
  const label = v.endsWith(suffix) ? v.slice(0, -suffix.length) : v;
  if (label.length < 3 || !/^[a-z0-9-]+$/.test(label)) return null;
  if (label.startsWith('-') || label.endsWith('-')) return null;
  return `${label}${suffix}`;
}

export class DnnsResolutionError extends Error {
  constructor(direction: 'forward' | 'reverse', options?: ErrorOptions) {
    super(`DNNS ${direction} resolution is unavailable`, options);
    this.name = 'DnnsResolutionError';
  }
}

/** Resolve a `.litho` name to an EVM address, or null if unregistered/unset. */
export async function resolveName(input: string): Promise<string | null> {
  const name = normalizeDnnsName(input);
  if (!name) return null;
  try {
    const node = namehash(name);
    const registry = new Contract(DNNS.registry, REGISTRY_ABI, provider());
    const resolverAddr: string = await registry.resolver(node);
    if (resolverAddr && resolverAddr !== ZeroAddress) {
      const resolver = new Contract(resolverAddr, RESOLVER_ABI, provider());
      const addr: string = await resolver.addr(node);
      if (addr && addr !== ZeroAddress) return getAddress(addr);
    }
    return null;
  } catch (cause) {
    throw new DnnsResolutionError('forward', { cause });
  }
}

/** Reverse-resolve an EVM address to its primary `.litho` name, or null. */
export async function lookupAddress(address: string): Promise<string | null> {
  if (!isAddress(address)) return null;
  const key = address.toLowerCase();
  try {
    const reverseNode = namehash(`${key.slice(2)}.addr.reverse`);
    const registry = new Contract(DNNS.registry, REGISTRY_ABI, provider());
    const resolverAddr: string = await registry.resolver(reverseNode);
    if (resolverAddr && resolverAddr !== ZeroAddress) {
      const resolver = new Contract(resolverAddr, RESOLVER_ABI, provider());
      const name: string = await resolver.name(reverseNode);
      if (!name || !isDnnsName(name)) return null;

      // A reverse resolver is not authoritative by itself. Confirm that the
      // returned name resolves back to the address before displaying it.
      const normalizedName = normalizeDnnsName(name);
      if (!normalizedName) return null;
      const forwardAddress = await resolveName(normalizedName);
      if (forwardAddress?.toLowerCase() === key) return normalizedName;
    }
    return null;
  } catch (cause) {
    throw new DnnsResolutionError('reverse', { cause });
  }
}
