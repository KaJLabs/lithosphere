import { expect, test } from '@playwright/test';

const LIVE_WALLET_ACCOUNT = '0xE9267bDf7084815B0754545049AE45FE744Aefa8';
const INITIAL_CHAIN_HEX = '0xaa36a7';
const KAMET_CHAIN_HEX = '0xdbdab';
const KNOWN_LIVE_EVM_TX_HASHES = [
  '0x3cf7363d76d556f71312d2371b85afc9c49f1bc6968e7a4e30bbfcba0d3c1fe5',
  '0x8a7c355e0c3a7dc6d71fe27a6db78a209559ed10e9afbb1f7052ae158969e7ca',
  '0xc479d6aea1406a612a66f5795c672f177bd70bce105e1026f7a488ac0facaa7d'
];

const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const installInjectedWallet = async (page) => {
  await page.addInitScript(
    ({ account, initialChainHex, kametChainHex }) => {
      const listeners = new Map();
      const requests = [];
      const PERMISSION_KEY = '__kametPlaywrightWalletPermission';
      const CHAIN_KEY = '__kametPlaywrightWalletChain';
      const KNOWN_CHAINS_KEY = '__kametPlaywrightWalletKnownChains';
      const safeGet = (key) => {
        try {
          return window.localStorage.getItem(key);
        } catch {
          return null;
        }
      };
      const safeSet = (key, value) => {
        try {
          window.localStorage.setItem(key, value);
        } catch {
          // ignore
        }
      };
      const getPermission = () => safeGet(PERMISSION_KEY) === '1';
      const setPermission = (granted) => safeSet(PERMISSION_KEY, granted ? '1' : '0');
      const persistedChain = safeGet(CHAIN_KEY);
      const persistedKnownChainsRaw = safeGet(KNOWN_CHAINS_KEY);
      const persistedKnownChains = persistedKnownChainsRaw
        ? persistedKnownChainsRaw.split(',').filter(Boolean)
        : [];
      const knownChains = new Set([String(initialChainHex).toLowerCase(), ...persistedKnownChains]);
      const persistKnownChains = () => safeSet(KNOWN_CHAINS_KEY, Array.from(knownChains).join(','));
      const startChain = (persistedChain || String(initialChainHex)).toLowerCase();
      const updateChain = (nextChainHex) => {
        provider.chainId = nextChainHex;
        provider.networkVersion = String(parseInt(nextChainHex, 16));
        safeSet(CHAIN_KEY, nextChainHex);
        provider._emit('chainChanged', nextChainHex);
      };

      const provider = {
        isMetaMask: true,
        selectedAddress: getPermission() ? account : null,
        chainId: startChain,
        networkVersion: String(parseInt(startChain, 16)),
        _accounts: [account],
        _emit(event, payload) {
          const handlers = listeners.get(event) || [];
          handlers.forEach((handler) => {
            try {
              handler(payload);
            } catch {
              // Ignore listener failures inside the mock wallet.
            }
          });
        },
        on(event, handler) {
          const handlers = listeners.get(event) || [];
          handlers.push(handler);
          listeners.set(event, handlers);
        },
        removeListener(event, handler) {
          const handlers = listeners.get(event) || [];
          listeners.set(
            event,
            handlers.filter((candidate) => candidate !== handler)
          );
        },
        async request({ method, params }) {
          requests.push({ method, params });

          switch (method) {
            case 'eth_requestAccounts':
              setPermission(true);
              provider.selectedAddress = provider._accounts[0];
              provider._emit('accountsChanged', provider._accounts);
              return provider._accounts;
            case 'eth_accounts':
              return getPermission() ? provider._accounts : [];
            case 'eth_chainId':
              return provider.chainId;
            case 'net_version':
              return provider.networkVersion;
            case 'wallet_switchEthereumChain': {
              const nextChainHex = String(params?.[0]?.chainId || '').toLowerCase();

              if (!knownChains.has(nextChainHex)) {
                const error = new Error(`Unknown chain ${nextChainHex}`);
                error.code = 4902;
                throw error;
              }

              updateChain(nextChainHex);
              return null;
            }
            case 'wallet_addEthereumChain': {
              const nextChainHex = String(params?.[0]?.chainId || kametChainHex).toLowerCase();
              knownChains.add(nextChainHex);
              persistKnownChains();
              updateChain(nextChainHex);
              return null;
            }
            case 'eth_blockNumber':
              return '0x10b42';
            case 'eth_getBalance':
              return '0xde0b6b3a7640000';
            case 'eth_estimateGas':
              return '0x5208';
            case 'eth_gasPrice':
              return '0x3b9aca00';
            default:
              return null;
          }
        }
      };

      window.__kametPlaywrightWallet = {
        requests,
        get chainId() {
          return provider.chainId;
        }
      };

      const announceProvider = () => {
        window.dispatchEvent(
          new CustomEvent('eip6963:announceProvider', {
            detail: {
              info: {
                uuid: '5f2c1db9-3da8-4d0b-9a5d-kamet-playwright-wallet',
                name: 'Playwright Wallet',
                icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTIiIGZpbGw9IiMwYjg1ZmYiLz48dGV4dCB4PSIzMiIgeT0iMzgiIGZvbnQtc2l6ZT0iMjQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IndoaXRlIj5QVzwvdGV4dD48L3N2Zz4=',
                rdns: 'ai.openai.playwright'
              },
              provider
            }
          })
        );
      };

      Object.defineProperty(window, 'ethereum', {
        configurable: true,
        value: provider
      });

      window.addEventListener('eip6963:requestProvider', announceProvider);
      announceProvider();
    },
    {
      account: LIVE_WALLET_ACCOUNT,
      initialChainHex: INITIAL_CHAIN_HEX,
      kametChainHex: KAMET_CHAIN_HEX
    }
  );
};

