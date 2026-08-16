import AxeBuilder from '@axe-core/playwright';
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
const seriousImpacts = new Set(['critical', 'serious']);

const formatViolations = (violations) =>
  violations
    .map((violation) => {
      const affectedNodes = violation.nodes
        .map((node) => `    - ${node.target.join(', ') || '<unknown target>'}`)
        .join('\n');

      return `${violation.id} (${violation.impact || 'unknown'})\n  ${violation.help}\n${affectedNodes}`;
    })
    .join('\n\n');

const expectNoSeriousViolations = async (page) => {
  const results = await new AxeBuilder({ page }).include('main').analyze();
  const seriousViolations = results.violations.filter((violation) =>
    seriousImpacts.has(violation.impact)
  );

  expect(
    seriousViolations,
    `Serious accessibility violations detected:\n${formatViolations(seriousViolations)}`
  ).toEqual([]);
};

test.beforeEach(async ({ page }) => {
  await installKametApiMocks(page);
});

test('passes serious-accessibility checks on all canonical explorer routes', async ({ page }, testInfo) => {
  test.slow();

  test.skip(
    testInfo.project.name === 'mobile-chromium',
    'Desktop and tablet axe smoke are sufficient here; narrow-screen layout is covered by the main mocked browser suite.'
  );

  const routes = [
    {
      path: '/',
      ready: page.getByRole('heading', { level: 1, name: 'Kamet Explorer' })
    },
    {
      path: '/blocks',
      ready: page.getByRole('heading', { level: 1, name: 'Blocks' })
    },
    {
      path: `/block/${latestHeight}`,
      ready: page.getByRole('heading', { level: 1, name: `Block #${latestHeight.toLocaleString('en-US')}` })
    },
    {
      path: '/transactions',
      ready: page.getByRole('heading', { level: 1, name: 'Transactions' })
    },
    {
      path: `/tx/${evmTxHash}`,
      ready: page.getByRole('heading', { level: 1, name: 'EVM Transaction' })
    },
    {
      path: '/addresses',
      ready: page.getByRole('heading', { level: 1, name: 'Addresses' })
    },
    {
      path: `/address/${evmAddress}`,
      ready: page.getByRole('heading', { level: 1, name: evmAddress })
    },
    {
      path: '/tokens',
      ready: page.getByRole('heading', { level: 1, name: 'Tokens' })
    },
    {
      path: `/token/${knownToken.address}`,
      ready: page.getByRole('heading', { level: 1, name: knownToken.symbol })
    },
    {
      path: '/validators',
      ready: page.getByRole('heading', { level: 1, name: 'Validators' })
    },
    {
      path: `/validator/${validatorAddress}`,
      ready: page.getByRole('heading', { level: 1, name: /kamet-validator/i })
    },
    {
      path: '/contracts',
      ready: page.getByRole('heading', { level: 1, name: 'Contracts' })
    },
    {
      path: `/contract/${contractAddress}`,
      ready: page.locator('.explorerSectionTitle').filter({ hasText: 'Write Functions' }).first()
    },
    {
      path: '/search?q=definitely-not-a-real-object',
      ready: page.getByRole('heading', { level: 1, name: /Search:/ })
    },
    {
      path: '/network',
      ready: page.getByRole('heading', { level: 1, name: 'Kamet Network Status' })
    }
  ];

  for (const route of routes) {
    await page.goto(route.path);
    await expect(route.ready).toBeVisible({ timeout: 10000 });
    await expectNoSeriousViolations(page);
  }
});
