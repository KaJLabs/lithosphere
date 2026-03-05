export interface PageInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface Block {
  height: string;
  hash: string;
  proposerAddress: string | null;
  numTxs: number;
  totalGas: string;
  blockTime: string;
  transactions?: Transaction[];
}

export interface BlocksResult {
  items: Block[];
  pageInfo: PageInfo;
}

export interface Transaction {
  id: string;
  hash: string;
  blockHeight: string;
  txIndex: number | null;
  txType: string | null;
  sender: string | null;
  receiver: string | null;
  amount: string | null;
  denom: string | null;
  gasUsed: string | null;
  gasWanted: string | null;
  fee: string | null;
  feeDenom: string | null;
  success: boolean;
  memo: string | null;
  rawLog: string | null;
  timestamp: string;
}

export interface TransactionsResult {
  items: Transaction[];
  pageInfo: PageInfo;
}

export interface EvmTransaction {
  id: string;
  hash: string;
  cosmosTxHash: string | null;
  blockHeight: string;
  txIndex: number | null;
  fromAddress: string;
  toAddress: string | null;
  value: string | null;
  gasPrice: string | null;
  gasLimit: string | null;
  gasUsed: string | null;
  nonce: string | null;
  inputData: string | null;
  contractAddress: string | null;
  status: boolean;
  timestamp: string;
}

export interface EvmTransactionsResult {
  items: EvmTransaction[];
  pageInfo: PageInfo;
}

export interface Account {
  address: string;
  evmAddress: string | null;
  balance: string;
  sequence: string;
  accountNumber: string | null;
  accountType: string | null;
  firstSeenBlock: string | null;
  lastSeenBlock: string | null;
  txCount: string;
  createdAt: string;
  updatedAt: string;
}

export interface Validator {
  operatorAddress: string;
  consensusAddress: string | null;
  moniker: string | null;
  identity: string | null;
  website: string | null;
  details: string | null;
  commissionRate: string | null;
  commissionMaxRate: string | null;
  tokens: string;
  delegatorShares: string;
  status: number;
  jailed: boolean;
  uptimePercentage: number | null;
  missedBlocksCounter: string;
  updatedAt: string;
}

export interface Contract {
  address: string;
  creator: string | null;
  creationTx: string | null;
  creationBlock: string | null;
  verified: boolean;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  totalSupply: string | null;
  contractType: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractsResult {
  items: Contract[];
  pageInfo: PageInfo;
}

export interface TokenTransfer {
  id: string;
  txHash: string;
  logIndex: number | null;
  contractAddress: string;
  fromAddress: string;
  toAddress: string;
  value: string;
  tokenId: string | null;
  blockHeight: string;
  timestamp: string;
}

export interface TokenTransfersResult {
  items: TokenTransfer[];
  pageInfo: PageInfo;
}

export interface Proposal {
  id: string;
  title: string | null;
  description: string | null;
  proposalType: string | null;
  proposer: string | null;
  status: string | null;
  submitTime: string | null;
  depositEndTime: string | null;
  votingStartTime: string | null;
  votingEndTime: string | null;
  totalDeposit: string | null;
  yesVotes: string;
  noVotes: string;
  abstainVotes: string;
  noWithVetoVotes: string;
  updatedAt: string;
}

export interface NetworkStats {
  totalTransactions: string | null;
  totalAccounts: string | null;
  totalContracts: string | null;
  avgBlockTime: number | null;
  avgGasPrice: string | null;
  dailyTransactions: string | null;
  dailyActiveAccounts: string | null;
  recordedAt: string | null;
}

export interface IndexerState {
  lastIndexedBlock: string;
  lastIndexedEvmBlock: string;
  indexerVersion: string;
}

export interface ChainSummary {
  latestBlock: string;
  totalTransactions: string;
  totalAccounts: string;
  totalValidators: number;
  totalContracts: string;
  avgBlockTime: number | null;
}
