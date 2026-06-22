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
  return v.endsWith(`.${DNNS.tld}`) && v.length > DNNS.tld.length + 1;
}

function fullName(input: string): string {
  const v = input.trim().toLowerCase();
  return v.endsWith(`.${DNNS.tld}`) ? v : `${v}.${DNNS.tld}`;
}

const forwardCache = new Map<string, string | null>();
const reverseCache = new Map<string, string | null>();

/** Resolve a `.litho` name to an EVM address, or null if unregistered/unset. */
export async function resolveName(input: string): Promise<string | null> {
  const name = fullName(input);
  if (forwardCache.has(name)) return forwardCache.get(name) ?? null;

  let result: string | null = null;
  try {
    const node = namehash(name);
    const registry = new Contract(DNNS.registry, REGISTRY_ABI, provider());
    const resolverAddr: string = await registry.resolver(node);
    if (resolverAddr && resolverAddr !== ZeroAddress) {
      const resolver = new Contract(resolverAddr, RESOLVER_ABI, provider());
      const addr: string = await resolver.addr(node);
      if (addr && addr !== ZeroAddress) result = getAddress(addr);
    }
  } catch {
    result = null;
  }
  forwardCache.set(name, result);
  return result;
}

/** Reverse-resolve an EVM address to its primary `.litho` name, or null. */
export async function lookupAddress(address: string): Promise<string | null> {
  if (!isAddress(address)) return null;
  const key = address.toLowerCase();
  if (reverseCache.has(key)) return reverseCache.get(key) ?? null;

  let result: string | null = null;
  try {
    const reverseNode = namehash(`${key.slice(2)}.addr.reverse`);
    const registry = new Contract(DNNS.registry, REGISTRY_ABI, provider());
    const resolverAddr: string = await registry.resolver(reverseNode);
    if (resolverAddr && resolverAddr !== ZeroAddress) {
      const resolver = new Contract(resolverAddr, RESOLVER_ABI, provider());
      const name: string = await resolver.name(reverseNode);
      if (name) result = name;
    }
  } catch {
    result = null;
  }
  reverseCache.set(key, result);
  return result;
}
