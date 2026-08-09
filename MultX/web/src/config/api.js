const RPC_URL = import.meta.env.VITE_RPC_URL || 'https://rpc-3.litho.ai';
const REST_URL = import.meta.env.VITE_REST_URL || 'https://api-3.litho.ai';
const GRPC_URL = import.meta.env.VITE_GRPC_URL || '';
const EXPLORER_URL = import.meta.env.VITE_EXPLORER_URL || 'https://kamet.litho.ai';
const EXPLORER_DATA_API_URL = (
  import.meta.env.VITE_EXPLORER_DATA_API_URL ||
  `${EXPLORER_URL.replace(/\/$/, '')}/api`
).replace(/\/$/, '');
const STATUS_PAGE_URL = import.meta.env.VITE_STATUS_PAGE_URL || 'https://status.litho.ai';
const STATUS_API_URL = import.meta.env.VITE_STATUS_API_URL || `${STATUS_PAGE_URL}/api/status`;
const STATUS_METRICS_URL =
  import.meta.env.VITE_STATUS_METRICS_URL ||
  (STATUS_API_URL.match(/\/api\/status\/?$/)
    ? STATUS_API_URL.replace(/\/api\/status\/?$/, '/api/metrics')
    : `${STATUS_PAGE_URL}/api/metrics`);
const DOCS_URL = import.meta.env.VITE_DOCS_URL || 'https://docs.litho.ai';
const VALIDATOR_PORTAL_URL =
  import.meta.env.VITE_VALIDATOR_PORTAL_URL || 'https://validator.litho.ai';
