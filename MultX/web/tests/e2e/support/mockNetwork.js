import { ethers } from 'ethers';
import { ERC20_ABI, KAMET_KNOWN_TOKENS } from '../../../src/data/kametRegistry.js';
import {
  accountAddress,
  balances,
  buildBlockMeta,
  buildEvmBlock,
  buildEvmReceipt,
  buildEvmTransaction,
  buildRestBlock,
  buildTxResponse,
  delegations,
  evmAddress,
  evmTxHash,
  latestHeight,
  secondaryTxHash,
  secondaryTxPayloadBase64,
  secondaryAddress,
  secondaryEvmAddress,
  supplyAmount,
  txHash,
  txPayloadBase64,
  validatorAddress,
  validators
} from '../../../src/test/fixtures/explorerFixtures.js';

const knownToken = KAMET_KNOWN_TOKENS[0];
const erc20Interface = new ethers.utils.Interface(ERC20_ABI);
const transferTopic = ethers.utils.id('Transfer(address,address,uint256)');
const paddedEvmAddress = ethers.utils.hexZeroPad(evmAddress, 32);
const paddedSecondaryEvmAddress = ethers.utils.hexZeroPad(secondaryEvmAddress, 32);
const knownTokenBalance = ethers.utils.parseUnits('25', 18);
const knownTokenTransferValue = ethers.utils.parseUnits('25', 18);

const jsonResponse = (body) => ({
  status: 200,
  headers: {
    'content-type': 'application/json'
  },
  body: JSON.stringify(body)
});

export const contractAddress = secondaryEvmAddress;
export { accountAddress, evmAddress, evmTxHash, latestHeight, txHash, validatorAddress };

