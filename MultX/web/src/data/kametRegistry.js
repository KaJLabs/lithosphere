export const GOVERNANCE_PRECOMPILE_ADDRESS = '0x0000000000000000000000000000000000000805';
export const GOVERNANCE_PRECOMPILE_ABI = [
  'function vote(uint64 proposalId, int32 option, string metadata) returns (bool success)',
];
// Cosmos gov vote options: 1=Yes, 2=Abstain, 3=No, 4=NoWithVeto
export const VOTE_OPTIONS = {
  YES: 1,
  ABSTAIN: 2,
  NO: 3,
  NO_WITH_VETO: 4,
};

const DEPLOYMENT_TIMESTAMP = '2026-04-17T11:46:38.929Z';
const DEPLOYER_ADDRESS = '0xE9267bDf7084815B0754545049AE45FE744Aefa8';

export const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)'
];

export const ERC721_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function contractURI() view returns (string)',
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
  'function transferFrom(address from, address to, uint256 tokenId)',
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
  'function mintTo(address to, uint256 tokenId, string tokenURI) returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
];

export const MULTX_BRIDGE_ABI = [
  'function lockTokens(address token, uint256 amount, uint256 targetChain) returns (uint256 nonce)',
  'function releaseTokens(address token, address user, uint256 amount, uint256 sourceChain, address sourceBridge, uint256 sourceNonce, bytes32 sourceTxHash, bytes[] signatures)',
  'function isTokenSupported(address token) view returns (bool)',
  'function getTokenBalance(address token, address user) view returns (uint256)',
  'event TokensLocked(bytes32 indexed txHash, address indexed token, address indexed user, uint256 amount, uint256 indexed targetChain, uint256 nonce)',
  'event TokensReleased(bytes32 indexed txHash, address indexed token, address indexed user, uint256 amount, uint256 sourceChain, address sourceBridge, address submitter)'
];

export const KAMET_KNOWN_CONTRACTS = [
  {
    address: '0x3a896BDF3a1088287FA84aB5a43bB30e2535F263',
    name: 'MultXBridge',
    symbol: 'BRIDGE',
    type: 'bridge',
    verified: true,
    creator: DEPLOYER_ADDRESS,
    deploymentTimestamp: DEPLOYMENT_TIMESTAMP,
    deploymentSource: 'contracts/deployments/kamet-bridge-hardened-2026-05-09T18-03-58-093Z.json',
    sourcePath: 'contracts/contracts/MultXBridge.sol',
    abi: MULTX_BRIDGE_ABI
  }
];

const KAMET_KNOWN_LEP100_TOKENS = [
  {
    address: '0xC0FC628e3aB128fe387e7ed5e729bD809C017888',
    symbol: 'wLITHO',
    name: 'Wrapped Lithosphere',
    type: 'LEP100',
    decimals: 18,
    verified: true
  },
  {
    address: '0x3A8D5FdC6c8dA9f14C535424b6F7206eC1996016',
    symbol: 'LitBTC',
    name: 'Lithosphere LitBTC',
    type: 'LEP100',
    decimals: 18,
    verified: true
  },
  {
    address: '0xe8f504f9cE5391Fb5968b317f0b24b8A0306ACeb',
    symbol: 'LAX',
    name: 'LAX Token',
    type: 'LEP100',
    decimals: 18,
    verified: true
  },
  {
    address: '0x6AE14CEb3962664b13c5dEF29EB172De76bd0ac9',
    symbol: 'JOT',
    name: 'JOT Token',
    type: 'LEP100',
    decimals: 18,
    verified: true
  },
  {
    address: '0x0573f66cb4bC34618e7AB8a941F7883DD2515dCA',
    symbol: 'COLLE',
    name: 'Colle AI',
    type: 'LEP100',
    decimals: 18,
    verified: true
  },
  {
    address: '0x8Ba6E3A0759144245f2939eB54164e32bb78B8E0',
    symbol: 'IMAGE',
    name: 'Image AI',
    type: 'LEP100',
    decimals: 18,
    verified: true
  },
  {
    address: '0x17D506aF1d0Dc2f4f64f15748a5aC46FAd3f06D7',
    symbol: 'AGII',
    name: 'AGI Inception',
    type: 'LEP100',
    decimals: 18,
    verified: true
  },
  {
    address: '0xF05f1F79273874E554F02ce06585E16132a3B62B',
    symbol: 'BLDR',
    name: 'Builder Finance',
    type: 'LEP100',
    decimals: 18,
    verified: true
  },
  {
    address: '0x2F366c6350A6b211f6D6F847c3D56738C2E847ca',
    symbol: 'FGPT',
    name: 'Finesse GPT',
    type: 'LEP100',
    decimals: 18,
    verified: true
  },
  {
    address: '0x17A357262097B4e70acFfe8B71bC61e8bBcc3B42',
    symbol: 'MUSA',
    name: 'Musa AI',
    type: 'LEP100',
    decimals: 18,
    verified: true
  }
].map((token) => ({
  ...token,
  abi: ERC20_ABI,
  creator: DEPLOYER_ADDRESS,
  deploymentTimestamp: DEPLOYMENT_TIMESTAMP,
  deploymentSource: 'contracts/deployments/kamet-2026-04-17T11-46-38-929Z.json',
  sourcePath: 'contracts/contracts/LEP100Token.sol'
})).concat([
  {
    address: '0x72791d72B6097D487cEC58605A62396c50C08b69',
    symbol: 'DOGE',
    name: 'DOGE',
    type: 'LEP100',
    decimals: 18,
    verified: true,
    abi: ERC20_ABI,
    creator: '0x10ed4F004Fe708014ae27Bcc20c9Ed9df3f4eadF',
    deploymentTimestamp: '2026-04-28T15:37:25.837Z',
    deploymentSource:
      'contracts/deployments/kamet-doge-fwr-2026-04-28T15-37-25-837Z.json',
    sourcePath: 'contracts/contracts/LEP100Token.sol'
  },
  {
    address: '0x16EE7127C9E03e29ca5727e23dd7CB03D283cDBe',
    symbol: 'QTT',
    name: 'Quantts',
    type: 'LEP100',
    decimals: 18,
    verified: true,
    abi: ERC20_ABI,
    creator: '0x10ed4F004Fe708014ae27Bcc20c9Ed9df3f4eadF',
    deploymentTimestamp: '2026-05-06T21:58:26.256Z',
    deploymentSource: 'contracts/deployments/qtt-kamet-2026-05-06T21-58-26.json',
    sourcePath: 'contracts/contracts/LEP100Token.sol'
  }
]);

