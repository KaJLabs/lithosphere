import { gql } from 'apollo-server-express';
import { query } from './db.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function clamp(val: number | null | undefined, def: number): number {
  if (!val || val < 1) return def;
  return Math.min(val, MAX_LIMIT);
}

export const typeDefs = gql`
  type PageInfo {
    total: Int!
    limit: Int!
    offset: Int!
    hasMore: Boolean!
  }

  type Block {
    height: String!
    hash: String!
    proposerAddress: String
    numTxs: Int!
    totalGas: String!
    blockTime: String!
    transactions: [Transaction!]!
  }

  type BlocksResult {
    items: [Block!]!
    pageInfo: PageInfo!
  }

  type Transaction {
    id: String!
    hash: String!
    blockHeight: String!
    txIndex: Int
    txType: String
    sender: String
    receiver: String
    amount: String
    denom: String
    gasUsed: String
    gasWanted: String
    fee: String
    feeDenom: String
    success: Boolean!
    memo: String
    rawLog: String
    timestamp: String!
  }

  type TransactionsResult {
    items: [Transaction!]!
    pageInfo: PageInfo!
  }

  type EvmTransaction {
    id: String!
    hash: String!
    cosmosTxHash: String
    blockHeight: String!
    txIndex: Int
    fromAddress: String!
    toAddress: String
    value: String
    gasPrice: String
    gasLimit: String
    gasUsed: String
    nonce: String
    inputData: String
    contractAddress: String
    status: Boolean!
    timestamp: String!
  }

  type EvmTransactionsResult {
    items: [EvmTransaction!]!
    pageInfo: PageInfo!
  }

  type Account {
    address: String!
    evmAddress: String
    balance: String!
    sequence: String!
    accountNumber: String
    accountType: String
    firstSeenBlock: String
    lastSeenBlock: String
    txCount: String!
    createdAt: String!
    updatedAt: String!
  }

  type Validator {
    operatorAddress: String!
    consensusAddress: String
    moniker: String
    identity: String
    website: String
    details: String
    commissionRate: String
    commissionMaxRate: String
    tokens: String!
    delegatorShares: String!
    status: Int!
    jailed: Boolean!
    uptimePercentage: Float
    missedBlocksCounter: String!
    updatedAt: String!
  }

  type Contract {
    address: String!
    creator: String
    creationTx: String
    creationBlock: String
    verified: Boolean!
    name: String
    symbol: String
    decimals: Int
    totalSupply: String
    contractType: String
    createdAt: String!
    updatedAt: String!
  }

  type ContractsResult {
    items: [Contract!]!
    pageInfo: PageInfo!
  }

  type TokenTransfer {
    id: String!
    txHash: String!
    logIndex: Int
    contractAddress: String!
    fromAddress: String!
    toAddress: String!
    value: String!
    tokenId: String
    blockHeight: String!
    timestamp: String!
  }

  type TokenTransfersResult {
    items: [TokenTransfer!]!
    pageInfo: PageInfo!
  }

  type Proposal {
    id: String!
    title: String
    description: String
    proposalType: String
    proposer: String
    status: String
    submitTime: String
    depositEndTime: String
    votingStartTime: String
    votingEndTime: String
    totalDeposit: String
    yesVotes: String!
    noVotes: String!
    abstainVotes: String!
    noWithVetoVotes: String!
    updatedAt: String!
  }

  type NetworkStats {
    totalTransactions: String
    totalAccounts: String
    totalContracts: String
    avgBlockTime: Float
    avgGasPrice: String
    dailyTransactions: String
    dailyActiveAccounts: String
    recordedAt: String
  }

  type IndexerState {
    lastIndexedBlock: String!
    lastIndexedEvmBlock: String!
    indexerVersion: String!
  }

  type ChainSummary {
    latestBlock: String!
    totalTransactions: String!
    totalAccounts: String!
    totalValidators: Int!
    totalContracts: String!
    avgBlockTime: Float
  }

  type Query {
    # Blocks
    latestBlock: Block
    block(height: String, hash: String): Block
    blocks(limit: Int, offset: Int): BlocksResult!

    # Cosmos transactions
    transaction(hash: String!): Transaction
    transactions(limit: Int, offset: Int): TransactionsResult!
    transactionsByBlock(height: String!, limit: Int, offset: Int): TransactionsResult!
    transactionsByAddress(address: String!, limit: Int, offset: Int): TransactionsResult!

    # EVM transactions
    evmTransaction(hash: String!): EvmTransaction
    evmTransactions(limit: Int, offset: Int): EvmTransactionsResult!
    evmTransactionsByAddress(address: String!, limit: Int, offset: Int): EvmTransactionsResult!

    # Accounts
    account(address: String!): Account
    accounts(limit: Int, offset: Int): [Account!]!

    # Validators
    validators(status: Int, limit: Int, offset: Int): [Validator!]!
    validator(operatorAddress: String!): Validator

    # Contracts
    contract(address: String!): Contract
    contracts(contractType: String, limit: Int, offset: Int): ContractsResult!

    # Token transfers
    tokenTransfers(contractAddress: String, address: String, limit: Int, offset: Int): TokenTransfersResult!

    # Governance
    proposals(status: String, limit: Int, offset: Int): [Proposal!]!
    proposal(id: String!): Proposal

    # Stats & state
    networkStats: NetworkStats
    indexerState: IndexerState
    chainSummary: ChainSummary
  }
`;

