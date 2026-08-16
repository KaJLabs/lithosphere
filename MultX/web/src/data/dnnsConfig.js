// Lithosphere DNNS (ENS fork) - deployed addresses on Kamet (chainId 900523).
// Source of truth: contracts/dnns/deployments/kamet-latest.json

import { ethers } from 'ethers5';

export const DNNS_CONFIG = {
  registry: '0x316dc15bF377F7187e5BE38BA19e673Ca823d1ab',
  baseRegistrar: '0xB3D1a8e92FFAD73Ab8a07BF37A8E1374df8B3722',
  controller: '0xb042145B0Fd44b53691b59E98bE8F9F9EB0365c5',
  publicResolver: '0x54639d978418766ccaD25ffb22C58fd5A5Df8C09',
  reverseRegistrar: '0xDeFae50866342C8f72bd03292FFeAeb53eC781C2',
  priceOracle: '0xD3E0f31AB733C845ED9E4121d547Ca05E99384EB',
  nameWrapper: '0xc47E49259b8dDa2C9D57941E1a52747E4c721Cb9',
  tld: 'litho',
  minCommitmentAge: 60,
  maxCommitmentAge: 86400,
  // Names are effectively permanent: 100 years × 365 days × 86400 s. The
  // BaseRegistrar requires a finite duration so we just pass a value large
  // enough that it never matters in practice. ZeroPriceOracle keeps cost = 0.
  defaultDuration: 100 * 365 * 86400,
  reservedNames: ['litho', 'kamet', 'makalu', 'dex', 'treasury', 'team', 'faucet', 'quantts', 'bridge'],
};

// Filled after M3 v1 resolver deployments. The UI keeps these visible so a
// deployment can be pasted into config without changing component code.
export const CCIP_RESOLVERS = {
  11155111: { name: 'Ethereum Sepolia', address: '' },
  97: { name: 'BNB Testnet', address: '' },
  84532: { name: 'Base Sepolia', address: '' },
};

export const REGISTRY_ABI = [
  'function owner(bytes32 node) view returns (address)',
  'function resolver(bytes32 node) view returns (address)',
  'function setResolver(bytes32 node, address resolver)',
  'function setOwner(bytes32 node, address owner)',
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function setApprovalForAll(address operator, bool approved)',
];

export const BASE_REGISTRAR_ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function nameExpires(uint256 tokenId) view returns (uint256)',
  'function available(uint256 tokenId) view returns (bool)',
  'function transferFrom(address from, address to, uint256 tokenId)',
];

export const CONTROLLER_ABI = [
  'function valid(string name) pure returns (bool)',
  'function available(string name) view returns (bool)',
  'function rentPrice(string name, uint256 duration) view returns (tuple(uint256 base, uint256 premium))',
  'function makeCommitment(string name, address owner, uint256 duration, bytes32 secret) pure returns (bytes32)',
  'function commit(bytes32 commitment)',
  'function register(string name, address owner, uint256 duration, bytes32 secret) payable',
  'function commitments(bytes32) view returns (uint256)',
  // Custom errors — without these in the ABI a register/commit revert decodes as
  // the opaque "missing revert data ... reverted without a reason string". With
  // them, an eth_call preflight surfaces errorName so the UI can explain the
  // commit-reveal gate (see completeRegistration in namesService).
  'error CommitmentTooNew(bytes32)',
  'error CommitmentTooOld(bytes32)',
  'error UnexpiredCommitmentExists(bytes32)',
  'error NameNotAvailable(string)',
  'error InsufficientValue()',
  'error MaxCommitmentAgeTooLow()',
];

export const RESOLVER_ABI = [
  'function addr(bytes32 node) view returns (address)',
  'function setAddr(bytes32 node, address addr)',
  'function name(bytes32 node) view returns (string)',
  'function text(bytes32 node, string key) view returns (string)',
  'function setText(bytes32 node, string key, string value)',
];

export const NAME_WRAPPER_ABI = [
  'function ownerOf(uint256 id) view returns (address)',
  'function isWrapped(bytes32 node) view returns (bool)',
  'function wrap(bytes name, address wrappedOwner, address resolver)',
  'function setResolver(bytes32 node, address resolver)',
  'function setSubnodeOwner(bytes32 parentNode, string label, address owner, uint32 fuses, uint64 expiry) returns (bytes32)',
  'function setSubnodeRecord(bytes32 parentNode, string label, address owner, address resolver, uint64 ttl, uint32 fuses, uint64 expiry) returns (bytes32)',
];

export const STABLE_PRICE_ORACLE_ABI = [
  'function price(string name, uint256 expires, uint256 duration) view returns (tuple(uint256 base, uint256 premium))',
  'function price5Letter() view returns (uint256)',
  'function price4Letter() view returns (uint256)',
  'function price3Letter() view returns (uint256)',
  'function setPrices(uint256 price5Letter, uint256 price4Letter, uint256 price3Letter)',
];

export const labelhash = (label) =>
  ethers.utils.keccak256(ethers.utils.toUtf8Bytes(label));

export const namehash = (name) => {
  let node = '0x0000000000000000000000000000000000000000000000000000000000000000';
  if (!name) return node;
  const labels = name.split('.').reverse();
  for (const label of labels) {
    const lh = labelhash(label);
    node = ethers.utils.keccak256(
      ethers.utils.solidityPack(['bytes32', 'bytes32'], [node, lh])
    );
  }
  return node;
};

// Strip .litho suffix and validate label characters (lowercase a-z 0-9 hyphen, 3+ chars).
export const normalizeLabel = (input) => {
  if (!input) return '';
  let label = String(input).trim().toLowerCase();
  if (label.endsWith(`.${DNNS_CONFIG.tld}`)) {
    label = label.slice(0, -(DNNS_CONFIG.tld.length + 1));
  }
  return label;
};

export const isValidLabel = (label) => {
  if (!label || label.length < 3) return false;
  return /^[a-z0-9-]+$/.test(label) && !label.startsWith('-') && !label.endsWith('-');
};

export const fullName = (label) => `${label}.${DNNS_CONFIG.tld}`;
