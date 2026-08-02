// MultX Bridge — deployed addresses on Kamet (chainId 900523).
// Update BRIDGE_ADDRESS after running contracts/scripts/02-redeploy-bridge-hardened.js
// Tokens: canonical LEP100 addresses on Kamet (source: faucet-assets.json + DEX config)

export const BRIDGE_ADDRESS = import.meta.env.VITE_BRIDGE_CONTRACT_ADDRESS ||
  '0x3a896BDF3a1088287FA84aB5a43bB30e2535F263'; // hardened redeploy 2026-05-09

export const BRIDGE_TOKENS = [
  { symbol: 'wLITHO', name: 'Wrapped Lithosphere', address: '0xC0FC628e3aB128fe387e7ed5e729bD809C017888', decimals: 18 },
  { symbol: 'QTT',    name: 'Quantts',             address: '0x16EE7127C9E03e29ca5727e23dd7CB03D283cDBe', decimals: 18 },
  { symbol: 'COLLE',  name: 'Colle AI',            address: '0x0573f66cb4bC34618e7AB8a941F7883DD2515dCA', decimals: 18 },
  { symbol: 'LitBTC', name: 'LitBTC',              address: '0x3A8D5FdC6c8dA9f14C535424b6F7206eC1996016', decimals: 18 },
  { symbol: 'LAX',    name: 'Lithosphere Algo',    address: '0xe8f504f9cE5391Fb5968b317f0b24b8A0306ACeb', decimals: 18 },
  { symbol: 'JOT',    name: 'Jot Art',             address: '0x6AE14CEb3962664b13c5dEF29EB172De76bd0ac9', decimals: 18 },
  { symbol: 'IMAGE',  name: 'Imagen Network',      address: '0x8Ba6E3A0759144245f2939eB54164e32bb78B8E0', decimals: 18 },
  { symbol: 'AGII',   name: 'AGII',                address: '0x17D506aF1d0Dc2f4f64f15748a5aC46FAd3f06D7', decimals: 18 },
  { symbol: 'BLDR',   name: 'Built AI',            address: '0xF05f1F79273874E554F02ce06585E16132a3B62B', decimals: 18 },
  { symbol: 'FGPT',   name: 'FurGPT',              address: '0x2F366c6350A6b211f6D6F847c3D56738C2E847ca', decimals: 18 },
  { symbol: 'MUSA',   name: 'Mansa AI',            address: '0x17A357262097B4e70acFfe8B71bC61e8bBcc3B42', decimals: 18 },
];

export const BRIDGE_DESTINATION_CHAINS = [
  { chainId: 11155111, name: 'Ethereum Sepolia',  symbol: 'ETH' },
  { chainId: 84532,    name: 'Base Sepolia',      symbol: 'ETH' },
  { chainId: 97,       name: 'BNB Chain Testnet', symbol: 'BNB' },
];

