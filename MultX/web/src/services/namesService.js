import { ethers } from 'ethers5';
import {
  DNNS_CONFIG,
  CCIP_RESOLVERS,
  REGISTRY_ABI,
  BASE_REGISTRAR_ABI,
  CONTROLLER_ABI,
  NAME_WRAPPER_ABI,
  RESOLVER_ABI,
  namehash,
  labelhash,
  fullName,
  normalizeLabel,
} from '../data/dnnsConfig';

// Mirror dexService: dev uses /rpc-proxy, prod uses VITE_EVM_RPC_URL or
// the public default. Avoids ethers v5 eager network detection.
const READ_RPC = import.meta.env.DEV
  ? '/rpc-proxy'
  : (import.meta.env.VITE_EVM_RPC_URL || 'https://rpc-3.litho.ai');
const CHAIN_ID = Number(import.meta.env.VITE_EVM_CHAIN_ID) || 900523;
// Kamet sentries cap eth_getLogs at 10 000 blocks; a fromBlock:0 scan is
// rejected. Pin VITE_DNNS_CONTROLLER_START_BLOCK to the controller deploy height
// for a complete history scan; otherwise we bound to a recent window.
const CONTROLLER_START_BLOCK = Number(import.meta.env.VITE_DNNS_CONTROLLER_START_BLOCK || 0);
const LOG_RANGE_CAP = 9000;
const MAX_NAME_CHUNKS = 12;

const readProvider = () =>
  new ethers.providers.StaticJsonRpcProvider(READ_RPC, {
    chainId: CHAIN_ID,
    name: 'lithosphere-kamet',
  });

// Page a raw getLogs over [fromBlock, toBlock] into <= LOG_RANGE_CAP windows,
// skipping any window the RPC rejects (range cap / pruned height).
const getLogsChunked = async (provider, baseFilter, fromBlock, toBlock, span = LOG_RANGE_CAP) => {
  const out = [];
  for (let start = fromBlock; start <= toBlock; start += span) {
    const end = Math.min(start + span - 1, toBlock);
    try {
      const part = await provider.getLogs({ ...baseFilter, fromBlock: start, toBlock: end });
      if (part.length) out.push(...part);
    } catch {
      // Best effort: skip windows the RPC refuses.
    }
  }
  return out;
};

const dnsEncodeName = (name) => {
  const labels = String(name)
    .trim()
    .toLowerCase()
    .split('.')
    .filter(Boolean);

  if (!labels.length) throw new Error('Name is required.');

  const parts = [];
  for (const label of labels) {
    const bytes = ethers.utils.toUtf8Bytes(label);
    if (!bytes.length || bytes.length > 255) {
      throw new Error('Each DNS label must be between 1 and 255 bytes.');
    }
    parts.push(ethers.utils.hexlify(Uint8Array.from([bytes.length])));
    parts.push(ethers.utils.hexlify(bytes));
  }
  parts.push('0x00');
  return ethers.utils.hexConcat(parts);
};

// Read-side ------------------------------------------------------------------

export const isAvailable = async (label) => {
  const c = new ethers.Contract(DNNS_CONFIG.controller, CONTROLLER_ABI, readProvider());
  return c.available(label);
};

export const getRegistryOwner = async (label) => {
  const reg = new ethers.Contract(DNNS_CONFIG.registry, REGISTRY_ABI, readProvider());
  return reg.owner(namehash(fullName(label)));
};

export const getOwner = async (label) => {
  const node = namehash(fullName(label));
  const registryOwner = await getRegistryOwner(label);
  if (
    DNNS_CONFIG.nameWrapper &&
    registryOwner.toLowerCase() === DNNS_CONFIG.nameWrapper.toLowerCase()
  ) {
    const wrapper = new ethers.Contract(DNNS_CONFIG.nameWrapper, NAME_WRAPPER_ABI, readProvider());
    const wrappedOwner = await wrapper.ownerOf(ethers.BigNumber.from(node)).catch(() => null);
    if (wrappedOwner) return wrappedOwner;
  }
  return registryOwner;
};

