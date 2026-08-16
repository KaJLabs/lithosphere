import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

export const latestHeight = 4242;
export const latestTime = '2026-04-17T10:03:34.041Z';
export const accountAddress = 'litho1qnk2n4nlkpw9xfqntladh74er2xa62wacf7c4';
export const secondaryAddress = 'litho1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq2sr89k';
export const evmAddress = '0x1234567890abcdef1234567890abcdef12345678';
export const secondaryEvmAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
export const validatorAddress = 'lithovaloper1zmyrt44ns3xnh4y6w875u62rhz6dpg4jx4yg34';
export const consensusAddress = 'lithovalcons1s2rxzrs0hezxqqt22yavlr00py66elruuxje4v';
export const supplyAmount = '1000000000000000000000000000';
export const txPayloadBase64 = Buffer.from('kamet-tx-alpha').toString('base64');
export const secondaryTxPayloadBase64 = Buffer.from('kamet-tx-beta').toString('base64');
export const txHash = createHash('sha256').update(Buffer.from('kamet-tx-alpha')).digest('hex').toUpperCase();
export const secondaryTxHash = createHash('sha256').update(Buffer.from('kamet-tx-beta')).digest('hex').toUpperCase();
export const evmTxHash = `0x${createHash('sha256').update(Buffer.from('kamet-evm-tx-alpha')).digest('hex')}`;

export const timestampForHeight = (height) =>
  new Date(Date.parse(latestTime) - (latestHeight - Number(height)) * 1000).toISOString();

export const buildBlockMeta = (height, txCount = 0) => ({
  block_id: {
    hash: `BLOCKHASH${height}`
  },
  header: {
    height: String(height),
    time: timestampForHeight(height),
    proposer_address: consensusAddress
  },
  num_txs: String(txCount)
});

export const buildRestBlock = (height, txs = []) => ({
  header: {
    height: String(height),
    time: timestampForHeight(height),
    proposer_address: consensusAddress,
    last_block_id: {
      hash: height > 1 ? `BLOCKHASH${height - 1}` : ''
    },
    app_hash: `APPHASH${height}`,
    validators_hash: `VALIDATORHASH${height}`
  },
  data: {
    txs
  }
});

export const buildTxResponse = (hash = txHash, overrides = {}) => ({
  txhash: hash,
  height: String(latestHeight),
  timestamp: latestTime,
  code: 0,
  gas_used: '21000',
  gas_wanted: '30000',
  tx: {
    body: {
      messages: [
        {
          '@type': '/cosmos.bank.v1beta1.MsgSend',
          from_address: accountAddress,
          to_address: secondaryAddress,
          amount: [
            {
              amount: '1000000000000000000',
              denom: 'ulitho'
            }
          ]
        }
      ],
      memo: 'test transfer'
    },
    auth_info: {
      fee: {
        amount: [
          {
            amount: '4200000000000000',
            denom: 'ulitho'
          }
        ]
      }
    }
  },
  events: [
    {
      type: 'transfer',
      attributes: [
        { key: 'sender', value: accountAddress },
        { key: 'recipient', value: secondaryAddress },
        { key: 'amount', value: '1000000000000000000ulitho' }
      ]
    },
    {
      type: 'tx',
      attributes: [
        { key: 'fee', value: '4200000000000000ulitho' }
      ]
    }
  ],
  ...overrides
});

export const buildEvmTransaction = (hash = evmTxHash, overrides = {}) => ({
  blockHash: `0x${'ab'.repeat(32)}`,
  blockNumber: `0x${latestHeight.toString(16)}`,
  from: evmAddress,
  gas: '0x5208',
  gasPrice: '0x59682f07',
  maxFeePerGas: '0x59682f0e',
  maxPriorityFeePerGas: '0x59682f00',
  hash,
  input: '0x',
  nonce: '0x19',
  to: secondaryEvmAddress,
  transactionIndex: '0x0',
  value: '0xde0b6b3a7640000',
  type: '0x2',
  accessList: [],
  chainId: '0xdbdab',
  ...overrides
});

export const buildEvmReceipt = (hash = evmTxHash, overrides = {}) => ({
  blockHash: `0x${'ab'.repeat(32)}`,
  blockNumber: `0x${latestHeight.toString(16)}`,
  contractAddress: null,
  cumulativeGasUsed: '0x5208',
  effectiveGasPrice: '0x59682f07',
  from: evmAddress,
  gasUsed: '0x5208',
  logs: [],
  logsBloom: `0x${'00'.repeat(256)}`,
  status: '0x1',
  to: secondaryEvmAddress,
  transactionHash: hash,
  transactionIndex: '0x0',
  type: '0x2',
  ...overrides
});

export const buildEvmBlock = (height = latestHeight, overrides = {}) => ({
  number: `0x${Number(height).toString(16)}`,
  timestamp: `0x${Math.floor(new Date(timestampForHeight(height)).getTime() / 1000).toString(16)}`,
  hash: `0x${'cd'.repeat(32)}`,
  ...overrides
});

export const validators = [
  {
    operator_address: validatorAddress,
    description: {
      moniker: 'kamet-validator-aws'
    },
    status: 'BOND_STATUS_BONDED',
    jailed: false,
    tokens: '50000000000000000000000000',
    commission: {
      commission_rates: {
        rate: '0.100000000000000000'
      }
    }
  },
  {
    operator_address: 'lithovaloper1ayn8hhmssjq4kp6523gyntj9le6y4magcl4s2n',
    description: {
      moniker: 'kamet-val-02'
    },
    status: 'BOND_STATUS_BONDED',
    jailed: false,
    tokens: '1000000000000000000000',
    commission: {
      commission_rates: {
        rate: '0.100000000000000000'
      }
    }
  },
  {
    operator_address: 'lithovaloper1jailed0000000000000000000000000000000',
    description: {
      moniker: 'kamet-val-03-gcp'
    },
    status: 'BOND_STATUS_UNBONDING',
    jailed: true,
    tokens: '100000000000000000000',
    commission: {
      commission_rates: {
        rate: '0.200000000000000000'
      }
    }
  }
];

export const accountRecord = {
  '@type': '/cosmos.auth.v1beta1.BaseAccount',
  address: accountAddress,
  account_number: '7',
  sequence: '13'
};

export const balances = [
  {
    denom: 'ulitho',
    amount: '123450000000000000000'
  }
];

export const delegations = [
  {
    delegation: {
      validator_address: validatorAddress,
      shares: '123450000000000000000.000000000000000000'
    },
    balance: {
      amount: '123450000000000000000'
    }
  }
];