// ─── Row type helpers ─────────────────────────────────────────────────────────

interface BlockRow {
  height: string;
  hash: string;
  proposer_address: string | null;
  num_txs: number;
  total_gas: string;
  block_time: Date;
}

interface TxRow {
  id: string;
  hash: string;
  block_height: string;
  tx_index: number | null;
  tx_type: string | null;
  sender: string | null;
  receiver: string | null;
  amount: string | null;
  denom: string | null;
  gas_used: string | null;
  gas_wanted: string | null;
  fee: string | null;
  fee_denom: string | null;
  success: boolean;
  memo: string | null;
  raw_log: string | null;
  timestamp: Date;
}

interface EvmTxRow {
  id: string;
  hash: string;
  cosmos_tx_hash: string | null;
  block_height: string;
  tx_index: number | null;
  from_address: string;
  to_address: string | null;
  value: string | null;
  gas_price: string | null;
  gas_limit: string | null;
  gas_used: string | null;
  nonce: string | null;
  input_data: string | null;
  contract_address: string | null;
  status: boolean;
  timestamp: Date;
}

interface AccountRow {
  address: string;
  evm_address: string | null;
  balance: string;
  sequence: string;
  account_number: string | null;
  account_type: string | null;
  first_seen_block: string | null;
  last_seen_block: string | null;
  tx_count: string;
  created_at: Date;
  updated_at: Date;
}

interface ValidatorRow {
  operator_address: string;
  consensus_address: string | null;
  moniker: string | null;
  identity: string | null;
  website: string | null;
  details: string | null;
  commission_rate: string | null;
  commission_max_rate: string | null;
  tokens: string;
  delegator_shares: string;
  status: number;
  jailed: boolean;
  uptime_percentage: number | null;
  missed_blocks_counter: string;
  updated_at: Date;
}

interface ContractRow {
  address: string;
  creator: string | null;
  creation_tx: string | null;
  creation_block: string | null;
  verified: boolean;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  total_supply: string | null;
  contract_type: string | null;
  created_at: Date;
  updated_at: Date;
}

interface TokenTransferRow {
  id: string;
  tx_hash: string;
  log_index: number | null;
  contract_address: string;
  from_address: string;
  to_address: string;
  value: string;
  token_id: string | null;
  block_height: string;
  timestamp: Date;
}

interface ProposalRow {
  id: string;
  title: string | null;
  description: string | null;
  proposal_type: string | null;
  proposer: string | null;
  status: string | null;
  submit_time: Date | null;
  deposit_end_time: Date | null;
  voting_start_time: Date | null;
  voting_end_time: Date | null;
  total_deposit: string | null;
  yes_votes: string;
  no_votes: string;
  abstain_votes: string;
  no_with_veto_votes: string;
  updated_at: Date;
}

