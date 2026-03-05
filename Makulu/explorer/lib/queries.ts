// ── Chain Summary ──────────────────────────────────────────────────────────────
export const CHAIN_SUMMARY = `
  query ChainSummary {
    chainSummary {
      latestBlock
      totalTransactions
      totalAccounts
      totalValidators
      totalContracts
      avgBlockTime
    }
  }
`;

// ── Blocks ────────────────────────────────────────────────────────────────────
export const LATEST_BLOCKS = `
  query LatestBlocks($limit: Int) {
    blocks(limit: $limit) {
      items { height hash proposerAddress numTxs totalGas blockTime }
      pageInfo { total limit offset hasMore }
    }
  }
`;

export const BLOCKS = `
  query Blocks($limit: Int, $offset: Int) {
    blocks(limit: $limit, offset: $offset) {
      items { height hash proposerAddress numTxs totalGas blockTime }
      pageInfo { total limit offset hasMore }
    }
  }
`;

export const BLOCK_DETAIL = `
  query BlockDetail($height: String) {
    block(height: $height) {
      height hash proposerAddress numTxs totalGas blockTime
      transactions {
        id hash txType sender receiver amount denom gasUsed success timestamp
      }
    }
  }
`;

// ── Cosmos Transactions ───────────────────────────────────────────────────────
export const LATEST_TRANSACTIONS = `
  query LatestTransactions($limit: Int) {
    transactions(limit: $limit) {
      items { id hash blockHeight txType sender receiver amount denom success timestamp }
      pageInfo { total limit offset hasMore }
    }
  }
`;

export const TRANSACTIONS = `
  query Transactions($limit: Int, $offset: Int) {
    transactions(limit: $limit, offset: $offset) {
      items {
        id hash blockHeight txIndex txType sender receiver
        amount denom gasUsed gasWanted fee feeDenom success memo timestamp
      }
      pageInfo { total limit offset hasMore }
    }
  }
`;

export const TRANSACTION_DETAIL = `
  query TransactionDetail($hash: String!) {
    transaction(hash: $hash) {
      id hash blockHeight txIndex txType sender receiver
      amount denom gasUsed gasWanted fee feeDenom success memo rawLog timestamp
    }
  }
`;

export const TRANSACTIONS_BY_BLOCK = `
  query TransactionsByBlock($height: String!, $limit: Int, $offset: Int) {
    transactionsByBlock(height: $height, limit: $limit, offset: $offset) {
      items {
        id hash blockHeight txIndex txType sender receiver
        amount denom gasUsed success timestamp
      }
      pageInfo { total limit offset hasMore }
    }
  }
`;

export const TRANSACTIONS_BY_ADDRESS = `
  query TransactionsByAddress($address: String!, $limit: Int, $offset: Int) {
    transactionsByAddress(address: $address, limit: $limit, offset: $offset) {
      items {
        id hash blockHeight txType sender receiver
        amount denom gasUsed success timestamp
      }
      pageInfo { total limit offset hasMore }
    }
  }
`;

// ── EVM Transactions ──────────────────────────────────────────────────────────
export const EVM_TRANSACTIONS = `
  query EvmTransactions($limit: Int, $offset: Int) {
    evmTransactions(limit: $limit, offset: $offset) {
      items {
        id hash cosmosTxHash blockHeight txIndex fromAddress toAddress
        value gasPrice gasLimit gasUsed nonce contractAddress status timestamp
      }
      pageInfo { total limit offset hasMore }
    }
  }
`;

export const EVM_TRANSACTION_DETAIL = `
  query EvmTransactionDetail($hash: String!) {
    evmTransaction(hash: $hash) {
      id hash cosmosTxHash blockHeight txIndex fromAddress toAddress
      value gasPrice gasLimit gasUsed nonce inputData contractAddress status timestamp
    }
  }
`;