const fetchKametChainConfig = async (request) => {
  const bridgeChainsResponse = await request.get('https://bridge.litho.ai/chains');
  expect(bridgeChainsResponse.ok()).toBeTruthy();

  const bridgeChainsBody = await bridgeChainsResponse.json();
  const kametChain = bridgeChainsBody.chains.find((chain) => chain.chainId === 900523);

  expect(kametChain).toBeTruthy();
  return kametChain;
};

const postKametRpc = async (request, method, params, id = 1) => {
  const response = await request.post('https://rpc-3.litho.ai', {
    data: {
      jsonrpc: '2.0',
      method,
      params,
      id
    }
  });

  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.error).toBeFalsy();
  return body.result;
};

const resolveLiveEvmTransactionHash = async (request, lookback = 200) => {
  for (const txHash of KNOWN_LIVE_EVM_TX_HASHES) {
    const transaction = await postKametRpc(request, 'eth_getTransactionByHash', [txHash], 80);

    if (transaction?.hash) {
      return transaction.hash;
    }
  }

  const latestBlockHex = await postKametRpc(request, 'eth_blockNumber', [], 90);

  for (let offset = 0; offset < lookback; offset += 1) {
    const blockNumber = parseInt(latestBlockHex, 16) - offset;

    if (blockNumber < 0) {
      break;
    }

    const block = await postKametRpc(
      request,
      'eth_getBlockByNumber',
      [`0x${blockNumber.toString(16)}`, true],
      91 + offset
    );

    const transaction = Array.isArray(block?.transactions)
      ? block.transactions.find(
          (candidate) =>
            (typeof candidate === 'string' && candidate.startsWith('0x')) ||
            (typeof candidate?.hash === 'string' && candidate.hash.startsWith('0x'))
        )
      : null;

    if (typeof transaction === 'string') {
      return transaction;
    }

    if (transaction?.hash) {
      return transaction.hash;
    }
  }

  throw new Error(`Unable to find a recent Kamet EVM transaction within the last ${lookback} blocks.`);
};

