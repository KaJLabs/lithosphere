import { expect, test } from '@playwright/test';
import { KAMET_KNOWN_TOKENS } from '../../src/data/kametRegistry.js';
import {
  contractAddress,
  evmAddress,
  evmTxHash,
  installKametApiMocks,
  latestHeight,
  validatorAddress
} from './support/mockNetwork.js';

const knownToken = KAMET_KNOWN_TOKENS[0];
const ignoredConsoleErrorPatterns = [];
const allowedNotFoundResponsePatterns = [];

const attachClientErrorCapture = (page) => {
  const consoleErrors = [];
  const pageErrors = [];
  const notFoundResponses = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text();

      if (!ignoredConsoleErrorPatterns.some((pattern) => pattern.test(text))) {
        consoleErrors.push(text);
      }
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  page.on('response', (response) => {
    if (response.status() === 404) {
      notFoundResponses.push(response.url());
    }
  });

  return async () => {
    expect(pageErrors, `Unexpected page errors:\n${pageErrors.join('\n')}`).toEqual([]);
    expect(
      notFoundResponses.filter(
        (url) => !allowedNotFoundResponsePatterns.some((pattern) => pattern.test(url))
      ),
      `Unexpected 404 responses:\n${notFoundResponses.join('\n')}`
    ).toEqual([]);
    expect(consoleErrors, `Unexpected console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  };
};

const runHeaderSearch = async (page, query) => {
  const headerSearch = page.locator('.headerSearch').first();
  await expect(headerSearch.getByRole('textbox', { name: 'Global explorer search' })).toBeVisible();
  await headerSearch.getByRole('textbox', { name: 'Global explorer search' }).fill(query);
  await headerSearch.getByRole('button', { name: 'Search' }).click();
};

test.beforeEach(async ({ page }) => {
  await installKametApiMocks(page);
});

test('renders the homepage and canonical block and transaction deep links', async ({ page }) => {
  const assertNoClientErrors = attachClientErrorCapture(page);

  await page.goto('/');

  const main = page.getByRole('main');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(main).toBeFocused();

  await expect(page.getByRole('heading', { level: 1, name: 'Kamet Explorer' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Global explorer search' }).first()).toBeVisible();
  await expect(page.getByPlaceholder(/Search tx hash/i).first()).toBeVisible();
  await expect(page.locator('.statCard').filter({ hasText: 'TPS' }).first()).toBeVisible();
  await expect(page.locator('.explorerSectionTitle').filter({ hasText: 'Latest Blocks' }).first()).toBeVisible();
  await expect(page.locator('.explorerSectionTitle').filter({ hasText: 'Latest Transactions' }).first()).toBeVisible();
  await expect(page.locator('.statusLink .statusBadge')).toContainText(/Operational/i);
  await expect(page.locator('.headerWalletButton')).toHaveText(/Connect Wallet/i);
  const footer = page.getByRole('contentinfo');
  await expect(footer.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', /https?:\/\//);
  await expect(footer.getByRole('link', { name: 'Status' })).toHaveAttribute('href', /https?:\/\//);
  await expect(footer.getByRole('link', { name: 'RPC' })).toHaveAttribute('href', /https?:\/\//);
  await expect(footer.getByRole('link', { name: 'Faucet' })).toHaveAttribute('href', /https?:\/\//);
  await expect(footer.getByRole('link', { name: 'Validator Portal' })).toHaveAttribute('href', /https?:\/\//);

  await page.goto('/blocks');
  await expect(page.getByRole('heading', { level: 1, name: 'Blocks' })).toBeVisible();
  await expect(page.locator('.tableWrap[data-virtualized="true"]').first()).toBeVisible();
  await page.locator('table.dataTable tbody tr').first().focus();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(new RegExp(`/block/${latestHeight}$`));
  await expect(page.getByRole('heading', { level: 1, name: `Block #${latestHeight.toLocaleString('en-US')}` })).toBeVisible();
  await expect(page.locator('.explorerSectionTitle').filter({ hasText: 'Included Transactions' }).first()).toBeVisible();

  await page.goto(`/tx/${evmTxHash}`);
  await expect(page.getByRole('heading', { level: 1, name: 'EVM Transaction' })).toBeVisible();
  await expect(page.getByText('Decoded Input / Raw Input')).toBeVisible();
  await expect(page.getByText('Logs / Events')).toBeVisible();

  await assertNoClientErrors();
});

test('renders address, token, validator, contract, search, and network routes', async ({ page }) => {
  test.slow();
  const assertNoClientErrors = attachClientErrorCapture(page);

  await page.goto(`/address/${evmAddress}`);
  await expect(page.getByRole('heading', { level: 1, name: evmAddress })).toBeVisible({
    timeout: 10000
  });
  await expect(page.getByRole('tablist', { name: 'Address activity tabs' })).toBeVisible({
    timeout: 10000
  });
  await expect(page.getByRole('tabpanel', { name: 'Transactions' })).toBeVisible();
  await expect(page.getByText('Indexed or trace-derived internal transactions')).toBeVisible();
  await expect(
    page.locator('.explorerSectionTitle').filter({ hasText: 'Internal Transactions' }).first()
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Token Transfers' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Token Transfers' })).toBeVisible();
  await expect(
    page.getByText(/Recent token transfer activity is derived from public LEP100 transfer logs/i)
  ).toBeVisible();
  await expect(page.getByRole('link', { name: knownToken.symbol })).toBeVisible();
  await page.getByRole('tab', { name: 'NFTs / LEP100 Assets' }).click();
  await expect(page.getByRole('tabpanel', { name: 'NFTs / LEP100 Assets' })).toBeVisible();
  await expect(
    page.getByText(/LEP100 asset coverage now combines current balances, observed transfer activity, and full on-chain ownership replay/i)
  ).toBeVisible();
  await expect(page.getByText('Observed Asset Activity')).toBeVisible();
  await expect(page.getByText(/25(\.0+)?/i).first()).toBeVisible();
  await expect(page.getByText(/1 transfer\(s\) observed/i)).toBeVisible();
  await expect(
    page.locator('.explorerSectionTitle').filter({ hasText: 'NFT Inventory' }).first()
  ).toBeVisible();
  await expect(page.getByText(/NFT inventory unavailable/i)).toBeVisible();
  await page.getByRole('tab', { name: 'Contract' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Contract' })).toBeVisible();
  await expect(page.getByText('No contract interactions')).toBeVisible();

  await page.goto('/tokens');
  await expect(page.getByRole('heading', { level: 1, name: 'Tokens' })).toBeVisible();
  await expect(page.getByRole('tablist', { name: 'Token filters' })).toBeVisible();
  await expect(page.getByRole('tabpanel', { name: 'All' })).toBeVisible();
  await expect(page.locator('tr').filter({ hasText: knownToken.symbol }).first()).toBeVisible();
  await page.getByRole('tab', { name: 'NFT' }).click();
  await expect(page.getByRole('tabpanel', { name: 'NFT' })).toBeVisible();
  await expect(
    page.getByText(/NFT browsing follows the combined Kamet token catalog/i)
  ).toBeVisible();

  await page.goto('/token/native');
  await expect(page.getByRole('heading', { level: 1, name: 'LITHO' })).toBeVisible({
    timeout: 10000
  });
  await expect(page.locator('.explorerSectionTitle').filter({ hasText: 'Recent Transfers' }).first()).toBeVisible();

  await page.goto(`/token/${knownToken.address}`);
  await expect(page.getByRole('heading', { level: 1, name: knownToken.symbol })).toBeVisible({
    timeout: 10000
  });
  await expect(page.locator('.explorerSectionTitle').filter({ hasText: 'Current Holders' }).first()).toBeVisible();
  await expect(
    page.getByText(/derived from full on-chain transfer history for the contract/i).first()
  ).toBeVisible();
  await expect(page.getByText('Creator')).toBeVisible();
  await expect(page.getByText(evmAddress).first()).toBeVisible();
  await expect(
    page.locator('.explorerSectionTitle').filter({ hasText: 'Observed Holders' }).first()
  ).toBeVisible();

  await page.goto(`/validator/${validatorAddress}`);
  await expect(page.getByRole('heading', { level: 1, name: /kamet-validator/i })).toBeVisible({
    timeout: 10000
  });
  await expect(page.locator('.explorerSectionTitle').filter({ hasText: 'Validator Tooling' }).first()).toBeVisible();
  await expect(page.getByText('Governance API')).toBeVisible();
  await expect(page.getByText('Setup Guide')).toBeVisible();
  await expect(page.locator('.explorerSectionTitle').filter({ hasText: 'Recent Proposed Blocks' }).first()).toBeVisible();

  await page.goto(`/contract/${contractAddress}`);
  await expect(page.locator('.explorerSectionTitle').filter({ hasText: 'Write Functions' }).first()).toBeVisible();
  await expect(page.getByText('Write UI locked')).toBeVisible();

  await page.goto('/search?q=definitely-not-a-real-object');
  await expect(page.getByRole('heading', { level: 1, name: /Search:/ })).toBeVisible();
  await expect(page.locator('.emptyStateCard strong').filter({ hasText: 'No result found' }).first()).toBeVisible();

  await page.goto('/network');
  await expect(page.getByRole('heading', { level: 1, name: 'Kamet Network Status' })).toBeVisible();
  await expect(page.locator('.explorerSectionTitle').filter({ hasText: 'Network Resources' }).first()).toBeVisible();
  await expect(page.locator('.explorerSectionTitle').filter({ hasText: 'Service Health' }).first()).toBeVisible();
  await expect(page.getByText(/Incident detail is limited to the fields published by the public status monitor/i)).toBeVisible();
  await expect(page.locator('.explorerSectionTitle').filter({ hasText: 'Active Incidents' }).first()).toBeVisible();
  const componentCard = page.locator('.componentStatusCard').filter({ hasText: 'Explorer Search API' }).first();
  await expect(componentCard).toBeVisible();
  await expect(componentCard.getByText('Kind: api')).toBeVisible();
  await expect(componentCard.getByText('Source: status monitor')).toBeVisible();
  await expect(componentCard.getByText(/Search lookups are responding within the current SLO/i)).toBeVisible();
  await expect(componentCard.getByText('Latency: 28 ms')).toBeVisible();
  await expect(componentCard.getByText('Uptime: 99.97%')).toBeVisible();
  await expect(componentCard.getByRole('link', { name: 'Open public status detail' })).toHaveAttribute('href', /components\/search-api/);
  const activeIncidentCard = page.locator('.eventCard').filter({ hasText: 'Public RPC latency spike' }).first();
  await expect(activeIncidentCard).toBeVisible();
  await expect(activeIncidentCard.getByText(/Kamet public RPC latency is above the normal production threshold/i)).toBeVisible();
  await expect(activeIncidentCard.getByText(/Traffic is being shifted away from the degraded gateway/i)).toBeVisible();
  await expect(activeIncidentCard.getByText(/Users may see slower explorer and RPC responses/i)).toBeVisible();
  await expect(activeIncidentCard.getByText(/primary public RPC gateway crossed the latency SLO/i)).toBeVisible();
  await expect(activeIncidentCard.getByText('Component: rpc').first()).toBeVisible();
  await expect(activeIncidentCard.getByText('Source: status monitor').first()).toBeVisible();
  await expect(activeIncidentCard.getByText(/^public-rpc$/i)).toBeVisible();
  await expect(activeIncidentCard.getByText(/^latency$/i)).toBeVisible();
  await expect(activeIncidentCard.getByText('rpc.kamet.litho.ai').first()).toBeVisible();
  await expect(activeIncidentCard.getByText('rest.kamet.litho.ai')).toBeVisible();
  await expect(activeIncidentCard.getByRole('link', { name: 'Open public status detail' })).toHaveAttribute('href', /kamet-rpc-latency/);
  await expect(activeIncidentCard.getByText('Timeline Updates')).toBeVisible();
  await expect(activeIncidentCard.getByText('Traffic shift started')).toBeVisible();
  await expect(activeIncidentCard.getByRole('link', { name: 'Open update detail' })).toHaveAttribute(
    'href',
    /kamet-rpc-latency#update-1/
  );
  const recentEventCard = page.locator('.eventCard').filter({ hasText: 'Indexer sync recovered' }).first();
  await expect(recentEventCard).toBeVisible();
  await expect(recentEventCard.getByText(/explorer freshness returned to nominal levels/i)).toBeVisible();
  await expect(recentEventCard.getByText('Component: indexer')).toBeVisible();
  await expect(recentEventCard.getByText('search')).toBeVisible();
  await expect(page.locator('.explorerSectionTitle').filter({ hasText: 'Incident History' }).first()).toBeVisible();
  const historyIncidentCard = page.locator('.eventCard').filter({ hasText: 'REST gateway saturation' }).first();
  await expect(historyIncidentCard).toBeVisible();
  await expect(
    historyIncidentCard.getByText(/Traffic was redistributed to the secondary gateway/i).first()
  ).toBeVisible();
  await expect(historyIncidentCard.getByRole('link', { name: 'Open public status detail' })).toHaveAttribute('href', /kamet-rest-saturation/);
  await expect(historyIncidentCard.getByRole('link', { name: 'Open public postmortem' })).toHaveAttribute(
    'href',
    /postmortems\/kamet-rest-saturation/
  );
  await expect(page.locator('.explorerSectionTitle').filter({ hasText: 'Scheduled Maintenance' }).first()).toBeVisible();
  const maintenanceCard = page.locator('.eventCard').filter({ hasText: 'Search reindex window' }).first();
  await expect(maintenanceCard).toBeVisible();
  await expect(maintenanceCard.getByText(/Explorer search will run in a degraded mode during a short index rebuild window/i)).toBeVisible();
  await expect(maintenanceCard.getByText(/token-holder caches and search projections are rebuilt/i)).toBeVisible();
  await expect(maintenanceCard.getByText('Component: search').first()).toBeVisible();
  await expect(maintenanceCard.getByText('Source: status monitor').first()).toBeVisible();
  await expect(maintenanceCard.getByText('search').first()).toBeVisible();
  await expect(maintenanceCard.getByRole('link', { name: 'Open public status detail' })).toHaveAttribute(
    'href',
    /maintenances\/kamet-search-reindex/
  );
  await expect(maintenanceCard.getByText('Read-only mode prepared')).toBeVisible();
  await expect(page.locator('.explorerSectionTitle').filter({ hasText: 'Status Coverage' }).first()).toBeVisible();
  await expect(page.getByText('Published Availability').first()).toBeVisible();
  await expect(page.getByText('99.98%').first()).toBeVisible();
  await expect(page.locator('.explorerSectionTitle').filter({ hasText: 'Monitored Endpoints' }).first()).toBeVisible();

  await assertNoClientErrors();
});

test('routes known object searches directly from the shared header', async ({ page }) => {
  const assertNoClientErrors = attachClientErrorCapture(page);

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Kamet Explorer' })).toBeVisible({
    timeout: 10000
  });

  await runHeaderSearch(page, String(latestHeight));
  await expect(page).toHaveURL(new RegExp(`/block/${latestHeight}$`));
  await expect(page.getByRole('heading', { level: 1, name: `Block #${latestHeight.toLocaleString('en-US')}` })).toBeVisible();

  await runHeaderSearch(page, evmTxHash);
  await expect(page).toHaveURL(new RegExp(`/tx/${evmTxHash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'EVM Transaction' })).toBeVisible();

  await runHeaderSearch(page, evmAddress);
  await expect(page).toHaveURL(new RegExp(`/address/${evmAddress.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  await expect(page.getByRole('heading', { level: 1, name: evmAddress })).toBeVisible();

  await runHeaderSearch(page, validatorAddress);
  await expect(page).toHaveURL(new RegExp(`/validator/${validatorAddress}$`));
  await expect(page.getByRole('heading', { level: 1, name: /kamet-validator/i })).toBeVisible({
    timeout: 10000
  });

  await runHeaderSearch(page, knownToken.symbol);
  await expect(page).toHaveURL(new RegExp(`/token/${knownToken.address}$`, 'i'));
  await expect(page.getByRole('heading', { level: 1, name: knownToken.symbol })).toBeVisible();

  await assertNoClientErrors();
});

test('shows friendly invalid states for malformed deep links and unsupported search objects', async ({ page }) => {
  const assertNoClientErrors = attachClientErrorCapture(page);

  await page.goto('/tx/0x1234');
  await expect(page.getByText('Bad transaction hash')).toBeVisible({
    timeout: 10000
  });
  await expect(page.getByText('Use a full transaction hash in the URL.')).toBeVisible();

  await page.goto('/search?q=lithovalcons1s2rxzrs0hezxqqt22yavlr00py66elruuxje4v');
  await expect(page.getByText('Unsupported object type')).toBeVisible();
  await expect(page.locator('.emptyStateCard').getByText(/consensus addresses are not directly browsable/i).first()).toBeVisible();

  await assertNoClientErrors();
});
