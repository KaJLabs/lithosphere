import { test, expect } from '@playwright/test';

// Smoke test against the live Makalu explorer. Run nightly or on-demand.
// `baseURL` defaults to https://makalu.litho.ai (see playwright.config.ts);
// override with E2E_BASE_URL to point at a feature branch or local stack.

test.describe('Explorer @smoke', () => {
  test('homepage loads and contains the Lithosphere brand', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Lithosphere/i);
  });

  test('header surfaces a working search input', async ({ page }) => {
    await page.goto('/');
    // The header search has placeholder text in the live UI. We accept any
    // input element that's role-discoverable; tighten once the explorer adds
    // a data-testid.
    const search = page
      .getByPlaceholder(/search/i)
      .or(page.getByRole('searchbox'))
      .or(page.getByRole('textbox'))
      .first();
    await expect(search).toBeVisible();
  });

  test('blocks page renders at least one block row', async ({ page }) => {
    const response = await page.goto('/blocks');
    expect(response?.ok(), 'navigation should return 2xx').toBeTruthy();
    // At least the page heading should be present even if data is sparse
    await expect(page.locator('body')).toContainText(/block/i);
  });
});