export async function installKametApiMocks(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {}
      }
    });
  });

  await page.route('https://api-3.litho.ai/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();

    const transactionResponses = [
      buildTxResponse(txHash, {
        height: String(latestHeight),
        timestamp: '2026-04-17T10:03:34.041Z'
      }),
      buildTxResponse(secondaryTxHash, {
        height: String(latestHeight - 1),
        timestamp: '2026-04-17T10:03:30.041Z',
        tx: {
          body: {
            messages: [
              {
                '@type': '/cosmos.bank.v1beta1.MsgSend',
                from_address: secondaryAddress,
                to_address: accountAddress,
                amount: [
                  {
                    amount: '500000000000000000',
                    denom: 'ulitho'
                  }
                ]
              }
            ],
            memo: 'secondary transfer'
          },
          auth_info: {
            fee: {
              amount: [
                {
                  amount: '2100000000000000',
                  denom: 'ulitho'
                }
              ]
            }
          }
        }
      })
    ];

    if (url.pathname === '/faucet/claim' && method === 'POST') {
      return route.fulfill({
        status: 503,
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          ok: false,
          message: 'Explorer claim service is temporarily unavailable while Kamet maintenance completes.'
        })
      });
    }

    if (url.pathname.endsWith('/blocks/latest')) {
      return route.fulfill(
        jsonResponse({
          block: buildRestBlock(latestHeight, [txPayloadBase64, secondaryTxPayloadBase64])
        })
      );
    }

    if (/\/cosmos\/base\/tendermint\/v1beta1\/blocks\/\d+$/.test(url.pathname)) {
      const height = Number(url.pathname.split('/').pop());
      const txs = height === latestHeight ? [txPayloadBase64, secondaryTxPayloadBase64] : [txPayloadBase64];
      return route.fulfill(
        jsonResponse({
          block: buildRestBlock(height, txs)
        })
      );
    }

    if (url.pathname.includes('/cosmos/tx/v1beta1/txs/')) {
      const hash = url.pathname.split('/').pop().replace(/^0x/i, '').toUpperCase();

      if (hash === evmTxHash.replace(/^0x/i, '').toUpperCase()) {
        return route.fulfill({
          status: 404,
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            code: 5,
            message: 'tx not found'
          })
        });
      }

      return route.fulfill(
        jsonResponse({
          tx_response: buildTxResponse(hash, {
            height: String(latestHeight),
            timestamp: '2026-04-17T10:03:34.041Z'
          })
        })
      );
    }

    if (url.pathname.endsWith('/cosmos/tx/v1beta1/txs')) {
      return route.fulfill(
        jsonResponse({
          txs: transactionResponses.map((item) => item.tx),
          tx_responses: transactionResponses,
          pagination: {
            next_key: null,
            total: String(transactionResponses.length)
          },
          total: String(transactionResponses.length)
        })
      );
    }

    if (url.pathname.includes('/cosmos/auth/v1beta1/accounts/')) {
      return route.fulfill(
        jsonResponse({
          account: {
            '@type': '/cosmos.auth.v1beta1.BaseAccount',
            address: accountAddress,
            account_number: '7',
            sequence: '13'
          }
        })
      );
    }

    if (url.pathname.includes('/cosmos/bank/v1beta1/balances/') && url.pathname.includes('/by_denom')) {
      return route.fulfill(
        jsonResponse({
          amount: {
            amount: supplyAmount,
            denom: 'ulitho'
          }
        })
      );
    }

    if (url.pathname.includes('/cosmos/bank/v1beta1/balances/')) {
      return route.fulfill(
        jsonResponse({
          balances
        })
      );
    }

    if (url.pathname.includes('/cosmos/bank/v1beta1/supply/by_denom')) {
      return route.fulfill(
        jsonResponse({
          amount: {
            amount: supplyAmount,
            denom: 'ulitho'
          }
        })
      );
    }

    if (url.pathname.includes('/cosmos/staking/v1beta1/validators')) {
      return route.fulfill(
        jsonResponse({
          validators,
          pagination: {
            next_key: null,
            total: String(validators.length)
          }
        })
      );
    }

    if (url.pathname.includes('/cosmos/staking/v1beta1/delegations/')) {
      return route.fulfill(
        jsonResponse({
          delegation_responses: delegations
        })
      );
    }

    if (url.pathname.includes('/cosmos/slashing/v1beta1/signing_infos')) {
      return route.fulfill(
        jsonResponse({
          info: [
            {
              address: validatorAddress,
              missed_blocks_counter: '0'
            }
          ]
        })
      );
    }

    if (url.pathname.includes('/cosmos/slashing/v1beta1/params')) {
      return route.fulfill(
        jsonResponse({
          params: {
            signed_blocks_window: '10000'
          }
        })
      );
    }

    return route.fulfill(jsonResponse({}));
  });

  await page.route('https://status.litho.ai/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === '/api/status') {
      return route.fulfill(
        jsonResponse({
          kamet: {
            id: 'kamet',
            name: 'Kamet Testnet',
            chainId: 'lithosphere_900523-2',
            blockHeight: latestHeight,
            avgBlockTime: 1000,
            tps: 2.5,
            recentTxCount: 24,
            statusLevel: 'operational',
            statusMessage: 'All monitored endpoints operational',
            latestBlockTime: '2026-04-17T10:03:34.041Z',
            lastUpdated: '2026-04-17T10:03:36.041Z',
            onlineNodes: 2,
            totalNodes: 2,
            nodes: [
              {
                key: 'rpc-primary',
                endpoint: 'rpc.kamet.litho.ai',
                displayName: 'kamet-public-rpc',
                probe: 'rpc',
                kind: 'node',
                latency: 12,
                blockHeight: latestHeight,
                peersCount: 4,
                syncStatus: 'synced',
                lastChecked: '2026-04-17T10:03:36.041Z'
              },
              {
                key: 'evm-primary',
                endpoint: 'rpc.kamet.litho.ai',
                displayName: 'kamet-public-gateway',
                probe: 'evm',
                kind: 'gateway',
                latency: 18,
                blockHeight: latestHeight,
                peersCount: 4,
                syncStatus: 'synced',
                lastChecked: '2026-04-17T10:03:36.041Z'
              }
            ]
          }
        })
      );
    }

    if (url.pathname === '/api/metrics') {
      const activeIncident = {
        network: 'kamet',
        type: 'rpc_latency',
        title: 'Public RPC latency spike',
        message: 'Kamet public RPC latency is above the normal production threshold.',
        details:
          'Traffic is being shifted away from the degraded gateway while the public RPC node is rebalanced.',
        impact: 'Users may see slower explorer and RPC responses while routing is rebalanced.',
        root_cause: 'A primary public RPC gateway crossed the latency SLO during peak traffic.',
        resolution: 'Traffic is being shifted to the secondary gateway while the primary node is drained.',
        severity: 'warning',
        status: 'investigating',
        component: 'rpc',
        source: 'status monitor',
        tags: ['public-rpc', 'latency'],
        node: 'rpc.kamet.litho.ai',
        affected_endpoints: ['rpc.kamet.litho.ai', 'rest.kamet.litho.ai'],
        started_at: '2026-04-17T09:58:00.000Z',
        last_event_at: '2026-04-17T10:02:00.000Z',
        updated_at: '2026-04-17T10:02:30.000Z',
        incident_url: 'https://status.litho.ai/incidents/kamet-rpc-latency',
        updates: [
          {
            title: 'Traffic shift started',
            message: 'Requests are being moved off the primary gateway.',
            details: 'Read traffic is draining to the secondary RPC endpoint while the primary pool is rebalanced.',
            status: 'investigating',
            component: 'rpc',
            source: 'status monitor',
            author: 'on-call',
            timestamp: '2026-04-17T10:01:30.000Z',
            link: 'https://status.litho.ai/incidents/kamet-rpc-latency#update-1'
          }
        ]
      };
      const recentEvent = {
        network: 'kamet',
        type: 'indexer_recovery',
        title: 'Indexer sync recovered',
        message: 'Indexer ingestion caught up after a brief delay.',
        details:
          'The ingestion worker recovered cleanly and explorer freshness returned to nominal levels.',
        severity: 'info',
        status: 'resolved',
        component: 'indexer',
        source: 'status monitor',
        affected_endpoints: ['indexer', 'search'],
        timestamp: '2026-04-17T09:45:00.000Z',
        created_at: '2026-04-17T09:40:00.000Z',
        acknowledged_at: '2026-04-17T09:41:00.000Z',
        updated_at: '2026-04-17T09:45:00.000Z',
        resolved_at: '2026-04-17T09:45:00.000Z',
        link: 'https://status.litho.ai/incidents/kamet-indexer-recovered'
      };
      const componentStatus = {
        network: 'kamet',
        key: 'search-api',
        title: 'Explorer Search API',
        component: 'search',
        kind: 'api',
        status: 'operational',
        message: 'Search lookups are responding within the current SLO.',
        details: 'Search resolution remained stable during the last monitoring window.',
        source: 'status monitor',
        latency_ms: 28,
        uptime_pct: 99.97,
        updated_at: '2026-04-17T10:03:34.000Z',
        affected_endpoints: ['search', 'api.kamet.litho.ai'],
        link: 'https://status.litho.ai/components/search-api'
      };
      const historicalIncident = {
        network: 'kamet',
        type: 'rest_saturation',
        title: 'REST gateway saturation',
        message: 'The public REST gateway returned elevated latency during a deployment window.',
        details: 'Traffic was redistributed to the secondary gateway and latency returned to normal.',
        resolution: 'Traffic was redistributed to the secondary gateway and latency returned to normal.',
        severity: 'warning',
        status: 'resolved',
        component: 'rest',
        source: 'status monitor',
        affected_endpoints: ['api.kamet.litho.ai'],
        started_at: '2026-04-16T18:12:00.000Z',
        last_event_at: '2026-04-16T18:18:00.000Z',
        updated_at: '2026-04-16T18:19:00.000Z',
        resolved_at: '2026-04-16T18:19:00.000Z',
        incident_url: 'https://status.litho.ai/incidents/kamet-rest-saturation',
        postmortem_url: 'https://status.litho.ai/postmortems/kamet-rest-saturation'
      };
      const scheduledMaintenance = {
        network: 'kamet',
        type: 'maintenance',
        title: 'Search reindex window',
        message: 'Explorer search will run in a degraded mode during a short index rebuild window.',
        details:
          'Read-only explorer pages stay online while token-holder caches and search projections are rebuilt.',
        severity: 'info',
        status: 'scheduled',
        component: 'search',
        source: 'status monitor',
        affected_endpoints: ['search', 'api.kamet.litho.ai'],
        scheduled_for: '2026-04-17T12:00:00.000Z',
        window_end: '2026-04-17T12:30:00.000Z',
        estimated_duration_ms: 1800000,
        updated_at: '2026-04-17T10:03:36.041Z',
        maintenance_url: 'https://status.litho.ai/maintenances/kamet-search-reindex',
        updates: [
          {
            title: 'Read-only mode prepared',
            message: 'Holder caches will rebuild behind the public read path.',
            status: 'scheduled',
            component: 'search',
            source: 'status monitor',
            timestamp: '2026-04-17T10:04:00.000Z'
          }
        ]
      };

      return route.fulfill(
        jsonResponse({
          active_alert_count: 1,
          active_alerts: [activeIncident],
          recent_events: [recentEvent],
          component_statuses: [componentStatus],
          incident_history: [historicalIncident],
          scheduled_maintenance: [scheduledMaintenance],
          summary: {
            active_alert_count: 1,
            recent_event_count: 1,
            incident_history_count: 1,
            maintenance_count: 1,
            component_count: 1,
            operational_components: 1,
            degraded_components: 0,
            unavailable_components: 0,
            availability_pct: 99.98,
            updated_at: '2026-04-17T10:03:36.041Z'
          },
          alerts: [recentEvent],
          timestamp: '2026-04-17T10:03:36.041Z'
        })
      );
    }

    return route.fulfill(jsonResponse({}));
  });

  await page.route('https://rpc-3.litho.ai/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();

    if (method === 'POST') {
      const payload = route.request().postDataJSON();

      if (payload?.method === 'eth_getTransactionByHash') {
        return route.fulfill(
          jsonResponse({
            jsonrpc: '2.0',
            id: payload.id || 1,
            result: buildEvmTransaction(payload.params?.[0] || evmTxHash)
          })
        );
      }

      if (payload?.method === 'eth_getTransactionReceipt') {
        return route.fulfill(
          jsonResponse({
            jsonrpc: '2.0',
            id: payload.id || 1,
            result: buildEvmReceipt(payload.params?.[0] || evmTxHash)
          })
        );
      }

      if (payload?.method === 'eth_getBlockByNumber') {
        return route.fulfill(
          jsonResponse({
            jsonrpc: '2.0',
            id: payload.id || 1,
            result: buildEvmBlock()
          })
        );
      }

      if (payload?.method === 'eth_blockNumber') {
        return route.fulfill(
          jsonResponse({
            jsonrpc: '2.0',
            id: payload.id || 1,
            result: `0x${latestHeight.toString(16)}`
          })
        );
      }

      if (payload?.method === 'eth_chainId') {
        return route.fulfill(
          jsonResponse({
            jsonrpc: '2.0',
            id: payload.id || 1,
            result: '0xdbdab'
          })
        );
      }

      if (payload?.method === 'net_version') {
        return route.fulfill(
          jsonResponse({
            jsonrpc: '2.0',
            id: payload.id || 1,
            result: '900523'
          })
        );
      }

      if (payload?.method === 'eth_getBalance') {
        return route.fulfill(
          jsonResponse({
            jsonrpc: '2.0',
            id: payload.id || 1,
            result: '0xde0b6b3a7640000'
          })
        );
      }

      if (payload?.method === 'eth_gasPrice') {
        return route.fulfill(
          jsonResponse({
            jsonrpc: '2.0',
            id: payload.id || 1,
            result: '0x7'
          })
        );
      }

      if (payload?.method === 'eth_getCode') {
        const target = String(payload.params?.[0] || '').toLowerCase();
        return route.fulfill(
          jsonResponse({
            jsonrpc: '2.0',
            id: payload.id || 1,
            result: target === contractAddress.toLowerCase() ? '0x6001600055' : '0x'
          })
        );
      }

      if (payload?.method === 'eth_getLogs' || payload?.method === 'eth_call') {
        if (payload.method === 'eth_call') {
          const target = String(payload.params?.[0]?.to || '').toLowerCase();
          const data = String(payload.params?.[0]?.data || '');

          if (target === knownToken.address.toLowerCase()) {
            if (data.startsWith(erc20Interface.getSighash('balanceOf'))) {
              return route.fulfill(
                jsonResponse({
                  jsonrpc: '2.0',
                  id: payload.id || 1,
                  result: erc20Interface.encodeFunctionResult('balanceOf', [knownTokenBalance])
                })
              );
            }

            if (data.startsWith(erc20Interface.getSighash('name'))) {
              return route.fulfill(
                jsonResponse({
                  jsonrpc: '2.0',
                  id: payload.id || 1,
                  result: erc20Interface.encodeFunctionResult('name', [knownToken.name])
                })
              );
            }

            if (data.startsWith(erc20Interface.getSighash('symbol'))) {
              return route.fulfill(
                jsonResponse({
                  jsonrpc: '2.0',
                  id: payload.id || 1,
                  result: erc20Interface.encodeFunctionResult('symbol', [knownToken.symbol])
                })
              );
            }

            if (data.startsWith(erc20Interface.getSighash('decimals'))) {
              return route.fulfill(
                jsonResponse({
                  jsonrpc: '2.0',
                  id: payload.id || 1,
                  result: erc20Interface.encodeFunctionResult('decimals', [18])
                })
              );
            }

            if (data.startsWith(erc20Interface.getSighash('totalSupply'))) {
              return route.fulfill(
                jsonResponse({
                  jsonrpc: '2.0',
                  id: payload.id || 1,
                  result: erc20Interface.encodeFunctionResult('totalSupply', [
                    ethers.utils.parseUnits('1000000', 18)
                  ])
                })
              );
            }
          }
        }

        if (payload.method === 'eth_getLogs') {
          const filter = payload.params?.[0] || {};
          const filterAddress = String(filter.address || '').toLowerCase();
          const filterTopics = Array.isArray(filter.topics) ? filter.topics : [];
          const matchesKnownToken = filterAddress === knownToken.address.toLowerCase();
          const wantsIncoming = filterTopics[2] === paddedEvmAddress;
          const wantsOutgoing = filterTopics[1] === paddedEvmAddress;
          const wantsRecentContractEvents =
            !filterTopics.length || (filterTopics[0] === transferTopic && !filterTopics[1] && !filterTopics[2]);

          if (matchesKnownToken && (wantsIncoming || wantsOutgoing || wantsRecentContractEvents)) {
            return route.fulfill(
              jsonResponse({
                jsonrpc: '2.0',
                id: payload.id || 1,
                result: [
                  {
                    address: knownToken.address,
                    blockHash: `0x${'cd'.repeat(32)}`,
                    blockNumber: `0x${latestHeight.toString(16)}`,
                    data: ethers.utils.hexZeroPad(knownTokenTransferValue.toHexString(), 32),
                    logIndex: '0x0',
                    removed: false,
                    topics: [transferTopic, paddedSecondaryEvmAddress, paddedEvmAddress],
                    transactionHash: evmTxHash,
                    transactionIndex: '0x0'
                  }
                ]
              })
            );
          }
        }

        return route.fulfill(
          jsonResponse({
            jsonrpc: '2.0',
            id: payload.id || 1,
            result: payload.method === 'eth_call' ? '0x' : []
          })
        );
      }

      if (payload?.method === 'trace_filter') {
        const filter = payload.params?.[0] || {};
        const fromAddresses = Array.isArray(filter.fromAddress)
          ? filter.fromAddress.map((entry) => String(entry).toLowerCase())
          : [];
        const toAddresses = Array.isArray(filter.toAddress)
          ? filter.toAddress.map((entry) => String(entry).toLowerCase())
          : [];
        const traceRecord = {
          action: {
            callType: 'call',
            from: secondaryEvmAddress,
            to: evmAddress,
            value: ethers.utils.parseUnits('1', 18).toHexString()
          },
          blockNumber: `0x${latestHeight.toString(16)}`,
          result: {
            gasUsed: '0x5208',
            output: '0x'
          },
          subtraces: 0,
          traceAddress: [0],
          transactionHash: evmTxHash,
          transactionPosition: 0,
          type: 'call'
        };
        const matchesFrom = !fromAddresses.length || fromAddresses.includes(secondaryEvmAddress.toLowerCase());
        const matchesTo = !toAddresses.length || toAddresses.includes(evmAddress.toLowerCase());

        return route.fulfill(
          jsonResponse({
            jsonrpc: '2.0',
            id: payload.id || 1,
            result: matchesFrom && matchesTo ? [traceRecord] : []
          })
        );
      }
    }

    if (url.pathname === '/blockchain') {
      const minHeight = Number(url.searchParams.get('minHeight') || latestHeight - 19);
      const maxHeight = Number(url.searchParams.get('maxHeight') || latestHeight);
      const blockMetas = [];

      for (let height = minHeight; height <= maxHeight; height += 1) {
        const txCount = height === latestHeight ? 2 : 1;
        blockMetas.push(buildBlockMeta(height, txCount));
      }

      return route.fulfill(
        jsonResponse({
          result: {
            block_metas: blockMetas
          }
        })
      );
    }

    if (url.pathname === '/block') {
      const height = Number(url.searchParams.get('height') || latestHeight);
      const txs = height === latestHeight ? [txPayloadBase64, secondaryTxPayloadBase64] : [txPayloadBase64];
      const block = buildRestBlock(height, txs);

      return route.fulfill(
        jsonResponse({
          result: {
            block_id: {
              hash: `BLOCKHASH${height}`
            },
            block
          }
        })
      );
    }

    if (url.pathname === '/block_results') {
      const height = Number(url.searchParams.get('height') || latestHeight);
      const txCount = height === latestHeight ? 2 : 1;

      return route.fulfill(
        jsonResponse({
          result: {
            txs_results: Array.from({ length: txCount }).map(() => ({
              gas_used: '21000',
              gas_wanted: '30000'
            }))
          }
        })
      );
    }

    if (url.pathname === '/status') {
      return route.fulfill(
        jsonResponse({
          result: {
            sync_info: {
              latest_block_height: String(latestHeight)
            }
          }
        })
      );
    }

    return route.fulfill(jsonResponse({}));
  });

  await page.route('https://api.coingecko.com/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.includes('/simple/price')) {
      return route.fulfill(
        jsonResponse({
          lithosphere: {
            usd: 0.25
          }
        })
      );
    }

    return route.fulfill(jsonResponse({}));
  });

  await page.route('https://bridge.litho.ai/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === '/health') {
      return route.fulfill(
        jsonResponse({
          status: 'ok',
          db: 'ok',
          deployment: {
            chainId: 900523,
            bridgeAddress: '0x95B646bF6629A379AD898DC58D011fd3111e5700',
            bridgeContractDeployed: false,
            kametTokenAddress: '0x4D1fc3b424CF86aeF2B2fa503acf97eB1bFb88a2',
            kametTokenContractDeployed: false,
            faucetSignerConfigured: false,
            ready: false,
            error: ''
          }
        })
      );
    }

    if (url.pathname === '/chains') {
      return route.fulfill(
        jsonResponse({
          chains: [
            {
              chainId: 900523,
              name: 'Lithosphere Kamet',
              symbol: 'LITHO',
              bridge: '0x95B646bF6629A379AD898DC58D011fd3111e5700',
              token: contractAddress
            }
          ]
        })
      );
    }

    if (url.pathname.includes('/bridge/transactions/')) {
      return route.fulfill(
        jsonResponse({
          transactions: [
            {
              txHash: `0x${txHash.toLowerCase()}`,
              timestamp: '2026-04-17T10:03:34.041Z',
              amount: '1.000000',
              status: 'completed',
              explorerUrl: `https://kamet.litho.ai/#/tx/0x${txHash.toLowerCase()}`
            },
            {
              txHash: `0x${secondaryTxHash.toLowerCase()}`,
              timestamp: '2026-04-17T10:03:30.041Z',
              amount: '2.000000',
              status: 'locked',
              explorerUrl: `https://kamet.litho.ai/#/tx/0x${secondaryTxHash.toLowerCase()}`
            }
          ]
        })
      );
    }

    return route.fulfill(jsonResponse({}));
  });
}