export const getAddress = async (label) => {
  const node = namehash(fullName(label));
  const reg = new ethers.Contract(DNNS_CONFIG.registry, REGISTRY_ABI, readProvider());
  const resolverAddr = await reg.resolver(node);
  if (resolverAddr === ethers.constants.AddressZero) return null;
  const resolver = new ethers.Contract(resolverAddr, RESOLVER_ABI, readProvider());
  try {
    return await resolver.addr(node);
  } catch {
    return null;
  }
};

export const getNameExpiry = async (label) => {
  const baseReg = new ethers.Contract(DNNS_CONFIG.baseRegistrar, BASE_REGISTRAR_ABI, readProvider());
  const tokenId = ethers.BigNumber.from(labelhash(label));
  const exp = await baseReg.nameExpires(tokenId);
  return Number(exp.toString()) * 1000;
};

// Returns details about a label: { available, owner, addr, expiry }.
export const lookupName = async (label) => {
  const [available, owner, addr] = await Promise.all([
    isAvailable(label).catch(() => false),
    getOwner(label).catch(() => ethers.constants.AddressZero),
    getAddress(label).catch(() => null),
  ]);
  let expiry = null;
  if (!available) {
    expiry = await getNameExpiry(label).catch(() => null);
  }
  return { label, available, owner, addr, expiry };
};

export const resolveOnChain = async (nameOrLabel, chainId) => {
  const numericChainId = Number(chainId);
  const chain = CCIP_RESOLVERS[numericChainId];
  if (!chain) throw new Error('Unsupported resolution chain.');

  // v1 UI confirmation is intentionally transparent: CCIP destination
  // resolvers read Kamet through the gateway, so the explorer can show the
  // canonical Kamet resolver result while deployments are being filled in.
  const label = normalizeLabel(nameOrLabel);
  const address = await getAddress(label);
  return {
    chainId: numericChainId,
    chainName: chain.name,
    resolver: chain.address,
    address,
  };
};

export const getNamesByAddress = async (address) => {
  if (!ethers.utils.isAddress(address)) return null;
  const reverseName = `${address.toLowerCase().slice(2)}.addr.reverse`;
  const node = namehash(reverseName);
  const reg = new ethers.Contract(DNNS_CONFIG.registry, REGISTRY_ABI, readProvider());
  const resolverAddr = await reg.resolver(node);
  if (resolverAddr === ethers.constants.AddressZero) return null;
  const resolver = new ethers.Contract(resolverAddr, RESOLVER_ABI, readProvider());
  try {
    const name = await resolver.name(node);
    return name || null;
  } catch {
    return null;
  }
};

// Write-side -----------------------------------------------------------------

// Step 1 of registration. Returns { commitment, secret }.
export const commitRegistration = async ({ signer, label, owner, durationSeconds = DNNS_CONFIG.defaultDuration, secret }) => {
  const c = new ethers.Contract(DNNS_CONFIG.controller, CONTROLLER_ABI, signer);
  const finalSecret = secret || ethers.utils.hexlify(ethers.utils.randomBytes(32));
  const commitment = await c.makeCommitment(label, owner, durationSeconds, finalSecret);
  const tx = await c.commit(commitment);
  const receipt = await tx.wait();
  return { commitment, secret: finalSecret, txHash: receipt.transactionHash };
};

// Maps a controller custom-error name to a plain-language explanation of the
// commit-reveal gate. Ethermint strips revert data on eth_estimateGas (so the
// raw MetaMask path shows "missing revert data ... reverted without a reason
// string"), but an explicit eth_call preflight DOES return the error data, which
// — with the errors now in CONTROLLER_ABI — ethers decodes into errorName.
const REGISTER_ERROR_HINTS = {
  CommitmentTooNew: 'Your commitment is still maturing. Wait the full 60s after the commit transaction, then register.',
  CommitmentTooOld: 'Your commitment expired (older than 24h). Start the registration again to submit a fresh commit.',
  UnexpiredCommitmentExists: 'A commitment for this name is already pending. Wait for it to mature, then register.',
  NameNotAvailable: 'That name is no longer available.',
  InsufficientValue: 'Registration requires a fee that was not provided.',
};

