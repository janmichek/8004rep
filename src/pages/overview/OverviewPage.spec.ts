import { expect, test } from '@playwright/test';

test('overview shows the roster summary and the newest agents', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.getByText('Unreviewed: 2')).toBeVisible();
  await expect(page.getByText(/Avg score:/)).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Network' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show detail 12', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show detail 1', exact: true })).toHaveCount(0);
});
