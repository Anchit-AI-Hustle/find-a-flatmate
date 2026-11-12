import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { watchConsole } from './helpers';

const pages = ['/', '/how-it-works', '/safety', '/pricing', '/about', '/help', '/privacy', '/terms', '/community-guidelines', '/city/gurugram', '/city/noida/sector-62', '/login', '/onboarding/intent', '/offline'];
const widths = [360, 390, 768, 1280, 1440];

test('public pages render at every width with no overflow, console errors or accessibility violations', async ({ browser }) => {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors = watchConsole(page);
    for (const path of pages) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} @${width}`).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `no horizontal scroll on ${path} @${width}`).toBe(true);
      expect(await page.locator('h1').evaluate(el => el.getBoundingClientRect().left), `side gutter on ${path} @${width}`).toBeGreaterThanOrEqual(12);
      if (width === 390 || width === 1440) {
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        expect(axe.violations.map(v => `${v.id}: ${v.nodes[0]?.target}`), `axe on ${path} @${width}`).toEqual([]);
      }
    }
    expect(errors, `console errors @${width}`).toEqual([]);
    await context.close();
  }
});

test('landing page states live inventory honestly and leads into onboarding', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Find someone you can actually live with');
  await expect(page.getByTestId('inventory')).toContainText(/no rooms are live yet|moderator-reviewed room/);
  await expect(page.getByText(/verified safe|100% verified/i)).toHaveCount(0);
  await page.getByRole('button', { name: /I have a room to fill/ }).click();
  await expect(page).toHaveURL(/\/login/);
});

test('unknown pages, cities and listings return a real 404', async ({ page }) => {
  for (const path of ['/nope', '/city/mumbai', '/city/gurugram/bandra', '/listing/not-a-uuid', '/listing/00000000-0000-4000-8000-000000000000']) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(page.getByRole('heading', { name: 'We can’t find that page' })).toBeVisible();
  }
});

test('signed-in areas, admin, media and export are closed to visitors', async ({ page, request }) => {
  for (const path of ['/app', '/app/discover', '/app/messages', '/app/listings/new', '/app/settings/data', '/admin', '/onboarding/basics']) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/login/);
  }
  expect((await request.get('/api/media/00000000-0000-4000-8000-000000000000')).status()).toBe(404);
  expect((await request.get('/app/settings/data/export', { maxRedirects: 0 })).status()).toBeGreaterThanOrEqual(300);
});

test('security headers and the installable app manifest are served', async ({ request }) => {
  const home = await request.get('/');
  expect(home.headers()['x-frame-options']).toBe('DENY');
  expect(home.headers()['x-content-type-options']).toBe('nosniff');
  expect(home.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ name: 'Find a Flatmate', display: 'standalone', start_url: '/' });
  for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200);
  expect((await request.get('/sw.js')).status()).toBe(200);
});
