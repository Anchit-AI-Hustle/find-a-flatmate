import { expect, test } from '@playwright/test';

test('sample matching stays separate from live inventory', async ({ page, request }) => {
  await page.goto('/try?city=noida');
  await expect(page.getByRole('heading', { name: 'Try matching' })).toBeVisible();
  await expect(page.getByText('Sample profile', { exact: true })).toHaveCount(2);
  await expect(page.getByText('Sample room', { exact: true })).toHaveCount(2);
  await expect(page.getByRole('button', { name: /like|save|message/i })).toHaveCount(0);
  const demo = await request.get('/api/mobile/data?view=samples');
  expect((await demo.json()).rooms).toHaveLength(2);
  const live = await request.get('/api/mobile/data?view=rooms');
  expect(live.status()).toBe(401);
});

test('download page reports app availability', async ({ page }) => {
  await page.goto('/get');
  await expect(page.getByRole('heading', { name: 'Get Find a Flatmate' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Android' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'iPhone' })).toBeVisible();
});
