import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchExplorerSummary, fetchTransactionsPage } from '../../services/explorerDataService';
import {
  accountAddress,
  buildBlockMeta,
  buildRestBlock,
  latestHeight,
  secondaryEvmAddress,
  timestampForHeight,
  txPayloadBase64,
  validators
} from '../fixtures/explorerFixtures';
import { toHexAddress } from '../../helpers/explorer';

const axiosMock = vi.hoisted(() => {
  const mock = {
    get: vi.fn(),
    post: vi.fn(),
    create: null
  };

  mock.create = vi.fn(() => mock);
  return mock;
});

vi.mock('axios', () => ({
  default: axiosMock
}));

describe('explorerDataService', () => {
  beforeEach(() => {
    axiosMock.get.mockReset();
    axiosMock.post.mockReset();
  });

  it('uses indexed transaction totals when the explorer data API is available', async () => {
    const evmHash = `0x${'81'.repeat(32)}`;
    const cosmosHash = '2B2E2303BEB71BB4F2838CECA74FA039B8AF88CB54A416680EC11BD44FC99142';

    axiosMock.get.mockImplementation((url) => {
      if (url.includes('/api/txs?limit=2&offset=0')) {
        return Promise.resolve({
          headers: {
            'content-type': 'application/json'
          },
          data: JSON.stringify({
            txs: [
              {
                hash: cosmosHash,
                evmHash,
                blockHeight: latestHeight,
                fromAddr: accountAddress,
                toAddr: 'litho17xpfvakm2amg962yls6f84z3kell8c5lq208m2',
                value: '1000000000000000000',
                denom: 'ulitho',
                feePaid: '147000',
                gasUsed: '21000',
                gasWanted: '21000',
                success: true,
                method: 'MsgTx',
                txType: 'transfer',
                timestamp: timestampForHeight(latestHeight),
                inputData: '0x',
                evmFromAddr: toHexAddress(accountAddress),
                evmToAddr: secondaryEvmAddress
              }
            ],
            total: 215235,
            limit: 2,
            offset: 0
          })
        });
      }

      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });

    const page = await fetchTransactionsPage({ page: 1, pageSize: 2 });

    expect(page.total).toBe(215235);
    expect(page.totalPages).toBe(107618);
    expect(page.source).toBe('indexed');
    expect(page.items[0]).toMatchObject({
      hash: cosmosHash,
      evmHash,
      amount: '1000000000000000000',
      amountDisplay: '1 LITHO',
      feeDisplay: '1,470 Strat'
    });
  });

  it('maps EVM transaction feed rows from EVM payload values instead of Cosmos fee events', async () => {
    const evmHash = `0x${'80'.repeat(32)}`;
    const cosmosHash = '1B2E2303BEB71BB4F2838CECA74FA039B8AF88CB54A416680EC11BD44FC99142';
    const feeAmount = '31500000294000';
    const evmValue = '1000000000000000000';

    axiosMock.get.mockImplementation((url) => {
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
              block_metas: [buildBlockMeta(latestHeight, 1)]
            }
          }
        });
      }

      if (url.includes(`/blocks/${latestHeight}`)) {
        return Promise.resolve({
          data: {
            block: buildRestBlock(latestHeight, [txPayloadBase64])
          }
        });
      }

      if (url.includes('/cosmos/tx/v1beta1/txs/')) {
        return Promise.resolve({
          data: {
            tx_response: {
              txhash: cosmosHash,
              height: String(latestHeight),
              timestamp: timestampForHeight(latestHeight),
              code: 0,
              gas_used: '21000',
              gas_wanted: '21000',
              tx: {
                body: {
                  messages: [
                    {
                      '@type': '/ethermint.evm.v1.MsgEthereumTx',
                      data: {
                        '@type': '/ethermint.evm.v1.DynamicFeeTx',
                        to: secondaryEvmAddress,
                        value: evmValue,
                        data: null
                      },
                      hash: evmHash,
                      from: ''
                    }
                  ],
                  memo: ''
                },
                auth_info: {
                  fee: {
                    amount: [
                      {
                        amount: feeAmount,
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
                    { key: 'recipient', value: 'litho17xpfvakm2amg962yls6f84z3kell8c5lq208m2' },
                    { key: 'amount', value: '31500000147000ulitho' }
                  ]
                },
                {
                  type: 'message',
                  attributes: [
                    { key: 'sender', value: accountAddress }
                  ]
                },
                {
                  type: 'ethereum_tx',
                  attributes: [
                    { key: 'ethereumTxHash', value: evmHash },
                    { key: 'recipient', value: secondaryEvmAddress }
                  ]
                }
              ]
            }
          }
        });
      }

      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });

    const page = await fetchTransactionsPage({ page: 1, pageSize: 15 });
    const transaction = page.items[0];

    expect(transaction.evmHash).toBe(evmHash);
    expect(transaction.method).toBe('Transfer');
    expect(transaction.txType).toBe('transfer');
    expect(transaction.amount).toBe(evmValue);
    expect(transaction.amountDisplay).toBe('1 LITHO');
    expect(transaction.evmFromAddress).toBe(toHexAddress(accountAddress));
    expect(transaction.evmToAddress).toBe(secondaryEvmAddress);
    expect(transaction.feeDisplay).toBe('315,000,002,940 Strat');
  });

  it('loads homepage latest transactions from the indexed API instead of the live tx query', async () => {
    const evmHash = `0x${'82'.repeat(32)}`;
    const cosmosHash = '3B2E2303BEB71BB4F2838CECA74FA039B8AF88CB54A416680EC11BD44FC99142';

    axiosMock.get.mockImplementation((url) => {
      if (url.includes('/api/stats/summary')) {
        return Promise.resolve({
          headers: { 'content-type': 'application/json' },
          data: JSON.stringify({
            tipHeight: latestHeight,
            chainTipHeight: latestHeight + 10,
            totalTransactions: 215235,
            walletAddresses: 123145,
            avgBlockTime: 6.3,
            gasPriceWei: '7',
            latestBlockTimestamp: timestampForHeight(latestHeight)
          })
        });
      }

      if (url.includes('/api/txs?limit=8&offset=0')) {
        return Promise.resolve({
          headers: { 'content-type': 'application/json' },
          data: JSON.stringify({
            txs: [
              {
                hash: cosmosHash,
                evmHash,
                blockHeight: latestHeight,
                fromAddr: accountAddress,
                toAddr: secondaryEvmAddress,
                value: '1000000000000000000',
                denom: 'ulitho',
                feePaid: '147000',
                gasUsed: '21000',
                gasWanted: '21000',
                success: true,
                method: 'MsgTx',
                txType: 'transfer',
                timestamp: timestampForHeight(latestHeight),
                inputData: '0x'
              }
            ],
            total: 215235
          })
        });
      }

      if (url.endsWith('/blocks/latest')) {
        return Promise.resolve({
          data: {
            block: buildRestBlock(latestHeight, [])
          }
        });
      }

      if (url.includes('/blockchain?')) {
        return Promise.resolve({
          data: {
            result: {
              block_metas: [
                buildBlockMeta(latestHeight, 1),
                buildBlockMeta(latestHeight - 1, 0)
              ]
            }
          }
        });
      }

      if (url.includes('/cosmos/staking/v1beta1/validators')) {
        return Promise.resolve({
          data: {
            validators: url.includes('BOND_STATUS_BONDED') ? validators : [],
            pagination: {}
          }
        });
      }

      if (url.includes('/api/status')) {
        return Promise.resolve({
          data: {
            tps: 3.2,
            lastUpdated: timestampForHeight(latestHeight)
          }
        });
      }

      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });
    axiosMock.post.mockResolvedValue({
      data: {
        result: '0x7'
      }
    });

    const summary = await fetchExplorerSummary();

    expect(summary.totalTransactions).toBe(215235);
    expect(summary.latestTransactions).toHaveLength(1);
    expect(summary.latestTransactions[0]).toMatchObject({
      hash: cosmosHash,
      evmHash,
      source: 'INDEXED'
    });
    expect(axiosMock.get.mock.calls.some(([url]) => url.includes('/cosmos/tx/v1beta1/txs'))).toBe(false);
  });
});