// Step 2 of registration. Caller must wait minCommitmentAge seconds after commit.
export const completeRegistration = async ({ signer, label, owner, durationSeconds = DNNS_CONFIG.defaultDuration, secret }) => {
  const c = new ethers.Contract(DNNS_CONFIG.controller, CONTROLLER_ABI, signer);
  // Preflight via eth_call so a commit-reveal failure becomes a clear message
  // instead of the opaque estimateGas revert.
  try {
    await c.callStatic.register(label, owner, durationSeconds, secret, { value: 0 });
  } catch (err) {
    const name = err?.errorName || err?.error?.errorName;
    const hint = name && REGISTER_ERROR_HINTS[name];
    if (hint) throw new Error(hint);
    throw err;
  }
  const tx = await c.register(label, owner, durationSeconds, secret, { value: 0 });
  const receipt = await tx.wait();
  return receipt.transactionHash;
};

// Optional follow-up: set resolver + addr record for a freshly registered name.
export const setAddressRecord = async ({ signer, label, address }) => {
  const node = namehash(fullName(label));
  const reg = new ethers.Contract(DNNS_CONFIG.registry, REGISTRY_ABI, signer);
  const currentResolver = await reg.resolver(node);
  if (currentResolver.toLowerCase() !== DNNS_CONFIG.publicResolver.toLowerCase()) {
    const registryOwner = await reg.owner(node);
    let tx1;
    if (
      DNNS_CONFIG.nameWrapper &&
      registryOwner.toLowerCase() === DNNS_CONFIG.nameWrapper.toLowerCase()
    ) {
      const wrapper = new ethers.Contract(DNNS_CONFIG.nameWrapper, NAME_WRAPPER_ABI, signer);
      tx1 = await wrapper.setResolver(node, DNNS_CONFIG.publicResolver);
    } else {
      tx1 = await reg.setResolver(node, DNNS_CONFIG.publicResolver);
    }
    await tx1.wait();
  }

  const resolver = new ethers.Contract(DNNS_CONFIG.publicResolver, RESOLVER_ABI, signer);
  const tx2 = await resolver.setAddr(node, address);
  const r2 = await tx2.wait();
  return r2.transactionHash;
};

export const createSubdomain = async ({
  signer,
  parentLabel,
  subLabel,
  owner,
  expirySeconds,
}) => {
  if (!DNNS_CONFIG.nameWrapper) {
    throw new Error('NameWrapper address is not configured yet.');
  }
  if (!ethers.utils.isAddress(owner)) throw new Error('Subdomain owner must be a valid address.');

  const parentNode = namehash(fullName(parentLabel));
  const parentName = fullName(parentLabel);
  const childName = `${subLabel}.${fullName(parentLabel)}`;
  const childNode = namehash(childName);
  const expiry = expirySeconds || Math.floor(Date.now() / 1000) + DNNS_CONFIG.defaultDuration;
  const wrapper = new ethers.Contract(DNNS_CONFIG.nameWrapper, NAME_WRAPPER_ABI, signer);
  const registry = new ethers.Contract(DNNS_CONFIG.registry, REGISTRY_ABI, signer);
  const parentOwner = await signer.getAddress();
  let approvalTxHash = null;
  let wrapTxHash = null;

  const isParentWrapped = await wrapper.isWrapped(parentNode).catch(() => false);
  if (!isParentWrapped) {
    const wrapperApproved = await registry
      .isApprovedForAll(parentOwner, DNNS_CONFIG.nameWrapper)
      .catch(() => false);
    if (!wrapperApproved) {
      const approvalTx = await registry.setApprovalForAll(DNNS_CONFIG.nameWrapper, true);
      const approvalReceipt = await approvalTx.wait();
      approvalTxHash = approvalReceipt.transactionHash;
    }

    const wrapTx = await wrapper.wrap(
      dnsEncodeName(parentName),
      parentOwner,
      DNNS_CONFIG.publicResolver
    );
    const wrapReceipt = await wrapTx.wait();
    wrapTxHash = wrapReceipt.transactionHash;
  }

  const tx = await wrapper.setSubnodeRecord(
    parentNode,
    subLabel,
    owner,
    DNNS_CONFIG.publicResolver,
    0,
    0,
    expiry
  );
  const receipt = await tx.wait();

  let addrTxHash = null;
  try {
    const resolver = new ethers.Contract(DNNS_CONFIG.publicResolver, RESOLVER_ABI, signer);
    const addrTx = await resolver.setAddr(childNode, owner);
    const addrReceipt = await addrTx.wait();
    addrTxHash = addrReceipt.transactionHash;
  } catch {
    // Some NameWrapper ownership modes require the child owner to set records.
  }

  return {
    name: childName,
    node: childNode,
    approvalTxHash,
    wrapTxHash,
    txHash: receipt.transactionHash,
    addrTxHash,
  };
};