// Per-chain bridge + wrapped token addresses for the Inbound direction.
// Populated from contracts/deployments/{sepolia,base_sepolia}-bridge-latest.json
export const DEST_CHAIN_DEPLOYMENTS = {
  11155111: {
    name: 'Ethereum Sepolia',
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorer: 'https://sepolia.etherscan.io',
    bridge: '0xfdA3b83FE8438123eAF5153945A46F8fcF6175f4',
    nativeSymbol: 'ETH',
    wrappedTokens: [
      // wrappedAddress, kametOriginAddress, originSymbol — wrapped symbol is "w{origin}"
      ['0xbB86A8ed1170f5Be9cCC7C8df3541F9aA0f7e8F3', '0x72791d72B6097D487cEC58605A62396c50C08b69', 'DOGE'],
      ['0x1904e61aD439D2A9c18305D53Db296Af6844DC7b', '0xC0FC628e3aB128fe387e7ed5e729bD809C017888', 'wLITHO'],
      ['0xe6eaECAB0a9A6CD63582DFd568c2014bb1a43808', '0x3A8D5FdC6c8dA9f14C535424b6F7206eC1996016', 'LitBTC'],
      ['0xe69eA31F9795De5236B27664B44aB6E507570E28', '0xe8f504f9cE5391Fb5968b317f0b24b8A0306ACeb', 'LAX'],
      ['0x2B3E9Ad23a6E384B4eA8f579074266B27F6a7Fe9', '0x6AE14CEb3962664b13c5dEF29EB172De76bd0ac9', 'JOT'],
      ['0x933d3cA124e19883E812265AE27B61C347562C36', '0x0573f66cb4bC34618e7AB8a941F7883DD2515dCA', 'COLLE'],
      ['0xC9234d0C56e1a9F439d672a27d9fd8Bb3027FefD', '0x8Ba6E3A0759144245f2939eB54164e32bb78B8E0', 'IMAGE'],
      ['0x1AEDC79abB9d3067Da042AB3a976D8fD088D7917', '0x17D506aF1d0Dc2f4f64f15748a5aC46FAd3f06D7', 'AGII'],
      ['0x950cEaFEb9C754fEe171fFDE25B20ee2FA93E9D3', '0xF05f1F79273874E554F02ce06585E16132a3B62B', 'BLDR'],
      ['0xB8b385645799e3365706d615a21e30C3F6E0a51a', '0x2F366c6350A6b211f6D6F847c3D56738C2E847ca', 'FGPT'],
      ['0x396460c16A644f86965e2d5120f69Ed23fff6F4c', '0x17A357262097B4e70acFfe8B71bC61e8bBcc3B42', 'MUSA'],
      ['0x7126Fa6c66B6e09d026Dd170a2519bb6d57c87D4', '0x16EE7127C9E03e29ca5727e23dd7CB03D283cDBe', 'QTT'],
    ],
  },
  84532: {
    name: 'Base Sepolia',
    rpc: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
    bridge: '0xfdA3b83FE8438123eAF5153945A46F8fcF6175f4',
    nativeSymbol: 'ETH',
    wrappedTokens: [
      ['0xbB86A8ed1170f5Be9cCC7C8df3541F9aA0f7e8F3', '0x72791d72B6097D487cEC58605A62396c50C08b69', 'DOGE'],
      ['0x1904e61aD439D2A9c18305D53Db296Af6844DC7b', '0xC0FC628e3aB128fe387e7ed5e729bD809C017888', 'wLITHO'],
      ['0xe6eaECAB0a9A6CD63582DFd568c2014bb1a43808', '0x3A8D5FdC6c8dA9f14C535424b6F7206eC1996016', 'LitBTC'],
      ['0xe69eA31F9795De5236B27664B44aB6E507570E28', '0xe8f504f9cE5391Fb5968b317f0b24b8A0306ACeb', 'LAX'],
      ['0x2B3E9Ad23a6E384B4eA8f579074266B27F6a7Fe9', '0x6AE14CEb3962664b13c5dEF29EB172De76bd0ac9', 'JOT'],
      ['0x933d3cA124e19883E812265AE27B61C347562C36', '0x0573f66cb4bC34618e7AB8a941F7883DD2515dCA', 'COLLE'],
      ['0xC9234d0C56e1a9F439d672a27d9fd8Bb3027FefD', '0x8Ba6E3A0759144245f2939eB54164e32bb78B8E0', 'IMAGE'],
      ['0x1AEDC79abB9d3067Da042AB3a976D8fD088D7917', '0x17D506aF1d0Dc2f4f64f15748a5aC46FAd3f06D7', 'AGII'],
      ['0x950cEaFEb9C754fEe171fFDE25B20ee2FA93E9D3', '0xF05f1F79273874E554F02ce06585E16132a3B62B', 'BLDR'],
      ['0xB8b385645799e3365706d615a21e30C3F6E0a51a', '0x2F366c6350A6b211f6D6F847c3D56738C2E847ca', 'FGPT'],
      ['0x396460c16A644f86965e2d5120f69Ed23fff6F4c', '0x17A357262097B4e70acFfe8B71bC61e8bBcc3B42', 'MUSA'],
      ['0x7126Fa6c66B6e09d026Dd170a2519bb6d57c87D4', '0x16EE7127C9E03e29ca5727e23dd7CB03D283cDBe', 'QTT'],
    ],
  },
};

// Lookup: { sourceChain, sourceToken } → kamet original. Used by Inbound flow.
export const lookupWrapped = (chainId, wrappedAddress) => {
  const dep = DEST_CHAIN_DEPLOYMENTS[chainId];
  if (!dep) return null;
  const hit = dep.wrappedTokens.find(
    ([wAddr]) => wAddr.toLowerCase() === String(wrappedAddress).toLowerCase()
  );
  if (!hit) return null;
  const [wAddr, kAddr, symbol] = hit;
  return { wrappedAddress: wAddr, kametOrigin: kAddr, originSymbol: symbol, wrappedSymbol: `w${symbol}` };
};

export const BRIDGE_ABI_MINIMAL = [
  'function lockTokens(address token, uint256 amount, uint256 targetChain) returns (bytes32)',
  'function releaseTokens(address token, address user, uint256 amount, uint256 sourceChain, uint256 sourceNonce, bytes32 sourceTxHash, bytes[] calldata signatures)',
  'function supportedTokens(address) view returns (bool)',
  'function signaturesRequired() view returns (uint256)',
  'function getValidators() view returns (address[])',
  'function paused() view returns (bool)',
  'function getDailyRemaining(address token) view returns (uint256)',
];

export const ERC20_BRIDGE_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

export const tokenBySymbol = (sym) => BRIDGE_TOKENS.find((t) => t.symbol === sym);