test('validates live Kamet endpoints and primary explorer routes', async ({ page, request, baseURL }) => {
  const explorerResponse = await request.get(baseURL);
  expect(explorerResponse.ok()).toBeTruthy();
  expect(explorerResponse.headers()['strict-transport-security']).toBeTruthy();

  const rpcResponse = await request.get('https://rpc-3.litho.ai/status');
  expect(rpcResponse.ok()).toBeTruthy();
  const rpcBody = await rpcResponse.json();
  const latestHeight = Number(rpcBody.result.sync_info.latest_block_height);
  expect(latestHeight).toBeGreaterThan(0);

  const latestBlockResponse = await request.get('https://api-3.litho.ai/cosmos/base/tendermint/v1beta1/blocks/latest');
  expect(latestBlockResponse.ok()).toBeTruthy();
  const latestBlockBody = await latestBlockResponse.json();
  expect(latestBlockBody.block.header.chain_id).toBe('lithosphere_900523-2');

  const validatorsResponse = await request.get(
    'https://api-3.litho.ai/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED'
  );
  expect(validatorsResponse.ok()).toBeTruthy();
  const validatorsBody = await validatorsResponse.json();
  expect(validatorsBody.validators.length).toBeGreaterThan(0);
  const liveValidator = validatorsBody.validators[0].operator_address;

  const bridgeChainsResponse = await request.get('https://bridge.litho.ai/chains');
  expect(bridgeChainsResponse.ok()).toBeTruthy();
  const bridgeChainsBody = await bridgeChainsResponse.json();
  expect(bridgeChainsBody.chains.some((chain) => chain.chainId === 900523)).toBeTruthy();

  await page.goto('/');
  await expect(page).toHaveTitle(/Lithosphere|Kamet/i);
  await expect(page.getByRole('textbox', { name: /global explorer search/i }).first()).toBeVisible({
    timeout: 15000
  });
  await expect(page.locator('.statusLink').first()).toBeVisible();

  await page.goto('/blocks');
  await expect(page.locator('body')).toContainText(/Blocks|Kamet|Lithosphere/i);

  await page.goto(`/block/${latestHeight}`);
  await expect(page.locator('body')).toContainText(/Block/i);

  await page.goto(`/validator/${liveValidator}`);
  await expect(page.locator('body')).toContainText(/Validator|Voting Power|Commission/i);

  await page.goto('/faucet');
  await expect(page.locator('body')).toContainText(/Faucet|Kamet|Lithosphere/i);
});

test('verifies the live faucet claim route is mounted', async ({ request }) => {
  const faucetProbe = await request.post('https://api-3.litho.ai/faucet/claim', {
    data: {
      address: 'not-an-address',
      amount: '1',
      addressType: 'EVM'
    }
  });

  expect(faucetProbe.status(), 'Faucet claim endpoint should be mounted on the live API').not.toBe(404);
  expect([400, 429, 503]).toContain(faucetProbe.status());
});

test('verifies the live Kamet MultX bridge contract is deployed', async ({ request }) => {
  const kametChain = await fetchKametChainConfig(request);
  expect(kametChain.bridge).toMatch(/^0x[a-fA-F0-9]{40}$/);

  const bridgeCodeResponse = await request.post('https://rpc-3.litho.ai', {
    data: {
      jsonrpc: '2.0',
      method: 'eth_getCode',
      params: [kametChain.bridge, 'latest'],
      id: 1
    }
  });

  expect(bridgeCodeResponse.ok()).toBeTruthy();
  const bridgeCodeBody = await bridgeCodeResponse.json();
  expect(bridgeCodeBody.result, 'Kamet bridge address should have deployed bytecode').not.toBe('0x');
});

test('renders live EVM transaction detail pages for recent Kamet transfers', async ({ page, request }) => {
  const txHash = await resolveLiveEvmTransactionHash(request);

  await page.goto(`/tx/${txHash}`);

  await expect(page.locator('.explorerEyebrow').filter({ hasText: 'Transaction Detail' }).first()).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: /EVM Transaction|Transaction/ })).toBeVisible();
  await expect(page.locator('.explorerMessage.error')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Transaction not found.');
});

test('verifies the configured Kamet LITHO token contract is deployed', async ({ request }) => {
  const kametChain = await fetchKametChainConfig(request);
  const bridgeHealthResponse = await request.get('https://bridge.litho.ai/health');
  const bridgeHealthBody = bridgeHealthResponse.ok() ? await bridgeHealthResponse.json() : {};
  const tokenAddress = kametChain.token || bridgeHealthBody?.deployment?.kametTokenAddress || '';

  expect(
    tokenAddress,
    'Kamet token address should be exposed by bridge.litho.ai/chains or bridge.litho.ai/health'
  ).toMatch(/^0x[a-fA-F0-9]{40}$/);

  const tokenCodeResponse = await request.post('https://rpc-3.litho.ai', {
    data: {
      jsonrpc: '2.0',
      method: 'eth_getCode',
      params: [tokenAddress, 'latest'],
      id: 2
    }
  });

  expect(tokenCodeResponse.ok()).toBeTruthy();
  const tokenCodeBody = await tokenCodeResponse.json();
  expect(tokenCodeBody.result, 'Configured LITHO token address should have deployed bytecode').not.toBe('0x');
});