// In-memory cache for owned-names lists (per address).
const _namesOwnedByCache = new Map();

export const getCachedNamesOwnedBy = (address) => {
  if (!address) return null;
  const entry = _namesOwnedByCache.get(address.toLowerCase());
  return entry ? entry.names : null;
};

// Returns an array of { tokenId, name, addr, expiry } objects for all
// .litho names currently owned by `address`.  Scans NameRegistered events
// on the controller (indexed by owner topic) then verifies ownerOf for each.
export const getNamesOwnedBy = async (address) => {
  if (!ethers.utils.isAddress(address)) return [];
  const normalizedAddress = address.toLowerCase();
  const provider = readProvider();

  const controllerInterface = new ethers.utils.Interface([
    'event NameRegistered(string name, bytes32 indexed label, address indexed owner, uint256 cost, uint256 expires)',
  ]);
  const eventTopic = controllerInterface.getEventTopic('NameRegistered');
  const addressTopic = ethers.utils.hexZeroPad(normalizedAddress, 32);

  let logs = [];
  try {
    const tip = await provider.getBlockNumber();
    const fromBlock = CONTROLLER_START_BLOCK || Math.max(0, tip - LOG_RANGE_CAP * MAX_NAME_CHUNKS);
    logs = await getLogsChunked(
      provider,
      { address: DNNS_CONFIG.controller, topics: [eventTopic, null, addressTopic] },
      fromBlock,
      tip
    );
  } catch {
    return [];
  }

  if (!logs.length) {
    _namesOwnedByCache.set(normalizedAddress, { names: [] });
    return [];
  }

  const baseReg = new ethers.Contract(DNNS_CONFIG.baseRegistrar, BASE_REGISTRAR_ABI, provider);

  const settled = await Promise.allSettled(
    logs.map(async (log) => {
      const parsed = controllerInterface.parseLog(log);
      const { name, label, expires } = parsed.args;
      const tokenId = ethers.BigNumber.from(label);
      const currentOwner = await baseReg.ownerOf(tokenId).catch(() => null);
      if (!currentOwner || currentOwner.toLowerCase() !== normalizedAddress) return null;
      const addr = await getAddress(name).catch(() => null);
      return { tokenId: tokenId.toString(), name, addr, expiry: Number(expires.toString()) * 1000 };
    })
  );

  const names = settled
    .filter((r) => r.status === 'fulfilled' && r.value)
    .map((r) => r.value);

  _namesOwnedByCache.set(normalizedAddress, { names });
  return names;
};

// localStorage helpers for persisting commit secrets across reloads.
const STORAGE_PREFIX = 'litho-dnns:commit:';

export const saveCommit = (label, data) => {
  try {
    localStorage.setItem(STORAGE_PREFIX + label, JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch {
    // localStorage can be unavailable in privacy modes.
  }
};

export const loadCommit = (label) => {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + label);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearCommit = (label) => {
  try {
    localStorage.removeItem(STORAGE_PREFIX + label);
  } catch {
    // Best-effort cleanup.
  }
};