interface CountRow { count: string }
interface StateRow { key: string; value: string }
interface StatsRow {
  total_transactions: string | null;
  total_accounts: string | null;
  total_contracts: string | null;
  avg_block_time: number | null;
  avg_gas_price: string | null;
  daily_transactions: string | null;
  daily_active_accounts: string | null;
  recorded_at: Date | null;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapBlock(r: BlockRow) {
  return {
    height: String(r.height),
    hash: r.hash,
    proposerAddress: r.proposer_address,
    numTxs: r.num_txs,
    totalGas: String(r.total_gas),
    blockTime: r.block_time instanceof Date ? r.block_time.toISOString() : String(r.block_time),
  };
}

function mapTx(r: TxRow) {
  return {
    id: r.id,
    hash: r.hash,
    blockHeight: String(r.block_height),
    txIndex: r.tx_index,
    txType: r.tx_type,
    sender: r.sender,
    receiver: r.receiver,
    amount: r.amount,
    denom: r.denom,
    gasUsed: r.gas_used != null ? String(r.gas_used) : null,
    gasWanted: r.gas_wanted != null ? String(r.gas_wanted) : null,
    fee: r.fee,
    feeDenom: r.fee_denom,
    success: r.success,
    memo: r.memo,
    rawLog: r.raw_log,
    timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
  };
}

function mapEvmTx(r: EvmTxRow) {
  return {
    id: r.id,
    hash: r.hash,
    cosmosTxHash: r.cosmos_tx_hash,
    blockHeight: String(r.block_height),
    txIndex: r.tx_index,
    fromAddress: r.from_address,
    toAddress: r.to_address,
    value: r.value,
    gasPrice: r.gas_price,
    gasLimit: r.gas_limit != null ? String(r.gas_limit) : null,
    gasUsed: r.gas_used != null ? String(r.gas_used) : null,
    nonce: r.nonce != null ? String(r.nonce) : null,
    inputData: r.input_data,
    contractAddress: r.contract_address,
    status: r.status,
    timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
  };
}

function mapAccount(r: AccountRow) {
  return {
    address: r.address,
    evmAddress: r.evm_address,
    balance: r.balance,
    sequence: String(r.sequence),
    accountNumber: r.account_number != null ? String(r.account_number) : null,
    accountType: r.account_type,
    firstSeenBlock: r.first_seen_block != null ? String(r.first_seen_block) : null,
    lastSeenBlock: r.last_seen_block != null ? String(r.last_seen_block) : null,
    txCount: String(r.tx_count),
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

function mapValidator(r: ValidatorRow) {
  return {
    operatorAddress: r.operator_address,
    consensusAddress: r.consensus_address,
    moniker: r.moniker,
    identity: r.identity,
    website: r.website,
    details: r.details,
    commissionRate: r.commission_rate,
    commissionMaxRate: r.commission_max_rate,
    tokens: r.tokens,
    delegatorShares: r.delegator_shares,
    status: r.status,
    jailed: r.jailed,
    uptimePercentage: r.uptime_percentage != null ? Number(r.uptime_percentage) : null,
    missedBlocksCounter: String(r.missed_blocks_counter),
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

function mapContract(r: ContractRow) {
  return {
    address: r.address,
    creator: r.creator,
    creationTx: r.creation_tx,
    creationBlock: r.creation_block != null ? String(r.creation_block) : null,
    verified: r.verified,
    name: r.name,
    symbol: r.symbol,
    decimals: r.decimals,
    totalSupply: r.total_supply,
    contractType: r.contract_type,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

function mapTokenTransfer(r: TokenTransferRow) {
  return {
    id: r.id,
    txHash: r.tx_hash,
    logIndex: r.log_index,
    contractAddress: r.contract_address,
    fromAddress: r.from_address,
    toAddress: r.to_address,
    value: r.value,
    tokenId: r.token_id,
    blockHeight: String(r.block_height),
    timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
  };
}

function mapProposal(r: ProposalRow) {
  return {
    id: String(r.id),
    title: r.title,
    description: r.description,
    proposalType: r.proposal_type,
    proposer: r.proposer,
    status: r.status,
    submitTime: r.submit_time ? (r.submit_time instanceof Date ? r.submit_time.toISOString() : String(r.submit_time)) : null,
    depositEndTime: r.deposit_end_time ? (r.deposit_end_time instanceof Date ? r.deposit_end_time.toISOString() : String(r.deposit_end_time)) : null,
    votingStartTime: r.voting_start_time ? (r.voting_start_time instanceof Date ? r.voting_start_time.toISOString() : String(r.voting_start_time)) : null,
    votingEndTime: r.voting_end_time ? (r.voting_end_time instanceof Date ? r.voting_end_time.toISOString() : String(r.voting_end_time)) : null,
    totalDeposit: r.total_deposit,
    yesVotes: r.yes_votes,
    noVotes: r.no_votes,
    abstainVotes: r.abstain_votes,
    noWithVetoVotes: r.no_with_veto_votes,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

async function countRows(table: string, where = '', params: unknown[] = []): Promise<number> {
  const sql = `SELECT COUNT(*) AS count FROM ${table}${where ? ' WHERE ' + where : ''}`;
  const rows = await query<CountRow>(sql, params);
  return parseInt(rows[0]?.count ?? '0', 10);
}

// ─── Resolvers ────────────────────────────────────────────────────────────────

export const resolvers = {
  Query: {
    // ── Blocks ──────────────────────────────────────────────────────────────

    latestBlock: async () => {
      const rows = await query<BlockRow>(
        'SELECT * FROM blocks ORDER BY height DESC LIMIT 1'
      );
      return rows[0] ? mapBlock(rows[0]) : null;
    },

    block: async (_: unknown, args: { height?: string; hash?: string }) => {
      if (args.height) {
        const rows = await query<BlockRow>(
          'SELECT * FROM blocks WHERE height = $1',
          [args.height]
        );
        return rows[0] ? mapBlock(rows[0]) : null;
      }
      if (args.hash) {
        const rows = await query<BlockRow>(
          'SELECT * FROM blocks WHERE hash = $1',
          [args.hash]
        );
        return rows[0] ? mapBlock(rows[0]) : null;
      }
      return null;
    },

    blocks: async (_: unknown, args: { limit?: number; offset?: number }) => {
      const limit = clamp(args.limit, DEFAULT_LIMIT);
      const offset = args.offset ?? 0;
      const [rows, total] = await Promise.all([
        query<BlockRow>(
          'SELECT * FROM blocks ORDER BY height DESC LIMIT $1 OFFSET $2',
          [limit, offset]
        ),
        countRows('blocks'),
      ]);
      return {
        items: rows.map(mapBlock),
        pageInfo: { total, limit, offset, hasMore: offset + limit < total },
      };
    },

    // ── Cosmos Transactions ──────────────────────────────────────────────────

    transaction: async (_: unknown, args: { hash: string }) => {
      const rows = await query<TxRow>(
        'SELECT * FROM transactions WHERE hash = $1',
        [args.hash]
      );
      return rows[0] ? mapTx(rows[0]) : null;
    },

    transactions: async (_: unknown, args: { limit?: number; offset?: number }) => {
      const limit = clamp(args.limit, DEFAULT_LIMIT);
      const offset = args.offset ?? 0;
      const [rows, total] = await Promise.all([
        query<TxRow>(
          'SELECT * FROM transactions ORDER BY timestamp DESC LIMIT $1 OFFSET $2',
          [limit, offset]
        ),
        countRows('transactions'),
      ]);
      return {
        items: rows.map(mapTx),
        pageInfo: { total, limit, offset, hasMore: offset + limit < total },
      };
    },

    transactionsByBlock: async (
      _: unknown,
      args: { height: string; limit?: number; offset?: number }
    ) => {
      const limit = clamp(args.limit, DEFAULT_LIMIT);
      const offset = args.offset ?? 0;
      const [rows, total] = await Promise.all([
        query<TxRow>(
          'SELECT * FROM transactions WHERE block_height = $1 ORDER BY tx_index ASC LIMIT $2 OFFSET $3',
          [args.height, limit, offset]
        ),
        countRows('transactions', 'block_height = $1', [args.height]),
      ]);
      return {
        items: rows.map(mapTx),
        pageInfo: { total, limit, offset, hasMore: offset + limit < total },
      };
    },

    transactionsByAddress: async (
      _: unknown,
      args: { address: string; limit?: number; offset?: number }
    ) => {
      const limit = clamp(args.limit, DEFAULT_LIMIT);
      const offset = args.offset ?? 0;
      const [rows, total] = await Promise.all([
        query<TxRow>(
          'SELECT * FROM transactions WHERE sender = $1 OR receiver = $1 ORDER BY timestamp DESC LIMIT $2 OFFSET $3',
          [args.address, limit, offset]
        ),
        countRows('transactions', 'sender = $1 OR receiver = $1', [args.address]),
      ]);
      return {
        items: rows.map(mapTx),
        pageInfo: { total, limit, offset, hasMore: offset + limit < total },
      };
    },

    // ── EVM Transactions ─────────────────────────────────────────────────────

    evmTransaction: async (_: unknown, args: { hash: string }) => {
      const rows = await query<EvmTxRow>(
        'SELECT * FROM evm_transactions WHERE hash = $1',
        [args.hash]
      );
      return rows[0] ? mapEvmTx(rows[0]) : null;
    },

    evmTransactions: async (_: unknown, args: { limit?: number; offset?: number }) => {
      const limit = clamp(args.limit, DEFAULT_LIMIT);
      const offset = args.offset ?? 0;
      const [rows, total] = await Promise.all([
        query<EvmTxRow>(
          'SELECT * FROM evm_transactions ORDER BY timestamp DESC LIMIT $1 OFFSET $2',
          [limit, offset]
        ),
        countRows('evm_transactions'),
      ]);
      return {
        items: rows.map(mapEvmTx),
        pageInfo: { total, limit, offset, hasMore: offset + limit < total },
      };
    },

    evmTransactionsByAddress: async (
      _: unknown,
      args: { address: string; limit?: number; offset?: number }
    ) => {
      const limit = clamp(args.limit, DEFAULT_LIMIT);
      const offset = args.offset ?? 0;
      const [rows, total] = await Promise.all([
        query<EvmTxRow>(
          'SELECT * FROM evm_transactions WHERE from_address = $1 OR to_address = $1 ORDER BY timestamp DESC LIMIT $2 OFFSET $3',
          [args.address, limit, offset]
        ),
        countRows('evm_transactions', 'from_address = $1 OR to_address = $1', [args.address]),
      ]);
      return {
        items: rows.map(mapEvmTx),
        pageInfo: { total, limit, offset, hasMore: offset + limit < total },
      };
    },

    // ── Accounts ─────────────────────────────────────────────────────────────

    account: async (_: unknown, args: { address: string }) => {
      // Support both bech32 (litho1...) and EVM (0x...) lookups
      const rows = await query<AccountRow>(
        'SELECT * FROM accounts WHERE address = $1 OR evm_address = $1',
        [args.address]
      );
      return rows[0] ? mapAccount(rows[0]) : null;
    },

    accounts: async (_: unknown, args: { limit?: number; offset?: number }) => {
      const limit = clamp(args.limit, DEFAULT_LIMIT);
      const offset = args.offset ?? 0;
      const rows = await query<AccountRow>(
        'SELECT * FROM accounts ORDER BY tx_count DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );
      return rows.map(mapAccount);
    },

    // ── Validators ───────────────────────────────────────────────────────────

    validators: async (
      _: unknown,
      args: { status?: number; limit?: number; offset?: number }
    ) => {
      const limit = clamp(args.limit, DEFAULT_LIMIT);
      const offset = args.offset ?? 0;
      const rows =
        args.status != null
          ? await query<ValidatorRow>(
              'SELECT * FROM validators WHERE status = $1 ORDER BY tokens DESC LIMIT $2 OFFSET $3',
              [args.status, limit, offset]
            )
          : await query<ValidatorRow>(
              'SELECT * FROM validators ORDER BY tokens DESC LIMIT $1 OFFSET $2',
              [limit, offset]
            );
      return rows.map(mapValidator);
    },

    validator: async (_: unknown, args: { operatorAddress: string }) => {
      const rows = await query<ValidatorRow>(
        'SELECT * FROM validators WHERE operator_address = $1',
        [args.operatorAddress]
      );
      return rows[0] ? mapValidator(rows[0]) : null;
    },

    // ── Contracts ────────────────────────────────────────────────────────────

    contract: async (_: unknown, args: { address: string }) => {
      const rows = await query<ContractRow>(
        'SELECT * FROM contracts WHERE address = $1',
        [args.address]
      );
      return rows[0] ? mapContract(rows[0]) : null;
    },

    contracts: async (
      _: unknown,
      args: { contractType?: string; limit?: number; offset?: number }
    ) => {
      const limit = clamp(args.limit, DEFAULT_LIMIT);
      const offset = args.offset ?? 0;
      const [rows, total] = args.contractType
        ? await Promise.all([
            query<ContractRow>(
              'SELECT * FROM contracts WHERE contract_type = $1 ORDER BY creation_block DESC LIMIT $2 OFFSET $3',
              [args.contractType, limit, offset]
            ),
            countRows('contracts', 'contract_type = $1', [args.contractType]),
          ])
        : await Promise.all([
            query<ContractRow>(
              'SELECT * FROM contracts ORDER BY creation_block DESC LIMIT $1 OFFSET $2',
              [limit, offset]
            ),
            countRows('contracts'),
          ]);
      return {
        items: rows.map(mapContract),
        pageInfo: { total, limit, offset, hasMore: offset + limit < total },
      };
    },

    // ── Token Transfers ──────────────────────────────────────────────────────

    tokenTransfers: async (
      _: unknown,
      args: { contractAddress?: string; address?: string; limit?: number; offset?: number }
    ) => {
      const limit = clamp(args.limit, DEFAULT_LIMIT);
      const offset = args.offset ?? 0;
      let where = '';
      const params: unknown[] = [];
      if (args.contractAddress) {
        params.push(args.contractAddress);
        where = `contract_address = $${params.length}`;
      } else if (args.address) {
        params.push(args.address);
        where = `from_address = $${params.length} OR to_address = $${params.length}`;
      }
      params.push(limit, offset);
      const [rows, total] = await Promise.all([
        query<TokenTransferRow>(
          `SELECT * FROM token_transfers${where ? ' WHERE ' + where : ''} ORDER BY timestamp DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params
        ),
        countRows('token_transfers', where, params.slice(0, -2)),
      ]);
      return {
        items: rows.map(mapTokenTransfer),
        pageInfo: { total, limit, offset, hasMore: offset + limit < total },
      };
    },

    // ── Proposals ────────────────────────────────────────────────────────────

    proposals: async (
      _: unknown,
      args: { status?: string; limit?: number; offset?: number }
    ) => {
      const limit = clamp(args.limit, DEFAULT_LIMIT);
      const offset = args.offset ?? 0;
      const rows = args.status
        ? await query<ProposalRow>(
            'SELECT * FROM proposals WHERE status = $1 ORDER BY id DESC LIMIT $2 OFFSET $3',
            [args.status, limit, offset]
          )
        : await query<ProposalRow>(
            'SELECT * FROM proposals ORDER BY id DESC LIMIT $1 OFFSET $2',
            [limit, offset]
          );
      return rows.map(mapProposal);
    },

    proposal: async (_: unknown, args: { id: string }) => {
      const rows = await query<ProposalRow>(
        'SELECT * FROM proposals WHERE id = $1',
        [args.id]
      );
      return rows[0] ? mapProposal(rows[0]) : null;
    },

    // ── Stats & State ────────────────────────────────────────────────────────

    networkStats: async () => {
      const rows = await query<StatsRow>(
        'SELECT * FROM network_stats ORDER BY recorded_at DESC LIMIT 1'
      );
      if (!rows[0]) return null;
      const r = rows[0];
      return {
        totalTransactions: r.total_transactions,
        totalAccounts: r.total_accounts,
        totalContracts: r.total_contracts,
        avgBlockTime: r.avg_block_time != null ? Number(r.avg_block_time) : null,
        avgGasPrice: r.avg_gas_price,
        dailyTransactions: r.daily_transactions,
        dailyActiveAccounts: r.daily_active_accounts,
        recordedAt: r.recorded_at instanceof Date ? r.recorded_at.toISOString() : String(r.recorded_at),
      };
    },

    indexerState: async () => {
      const rows = await query<StateRow>('SELECT key, value FROM indexer_state');
      const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      return {
        lastIndexedBlock: map['last_indexed_block'] ?? '0',
        lastIndexedEvmBlock: map['last_indexed_evm_block'] ?? '0',
        indexerVersion: map['indexer_version'] ?? '1.0.0',
      };
    },

    chainSummary: async () => {
      const [blockRow, txCount, accountCount, validatorCount, contractCount, statsRow] =
        await Promise.all([
          query<{ height: string }>(
            'SELECT height FROM blocks ORDER BY height DESC LIMIT 1'
          ),
          query<CountRow>('SELECT COUNT(*) AS count FROM transactions'),
          query<CountRow>('SELECT COUNT(*) AS count FROM accounts'),
          query<CountRow>('SELECT COUNT(*) AS count FROM validators WHERE status = 3'),
          query<CountRow>('SELECT COUNT(*) AS count FROM contracts'),
          query<StatsRow>('SELECT avg_block_time FROM network_stats ORDER BY recorded_at DESC LIMIT 1'),
        ]);
      return {
        latestBlock: blockRow[0] ? String(blockRow[0].height) : '0',
        totalTransactions: txCount[0]?.count ?? '0',
        totalAccounts: accountCount[0]?.count ?? '0',
        totalValidators: parseInt(validatorCount[0]?.count ?? '0', 10),
        totalContracts: contractCount[0]?.count ?? '0',
        avgBlockTime: statsRow[0]?.avg_block_time != null ? Number(statsRow[0].avg_block_time) : null,
      };
    },
  },

  // ── Field resolvers ──────────────────────────────────────────────────────────

  Block: {
    transactions: async (parent: { height: string }) => {
      const rows = await query<TxRow>(
        'SELECT * FROM transactions WHERE block_height = $1 ORDER BY tx_index ASC',
        [parent.height]
      );
      return rows.map(mapTx);
    },
  },
};