test('verifies live wallet connect, Kamet network add, and swap readiness in browser', async ({ page }) => {
  await installInjectedWallet(page);

  await page.goto('/faucet');

  await expect(page.locator('button.faucetPrimaryAction')).toBeVisible();
  await page.locator('button.faucetPrimaryAction').click();

  await expect(page.getByRole('button', { name: 'Disconnect Wallet' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Autofill' })).toBeVisible();
  await expect(page.locator('.faucetConnectedCard')).toContainText('0xE9267bDf...efa8');

  const networkPrompt = page.getByRole('alertdialog').getByRole('button', { name: 'Lithosphere Kamet' });

  if (await networkPrompt.isVisible().catch(() => false)) {
    await networkPrompt.click();
  } else {
    await page.getByRole('button', { name: 'Add Kamet Network' }).click();
  }

  await page.waitForFunction((expectedChainHex) => {
    return window.ethereum?.chainId?.toLowerCase() === expectedChainHex;
  }, KAMET_CHAIN_HEX);

  const walletMethods = await page.evaluate(() =>
    window.__kametPlaywrightWallet.requests.map((entry) => entry.method)
  );

  expect(walletMethods).toContain('wallet_switchEthereumChain');
  expect(walletMethods).toContain('wallet_addEthereumChain');

  await page.goto('/swap');

  await expect(page.getByText('MultX Bridge')).toBeVisible();
  await expect(page.locator('.network-name').first()).toHaveText('Lithosphere Kamet');
  await expect(page.locator('button.disconnect-btn')).toBeVisible();
  await expect(page.locator('.swap-card-title-transactions')).toHaveText(/\d+\s+transactions/);
  await expect(page.locator('.swap-card.transactions')).not.toContainText(
    'Connect your wallet to view transaction history'
  );
  await expect(page.locator('.swap-card.transactions')).not.toContainText(
    'Bridge history is temporarily unavailable while the bridge API health checks fail.'
  );
  await expect(page.locator('.swap-card .swap-button.primary-btn').first()).toHaveText('Approve Token');
});

test('verifies live canonical search and network routes', async ({ page, request }) => {
  const latestBlockHex = await postKametRpc(request, 'eth_blockNumber', [], 120);
  const latestHeight = parseInt(latestBlockHex, 16);
  const txHash = await resolveLiveEvmTransactionHash(request, 80);

  await page.goto('/');
  const searchForm = page.locator('form.globalSearchForm').first();
  const searchInput = searchForm.getByRole('textbox', { name: /global explorer search/i });
  await expect(searchInput).toBeVisible({ timeout: 15000 });

  await searchInput.fill(String(latestHeight));
  await searchForm.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(`/block/${latestHeight}$`));

  await page.goto('/');
  const txSearchForm = page.locator('form.globalSearchForm').first();
  const txSearchInput = txSearchForm.getByRole('textbox', { name: /global explorer search/i });
  await txSearchInput.fill(txHash);
  await txSearchForm.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(`/tx/${escapeRegExp(txHash)}$`));

  await page.goto('/network');
  await expect(page.locator('body')).toContainText(/Kamet Network Status|Service Health|Public Endpoints/i);
});

test('verifies live narrow-screen explorer routes remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const route of ['/', '/blocks', '/network']) {
    await page.goto(route);
    await expect(page.getByRole('textbox', { name: /global explorer search/i }).first()).toBeVisible({
      timeout: 15000
    });

    const metrics = await page.evaluate(() => {
      const previousScrollX = window.scrollX;
      window.scrollTo({ left: 9999, top: window.scrollY, behavior: 'instant' });
      const horizontalScrollPosition = window.scrollX;
      window.scrollTo({ left: previousScrollX, top: window.scrollY, behavior: 'instant' });

      return {
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        horizontalScrollPosition
      };
    });

    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 2);
    expect(metrics.horizontalScrollPosition).toBeLessThanOrEqual(1);
  }
});
