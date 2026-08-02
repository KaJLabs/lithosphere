import { expect, test } from '@playwright/test';
import { KAMET_KNOWN_TOKENS } from '../../src/data/kametRegistry.js';
import { evmAddress, installKametApiMocks } from './support/mockNetwork.js';

const knownToken = KAMET_KNOWN_TOKENS[0];

const getViewportMetrics = async (page) =>
  page.evaluate(() => {
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

const expectNoHorizontalOverflow = async (page, routePath) => {
  const metrics = await getViewportMetrics(page);
  const allowedWidth = metrics.viewportWidth + 2;

  expect(
    metrics.documentWidth,
    `Horizontal overflow detected on ${routePath}: document width ${metrics.documentWidth}px exceeded viewport ${metrics.viewportWidth}px`
  ).toBeLessThanOrEqual(allowedWidth);
  expect(
    metrics.horizontalScrollPosition,
    `Horizontal page scrolling is possible on ${routePath}: scrollX reached ${metrics.horizontalScrollPosition}px`
  ).toBeLessThanOrEqual(1);
};

const expectStickyHeader = async (page, routePath) => {
  const header = page.locator('.explorerHeader');
  await expect(header, `Expected sticky explorer header on ${routePath}`).toBeVisible();

  await page.evaluate(() => {
    window.scrollTo({
      top: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) / 2,
      behavior: 'instant'
    });
  });
  await page.waitForTimeout(100);

  const box = await header.boundingBox();

  expect(box, `Missing header box on ${routePath}`).not.toBeNull();
  expect(
    box?.y ?? Number.POSITIVE_INFINITY,
    `Sticky explorer header drifted off-screen on ${routePath}`
  ).toBeLessThanOrEqual(2);
};

test.beforeEach(async ({ page }) => {
  await installKametApiMocks(page);
});

test('keeps representative explorer routes usable on tablet and narrow screens', async ({
  page
}, testInfo) => {
  test.slow();

  test.skip(
    testInfo.project.name === 'chromium',
    'Desktop layout is already covered by the main mocked suite; this regression locks tablet and narrow-screen behavior.'
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
      path: `/address/${evmAddress}`,
      ready: page.getByRole('heading', { level: 1, name: evmAddress })
    },
    {
      path: `/token/${knownToken.address}`,
      ready: page.getByRole('heading', { level: 1, name: knownToken.symbol })
    },
    {
      path: '/network',
      ready: page.getByRole('heading', { level: 1, name: 'Kamet Network Status' })
    }
  ];

  for (const route of routes) {
    await page.goto(route.path);
    await expect(route.ready).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole('textbox', { name: 'Global explorer search' }).first(),
      `Expected shared header search on ${route.path}`
    ).toBeVisible();

    await expectStickyHeader(page, route.path);
    await expectNoHorizontalOverflow(page, route.path);
  }
});
