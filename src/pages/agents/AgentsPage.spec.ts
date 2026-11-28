import { expect, test } from '@playwright/test';

const listPage = {
  items: [
    {
      chainId: 8453,
      tokenId: '1',
      name: 'Atlas Broker',
      owner: '0x1111111111111111111111111111111111111111',
      protocols: ['MCP'],
      x402: false,
      totalScore: 91.2,
      averageScore: 93,
      feedbackCount: 18,
      createdAt: 1_736_154_840,
      testnet: false,
    },
    {
      chainId: 8453,
      tokenId: '2',
      name: 'Nova Scout',
      owner: '0x2222222222222222222222222222222222222222',
      protocols: ['A2A'],
      x402: true,
      totalScore: 72.4,
      averageScore: 80,
      feedbackCount: 9,
      createdAt: 1_736_241_240,
      testnet: false,
    },
  ],
  total: 2,
  hasMore: false,
};

test('sorts the table by score and feedback through the URL', async ({ page }) => {
  const requested: URL[] = [];

  await page.route(/\/api\/agents(\?|$)/, (route) => {
    requested.push(new URL(route.request().url()));

    return route.fulfill({ json: listPage });
  });
  await page.goto('/agents/all');

  await expect(page.locator('.agents-table tbody tr.row-link')).toHaveCount(2);

  await page.getByRole('button', { name: /Score/ }).click();
  await expect(page).toHaveURL(/sort=score/);
  await expect(page.locator('th[aria-sort="descending"]')).toContainText('Score');
  await expect
    .poll(() =>
      requested.some(
        (url) =>
          url.searchParams.get('sort') === 'score' && url.searchParams.get('order') === 'desc'
      )
    )
    .toBe(true);

  await page.getByRole('button', { name: /Feedback/ }).click();
  await expect(page).toHaveURL(/sort=feedback/);
  await expect(page.locator('th[aria-sort="descending"]')).toContainText('Feedback');
  await expect
    .poll(() =>
      requested.some(
        (url) =>
          url.searchParams.get('sort') === 'feedback' && url.searchParams.get('order') === 'desc'
      )
    )
    .toBe(true);
});

test('opens and closes agent details through the URL', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/agents\/all/);

  await page.goto('/agents/all?chain=8453');
  const agentRow = page.locator('.agents-table tbody tr.row-link').first();
  await expect(agentRow).toBeVisible({ timeout: 20_000 });
  await agentRow.click();

  await expect(page).toHaveURL(/\/agents\/base\/\d+$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Identity' })).toBeVisible();
  await page.getByRole('tab', { name: 'Identity' }).click();
  await expect(page.getByRole('heading', { name: 'Identity' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Registration' })).toBeVisible();

  await page.getByRole('link', { name: 'Agents', exact: true }).click();
  await expect(page).toHaveURL(/\/agents\/base$/);
  await expect(page.locator('.agents-table tbody tr.row-link').first()).toBeVisible({
    timeout: 20_000,
  });
});