const KAMET_KNOWN_NFT_COLLECTIONS = [
  {
    address: '0x93d74580a7b63a5B1FE5Aae05b7470bf9317aF9A',
    cosmosAddress: 'litho1j0t5tq98kca9k8l94ts9karsh7f30tu6j6dszp',
    symbol: 'FGS',
    name: 'Finesse Genesis: Samurai',
    type: 'NFT',
    standard: 'lep100-6',
    verified: true,
    abi: ERC721_ABI,
    creator: '0x10ed4F004Fe708014ae27Bcc20c9Ed9df3f4eadF',
    deploymentTimestamp: '2026-04-23T20:59:22.776Z',
    deploymentSource:
      'contracts/deployments/kamet-finesse-genesis-samurai-2026-04-23T20-59-22-776Z.json',
    sourcePath: 'contracts/contracts/FinesseGenesisSamurai.sol'
  },
  {
    address: '0x25F70D427EB96b784ff2d0B458B6Aa5f6D251346',
    cosmosAddress: 'litho1yhms6sn7h94hsnlj6z693d42takj2y6xm54kcr',
    symbol: 'FGD',
    name: 'Finesse Genesis: Dragon',
    type: 'NFT',
    standard: 'lep100-6',
    verified: true,
    abi: ERC721_ABI,
    creator: '0x10ed4F004Fe708014ae27Bcc20c9Ed9df3f4eadF',
    deploymentTimestamp: '2026-04-25T11:11:11.780Z',
    deploymentSource:
      'contracts/deployments/kamet-fgd-2026-04-25T11-11-11-780Z.json',
    sourcePath: 'contracts/contracts/LithosphereNFT.sol'
  },
  {
    address: '0xFEC7EF3AB4D80eAe1B65744b06914afeB579e2bc',
    symbol: 'FWR',
    name: 'Finesse Warriors',
    type: 'NFT',
    standard: 'lep100-6',
    verified: true,
    abi: ERC721_ABI,
    creator: '0x10ed4F004Fe708014ae27Bcc20c9Ed9df3f4eadF',
    deploymentTimestamp: '2026-04-28T15:37:25.837Z',
    deploymentSource:
      'contracts/deployments/kamet-doge-fwr-2026-04-28T15-37-25-837Z.json',
    sourcePath: 'contracts/contracts/LithosphereNFT.sol'
  }
];

export const KAMET_KNOWN_TOKENS = [
  ...KAMET_KNOWN_LEP100_TOKENS,
  ...KAMET_KNOWN_NFT_COLLECTIONS
];

export const KAMET_LITHIC_EXAMPLES = [
  {
    id: 'lithic-example-doge',
    name: 'DOGE',
    symbol: 'DOGE',
    assetClass: 'FT',
    standard: 'LEP100-2',
    runtime: 'LithoVM / Lithic',
    sourcePath: 'contracts/contracts/DOGE.lithic',
    status: 'Verified',
    verified: true
  },
  {
    id: 'lithic-example-finesse-warriors',
    name: 'Finesse Warriors',
    symbol: 'FWR',
    assetClass: 'NFT',
    standard: 'LEP100-6',
    runtime: 'LithoVM / Lithic',
    sourcePath: 'contracts/contracts/FinesseWarriors.lithic',
    status: 'Verified',
    verified: true
  }
];

export const KAMET_KNOWN_CONTRACTS_BY_ADDRESS = new Map(
  [...KAMET_KNOWN_CONTRACTS, ...KAMET_KNOWN_TOKENS].map((contract) => [
    contract.address.toLowerCase(),
    contract
  ])
);

export const KAMET_KNOWN_TOKENS_BY_ADDRESS = new Map(
  KAMET_KNOWN_TOKENS.map((token) => [token.address.toLowerCase(), token])
);

export const KAMET_TOKEN_SYMBOL_INDEX = new Map(
  KAMET_KNOWN_TOKENS.map((token) => [token.symbol.toLowerCase(), token])
);
