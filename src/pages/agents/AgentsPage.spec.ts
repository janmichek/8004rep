import { expect, test } from '@playwright/test';

const networks = [
  {
    code: 'BASE',
    name: 'Base',
    shortName: 'Base',
    slug: 'base',
    symbol: 'B',
    color: 'blue',
    chainId: 8453,
    testnet: false,
    lastIndexedBlock: 10_000,
    syncStatus: 'ok',
    syncedAt: 1_764_000_000,
  },
];

const listPage = {
  items: [
    {
      chainId: 8453,
      tokenId: '1',
      name: 'Atlas Broker',
      owner: '0x1111111111111111111111111111111111111111',
      protocols: ['MCP'],
      x402: false,
      score: 91.2,
      ciLow: 82.4,
      ciHigh: 95.1,
      confidence: 'high',
      unrated: false,
      rawAverage: 93,
      ratedRows: 12,
      uniqueWallets: 6,
      feedbackCount: 18,
      formulaVersion: 'rep-1.0',
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
      score: null,
      ciLow: null,
      ciHigh: null,
      confidence: 'low',
      unrated: true,
      rawAverage: null,
      ratedRows: 0,
      uniqueWallets: 0,
      feedbackCount: 0,
      formulaVersion: 'rep-1.0',
      createdAt: 1_736_241_240,
      testnet: false,
    },
  ],
  total: 2,
  hasMore: false,
};

const detail = {
  chainId: 8453,
  tokenId: '1',
  name: 'Atlas Broker',
  description: null,
  imageUrl: null,
  owner: null,
  agentWallet: null,
  agentUri: null,
  active: null,
  x402: false,
  protocols: [],
  supportedTrust: [],
  services: [],
  version: null,
  registeredAt: 1_736_154_840,
  feedbackCount: 0,
  testnet: false,
  tagScales: {},
  feedback: [],
};

test('sorts the table by score and feedback through the URL', async ({ page }) => {
  const requested: URL[] = [];

  await page.route(/\/api\/networks$/, (route) => route.fulfill({ json: networks }));
  await page.route(/\/api\/agents(\?|$)/, (route) => {
    requested.push(new URL(route.request().url()));

    return route.fulfill({ json: listPage });
  });
  await page.goto('/agents/all');

  await expect(page.locator('.agents-table tbody tr.row-link')).toHaveCount(2);
  await expect(page.locator('.agents-table')).toContainText('Unrated');
  await expect(page.locator('.agents-table')).toContainText('91.2');

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
  await page.route(/\/api\/networks$/, (route) => route.fulfill({ json: networks }));
  await page.route(/\/api\/agents\/\d+\/\d+$/, (route) => route.fulfill({ json: detail }));
  await page.route(/\/api\/agents(\?|$)/, (route) => route.fulfill({ json: listPage }));
  await page.route('https://8004scan.io/**', (route) => route.fulfill({ status: 404 }));

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