const RPC_PUBLIC_URL = import.meta.env.VITE_RPC_PUBLIC_URL || RPC_URL;
const EXPLORER_WS_URL =
  import.meta.env.VITE_EXPLORER_WS_URL ||
  (RPC_URL.startsWith('https://')
    ? RPC_URL.replace(/^https:\/\//, 'wss://')
    : RPC_URL.replace(/^http:\/\//, 'ws://')) + '/websocket';
const EVM_CHAIN_ID = Number(import.meta.env.VITE_EVM_CHAIN_ID) || 900523;

export const DRPC_EVM_RPC_URL = import.meta.env.VITE_EVM_RPC_DRPC_URL || null;

export const CHAIN_CONFIG = {
  chainId: import.meta.env.VITE_CHAIN_ID || 'lithosphere_900523-2',
  evmChainId: EVM_CHAIN_ID,
  evmChainIdHex: `0x${EVM_CHAIN_ID.toString(16)}`,
  chainName: import.meta.env.VITE_CHAIN_NAME || 'Lithosphere Kamet',
  networkLabel: import.meta.env.VITE_NETWORK_LABEL || 'Kamet',
  denom: import.meta.env.VITE_DENOM || 'LITHO',
  displayDenom: import.meta.env.VITE_DENOM || 'LITHO',
  baseDenom: import.meta.env.VITE_BASE_DENOM || 'ulitho',
  bech32Prefix: import.meta.env.VITE_BECH32_PREFIX || 'litho',
  validatorPrefix: import.meta.env.VITE_VALIDATOR_PREFIX || 'lithovaloper',
  decimals: Number(import.meta.env.VITE_DECIMALS) || 18,
  rpcUrl: RPC_URL,
  restUrl: REST_URL,
  grpcUrl: GRPC_URL,
  explorerUrl: EXPLORER_URL,
  explorerDataApiUrl: EXPLORER_DATA_API_URL,
  explorerWsUrl: EXPLORER_WS_URL,
  statusPageUrl: STATUS_PAGE_URL,
  statusApiUrl: STATUS_API_URL,
  statusMetricsUrl: STATUS_METRICS_URL,
  docsUrl: DOCS_URL,
  validatorPortalUrl: VALIDATOR_PORTAL_URL,
  rpcPublicUrl: RPC_PUBLIC_URL,
  ecosystemUrl: import.meta.env.VITE_ECOSYSTEM_URL || 'https://ecosystem.litho.ai',
  faucetUrl: import.meta.env.VITE_FAUCET_URL || `${EXPLORER_URL}/faucet`,
  faucetAssetsUrl:
    import.meta.env.VITE_FAUCET_ASSETS_URL ||
    (EXPLORER_DATA_API_URL ? `${EXPLORER_DATA_API_URL}/faucet/assets` : `${REST_URL}/faucet/assets`),
  faucetClaimUrl:
    import.meta.env.VITE_FAUCET_CLAIM_URL ||
    (EXPLORER_DATA_API_URL ? `${EXPLORER_DATA_API_URL}/faucet/claim` : `${REST_URL}/faucet/claim`),
  setupGuideUrl:
    import.meta.env.VITE_SETUP_GUIDE_URL || 'https://github.com/kasrthegreat/litho-makalu-validators',
  footerLinks: {
    docs: DOCS_URL,
    status: STATUS_PAGE_URL,
    rpc: RPC_PUBLIC_URL,
    faucet: import.meta.env.VITE_FAUCET_URL || `${EXPLORER_URL}/faucet`,
    validatorPortal: VALIDATOR_PORTAL_URL
  }
};

export const CosmosAPI = {
  status: () => `${RPC_URL}/status`,
  latestBlock: () => `${RPC_URL}/block`,
  blockchain: (minHeight, maxHeight) =>
    `${RPC_URL}/blockchain?minHeight=${minHeight}&maxHeight=${maxHeight}`,
  blockByHeight: (height) => `${RPC_URL}/block?height=${height}`,
  blockByHash: (hash) =>
    `${RPC_URL}/block_by_hash?hash=0x${String(hash || '').replace(/^0x/i, '')}`,
  blockResults: (height) => `${RPC_URL}/block_results?height=${height}`,
  abciInfo: () => `${RPC_URL}/abci_info`,

  blocks: () => `${REST_URL}/cosmos/base/tendermint/v1beta1/blocks`,
  latestBlockRest: () => `${REST_URL}/cosmos/base/tendermint/v1beta1/blocks/latest`,
  blockByHeightRest: (height) => `${REST_URL}/cosmos/base/tendermint/v1beta1/blocks/${height}`,
  validatorSetLatest: () => `${REST_URL}/cosmos/base/tendermint/v1beta1/validatorsets/latest`,
  validatorSetByHeight: (height) =>
    `${REST_URL}/cosmos/base/tendermint/v1beta1/validatorsets/${height}`,

  txs: (signer) => `${REST_URL}/cosmos/tx/v1beta1/txs?events=message.signer%3D%27${signer}%27`,
  txByHash: (hash) => `${REST_URL}/cosmos/tx/v1beta1/txs/${hash}`,
  txByHeight: (height) => `${REST_URL}/cosmos/tx/v1beta1/txs?events=tx.height%3D${height}`,
  txsQuery: (query, limit = 100, offset = 0) =>
    `${REST_URL}/cosmos/tx/v1beta1/txs?pagination.limit=${limit}&pagination.offset=${offset}&pagination.count_total=true&order_by=ORDER_BY_DESC&query=${encodeURIComponent(
      query
    )}`,

  account: (address) => `${REST_URL}/cosmos/auth/v1beta1/accounts/${address}`,
  params: () => `${REST_URL}/cosmos/auth/v1beta1/params`,

  balance: (address) => `${REST_URL}/cosmos/bank/v1beta1/balances/${address}`,
  balanceByDenom: (address, denom) =>
    `${REST_URL}/cosmos/bank/v1beta1/balances/${address}/by_denom?denom=${denom}`,
  supply: () => `${REST_URL}/cosmos/bank/v1beta1/supply`,
  supplyByDenom: (denom) => `${REST_URL}/cosmos/bank/v1beta1/supply/by_denom?denom=${denom}`,

  validators: () => `${REST_URL}/cosmos/staking/v1beta1/validators`,
  validatorByAddress: (address) => `${REST_URL}/cosmos/staking/v1beta1/validators/${address}`,
  stakingPool: () => `${REST_URL}/cosmos/staking/v1beta1/pool`,
  delegations: (address) => `${REST_URL}/cosmos/staking/v1beta1/delegations/${address}`,
  redelegations: (address) =>
    `${REST_URL}/cosmos/staking/v1beta1/redelegations?delegator_addr=${address}`,
  unbondingDelegations: (address) =>
    `${REST_URL}/cosmos/staking/v1beta1/unbonding_delegations/${address}`,

  signingInfos: () => `${REST_URL}/cosmos/slashing/v1beta1/signing_infos`,
  signingInfoByAddress: (address) =>
    `${REST_URL}/cosmos/slashing/v1beta1/signing_infos/${address}`,
  slashingParams: () => `${REST_URL}/cosmos/slashing/v1beta1/params`,

  delegatorRewards: (address) =>
    `${REST_URL}/cosmos/distribution/v1beta1/delegators/${address}/rewards`,
  validatorCommission: (address) =>
    `${REST_URL}/cosmos/distribution/v1beta1/validators/${address}/commission`,

  proposals: () => `${REST_URL}/cosmos/gov/v1beta1/proposals`,
  proposalById: (id) => `${REST_URL}/cosmos/gov/v1beta1/proposals/${id}`,
  proposalVotes: (id) => `${REST_URL}/cosmos/gov/v1beta1/proposals/${id}/votes`,
  proposalTally: (id) => `${REST_URL}/cosmos/gov/v1beta1/proposals/${id}/tally`,
  govVotingParams: () => `${REST_URL}/cosmos/gov/v1beta1/params/voting`,

  contractStatus: (address) => `${REST_URL}/v1/contract/status/${address}`,
  contractSource: (address) => `${REST_URL}/v1/contract/source/${address}`
};

const createRpcPayload = (method, params = [], id = 1) => ({
  jsonrpc: '2.0',
  method,
  params,
  id
});

export const EvmAPI = {
  rpcUrl: import.meta.env.VITE_EVM_RPC_URL || 'https://rpc-3.litho.ai',
  blockNumber: () => createRpcPayload('eth_blockNumber', [], 1),
  txByHash: (hash) => createRpcPayload('eth_getTransactionByHash', [hash], 2),
  txReceipt: (hash) => createRpcPayload('eth_getTransactionReceipt', [hash], 3),
  blockByNumber: (blockNumberHex, includeTransactions = false) =>
    createRpcPayload('eth_getBlockByNumber', [blockNumberHex, includeTransactions], 4),
  gasPrice: () => createRpcPayload('eth_gasPrice', [], 5),
  codeAt: (address, block = 'latest') => createRpcPayload('eth_getCode', [address, block], 6),
  balanceAt: (address, block = 'latest') =>
    createRpcPayload('eth_getBalance', [address, block], 7),
  txCount: (address, block = 'latest') =>
    createRpcPayload('eth_getTransactionCount', [address, block], 8),
  getLogs: (filter) => createRpcPayload('eth_getLogs', [filter], 9),
  call: (transaction, block = 'latest') =>
    createRpcPayload('eth_call', [transaction, block], 10),
  chainId: () => createRpcPayload('eth_chainId', [], 11)
};

export const TrendingCoins = (currency) =>
  `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${currency}&order=gecko_desc&per_page=10&page=1&sparkline=false&price_change_percentage=24h`;

export const MarketChart = (id, currency, days) =>
  `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=${currency}&days=${days}&interval=daily`;

export const MarketCoinsByIds = (currency, ids) =>
  `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${currency}&ids=${encodeURIComponent(
    ids.join(',')
  )}&order=market_cap_desc&per_page=${Math.max(ids.length, 1)}&page=1&sparkline=false&price_change_percentage=24h`;

export const LITHOSPHERE_TOKENS = [
  {
    name: 'Lithosphere',
    symbol: 'LITHO',
    denom: 'ulitho',
    decimals: 18,
    logo: '/tokens/litho.svg'
  }
];