export const EVM_TRANSACTIONS_BY_ADDRESS = `
  query EvmTransactionsByAddress($address: String!, $limit: Int, $offset: Int) {
    evmTransactionsByAddress(address: $address, limit: $limit, offset: $offset) {
      items {
        id hash blockHeight fromAddress toAddress value gasUsed status timestamp
      }
      pageInfo { total limit offset hasMore }
    }
  }
`;

// ── Accounts ──────────────────────────────────────────────────────────────────
export const ACCOUNT_DETAIL = `
  query AccountDetail($address: String!) {
    account(address: $address) {
      address evmAddress balance sequence accountNumber accountType
      firstSeenBlock lastSeenBlock txCount createdAt updatedAt
    }
  }
`;

export const ACCOUNTS = `
  query Accounts($limit: Int, $offset: Int) {
    accounts(limit: $limit, offset: $offset) {
      address evmAddress balance txCount
    }
  }
`;

// ── Validators ────────────────────────────────────────────────────────────────
export const VALIDATORS = `
  query Validators($status: Int, $limit: Int, $offset: Int) {
    validators(status: $status, limit: $limit, offset: $offset) {
      operatorAddress consensusAddress moniker tokens
      delegatorShares commissionRate status jailed
      uptimePercentage missedBlocksCounter
    }
  }
`;

export const VALIDATOR_DETAIL = `
  query ValidatorDetail($operatorAddress: String!) {
    validator(operatorAddress: $operatorAddress) {
      operatorAddress consensusAddress moniker identity website details
      commissionRate commissionMaxRate tokens delegatorShares
      status jailed uptimePercentage missedBlocksCounter updatedAt
    }
  }
`;

// ── Contracts ─────────────────────────────────────────────────────────────────
export const CONTRACTS = `
  query Contracts($contractType: String, $limit: Int, $offset: Int) {
    contracts(contractType: $contractType, limit: $limit, offset: $offset) {
      items {
        address creator name symbol decimals contractType verified
        creationBlock createdAt
      }
      pageInfo { total limit offset hasMore }
    }
  }
`;

export const CONTRACT_DETAIL = `
  query ContractDetail($address: String!) {
    contract(address: $address) {
      address creator creationTx creationBlock verified
      name symbol decimals totalSupply contractType createdAt updatedAt
    }
  }
`;

// ── Token Transfers ───────────────────────────────────────────────────────────
export const TOKEN_TRANSFERS = `
  query TokenTransfers($contractAddress: String, $address: String, $limit: Int, $offset: Int) {
    tokenTransfers(contractAddress: $contractAddress, address: $address, limit: $limit, offset: $offset) {
      items {
        id txHash logIndex contractAddress fromAddress toAddress
        value tokenId blockHeight timestamp
      }
      pageInfo { total limit offset hasMore }
    }
  }
`;

// ── Proposals ─────────────────────────────────────────────────────────────────
export const PROPOSALS = `
  query Proposals($status: String, $limit: Int, $offset: Int) {
    proposals(status: $status, limit: $limit, offset: $offset) {
      id title status proposalType proposer
      submitTime votingEndTime totalDeposit
      yesVotes noVotes abstainVotes noWithVetoVotes
    }
  }
`;

export const PROPOSAL_DETAIL = `
  query ProposalDetail($id: String!) {
    proposal(id: $id) {
      id title description proposalType proposer status
      submitTime depositEndTime votingStartTime votingEndTime
      totalDeposit yesVotes noVotes abstainVotes noWithVetoVotes updatedAt
    }
  }
`;

// ── Stats ─────────────────────────────────────────────────────────────────────
export const NETWORK_STATS = `
  query NetworkStats {
    networkStats {
      totalTransactions totalAccounts totalContracts
      avgBlockTime avgGasPrice dailyTransactions dailyActiveAccounts recordedAt
    }
  }
`;

export const INDEXER_STATE = `
  query IndexerState {
    indexerState {
      lastIndexedBlock lastIndexedEvmBlock indexerVersion
    }
  }
`;
