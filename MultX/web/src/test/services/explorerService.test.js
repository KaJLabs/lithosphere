import axios from 'axios';
import {
  fetchRecentBlockMetas,
  fetchRecentTransactions,
  fetchTransactionsForBlock,
  mergeRecentTransactions
} from '../../services/explorerService';
import {
  buildBlockMeta,
  buildRestBlock,
  buildTxResponse,
  latestHeight,
  secondaryTxHash,
  secondaryTxPayloadBase64,
  timestampForHeight,
  txHash,
  txPayloadBase64
} from '../fixtures/explorerFixtures';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

describe('explorerService', () => {
  beforeEach(() => {
    axios.get.mockReset();
    axios.post.mockReset();
  });

  const buildTransactionRecord = (hash, height) => ({
    hash,
    evmHash: `0x${hash.toLowerCase()}`,
    blockHeight: height,
    timestamp: timestampForHeight(height),
    txResponse: buildTxResponse(hash, {
      height: String(height),
      timestamp: timestampForHeight(height)
    })
  });

  it('loads and sorts recent block metadata in descending height order', async () => {
    axios.get.mockImplementation((url) => {
      if (url.endsWith('/blocks/latest')) {
        return Promise.resolve({
          data: {
            block: {
              header: {
                height: String(latestHeight)
              }
            }
          }
        });
      }

      if (url.includes('/blockchain?')) {
        return Promise.resolve({
          data: {
            result: {
              block_metas: [
                buildBlockMeta(latestHeight - 1, 1),
                buildBlockMeta(latestHeight, 2)
              ]
            }
          }
        });
      }

      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });

    const blocks = await fetchRecentBlockMetas(2);
    expect(blocks.map((block) => Number(block.header.height))).toEqual([latestHeight, latestHeight - 1]);
  });

  it('computes tx hashes from block payloads and resolves tx responses', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('/cosmos/tx/v1beta1/txs/')) {
        const hash = url.split('/').pop();
        return Promise.resolve({
          data: {
            tx_response: buildTxResponse(hash)
          }
        });
      }

      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });

    const transactions = await fetchTransactionsForBlock(latestHeight, [txPayloadBase64]);
    expect(transactions).toHaveLength(1);
    expect(transactions[0].hash).toMatch(/^[A-F0-9]{64}$/);
    expect(transactions[0].evmHash).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it('scans recent blocks and deduplicates transactions', async () => {
    axios.get.mockImplementation((url) => {
      if (url.endsWith('/blocks/latest')) {
        return Promise.resolve({
          data: {
            block: {
              header: {
                height: String(latestHeight)
              }
            }
          }
        });
      }

      if (url.includes('/blockchain?')) {
        return Promise.resolve({
          data: {
            result: {
              block_metas: [
                buildBlockMeta(latestHeight, 2),
                buildBlockMeta(latestHeight - 1, 1)
              ]
            }
          }
        });
      }

      if (url.includes(`/blocks/${latestHeight}`)) {
        return Promise.resolve({
          data: {
            block: buildRestBlock(latestHeight, [txPayloadBase64, secondaryTxPayloadBase64])
          }
        });
      }

      if (url.includes(`/blocks/${latestHeight - 1}`)) {
        return Promise.resolve({
          data: {
            block: buildRestBlock(latestHeight - 1, [txPayloadBase64])
          }
        });
      }

      if (url.includes('/cosmos/tx/v1beta1/txs/')) {
        const hash = url.split('/').pop();
        return Promise.resolve({
          data: {
            tx_response: buildTxResponse(hash)
          }
        });
      }

      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });

    const transactions = await fetchRecentTransactions({ limit: 5, scanWindow: 10, batchSize: 5 });
    expect(transactions).toHaveLength(2);
    expect(new Set(transactions.map((tx) => tx.hash)).size).toBe(2);
  });

  it('expands beyond the initial scan window when recent blocks are empty', async () => {
    axios.get.mockImplementation((url) => {
      if (url.endsWith('/blocks/latest')) {
        return Promise.resolve({
          data: {
            block: {
              header: {
                height: String(latestHeight)
              }
            }
          }
        });
      }

      if (url.includes('/blockchain?minHeight=4239&maxHeight=4242')) {
        return Promise.resolve({
          data: {
            result: {
              block_metas: [
                buildBlockMeta(latestHeight, 0),
                buildBlockMeta(latestHeight - 1, 0),
                buildBlockMeta(latestHeight - 2, 0),
                buildBlockMeta(latestHeight - 3, 0)
              ]
            }
          }
        });
      }

      if (url.includes('/blockchain?minHeight=4235&maxHeight=4238')) {
        return Promise.resolve({
          data: {
            result: {
              block_metas: [
                buildBlockMeta(latestHeight - 4, 1),
                buildBlockMeta(latestHeight - 5, 0),
                buildBlockMeta(latestHeight - 6, 0),
                buildBlockMeta(latestHeight - 7, 0)
              ]
            }
          }
        });
      }

      if (url.includes(`/blocks/${latestHeight - 4}`)) {
        return Promise.resolve({
          data: {
            block: buildRestBlock(latestHeight - 4, [txPayloadBase64])
          }
        });
      }

      if (url.includes('/cosmos/tx/v1beta1/txs/')) {
        const hash = url.split('/').pop();
        return Promise.resolve({
          data: {
            tx_response: buildTxResponse(hash, {
              height: String(latestHeight - 4),
              timestamp: timestampForHeight(latestHeight - 4)
            })
          }
        });
      }

      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });

    const transactions = await fetchRecentTransactions({
      limit: 1,
      initialScanWindow: 4,
      maxScanWindow: 8,
      batchSize: 4
    });

    expect(transactions).toHaveLength(1);
    expect(transactions[0].blockHeight).toBe(latestHeight - 4);
    expect(
      axios.get.mock.calls.some(([url]) => url.includes('/blockchain?minHeight=4235&maxHeight=4238'))
    ).toBe(true);
  });

  it('merges background transactions by prepending new hashes and deduplicating existing rows', () => {
    const existingTransactions = [
      buildTransactionRecord(txHash, latestHeight - 2),
      buildTransactionRecord(secondaryTxHash, latestHeight - 5)
    ];
    const newestHash = 'F'.repeat(64);
    const incomingTransactions = [
      buildTransactionRecord(newestHash, latestHeight),
      buildTransactionRecord(txHash, latestHeight - 2)
    ];

    const transactions = mergeRecentTransactions(incomingTransactions, existingTransactions, 3);

    expect(transactions.map((transaction) => transaction.hash)).toEqual([
      newestHash,
      txHash,
      secondaryTxHash
    ]);
  });

  it('falls back to EVM RPC for faucet-style transaction hashes when Cosmos lookup returns 404', async () => {
    const {
      buildEvmBlock,
      buildEvmReceipt,
      buildEvmTransaction,
      evmAddress,
      evmTxHash,
      latestTime,
      secondaryEvmAddress
    } = await import('../fixtures/explorerFixtures');

    axios.get.mockImplementation((url) => {
      if (url.includes('/cosmos/tx/v1beta1/txs/')) {
        const error = new Error('Not found');
        error.response = { status: 404 };
        return Promise.reject(error);
      }

      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });

    axios.post.mockImplementation((url, payload) => {
      if (payload.method === 'eth_getTransactionByHash') {
        return Promise.resolve({
          data: {
            result: buildEvmTransaction(evmTxHash)
          }
        });
      }

      if (payload.method === 'eth_getTransactionReceipt') {
        return Promise.resolve({
          data: {
            result: buildEvmReceipt(evmTxHash)
          }
        });
      }

      if (payload.method === 'eth_getBlockByNumber') {
        return Promise.resolve({
          data: {
            result: buildEvmBlock()
          }
        });
      }

      return Promise.reject(new Error(`Unexpected payload: ${payload.method}`));
    });

    const { fetchTransactionByHash } = await import('../../services/explorerService');
    const transaction = await fetchTransactionByHash(evmTxHash);

    expect(transaction.source).toBe('EVM');
    expect(transaction.evmHash).toBe(evmTxHash);
    expect(transaction.from).toBe(evmAddress);
    expect(transaction.to).toBe(secondaryEvmAddress);
    expect(transaction.code).toBe(0);
    expect(transaction.timestamp).toBe(new Date(Math.floor(new Date(latestTime).getTime() / 1000) * 1000).toISOString());
  });
});
