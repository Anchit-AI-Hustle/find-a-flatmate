import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { liveListing, member, moderator, onboard as dbOnboard, sql } from '../support/local';
import { signIn } from './helpers';

/** Swipe matching: buttons, keyboard and drag all persist through the same interest RPC. */
const tag = () => Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 5) || 'zz';
const status = (actor: string, target: string) => sql(`select coalesce((select status::text from public.interests where actor_id='${actor}' and target_id='${target}'),'none')`);

async function dragCard(page: Page, card: Locator, distance: number) {
  await card.scrollIntoViewIfNeeded();
  const box = (await card.boundingBox())!;
  const start = box.x + box.width * (distance < 0 ? 0.7 : 0.3);
  const y = box.y + Math.min(100, box.height / 2);
  await page.mouse.move(start, y);
  await page.mouse.down();
  await page.mouse.move(start + distance, y, { steps: 10 });
  await page.mouse.up();
}

test('swiping people: pass, undo, like by keyboard, and a mutual like shows a match', async ({ page }) => {
  const t = tag();
  // A fresh locality-free pair of candidates in Noida keeps this deck to exactly two cards.
  const [me, liker, other] = await Promise.all([member('sw-me'), member('sw-liker'), member('sw-other')]);
  const noida = { city: 'noida', areas: ['sector-137'], min: 7_000_000, max: 9_000_000 };
  await Promise.all([dbOnboard(me, { name: `Mira ${t}`, ...noida }), dbOnboard(liker, { name: `Lata ${t}`, ...noida }), dbOnboard(other, { name: `Omi ${t}`, ...noida })]);
  expect((await liker.db.rpc('interest_transition', { target: me.id, action: 'like' })).error).toBeNull();
  await signIn(page, me.email);
  await page.goto('/app/discover');
  // The person who already likes you is first, and says so.
  const card = page.locator('article.swipe-card');
  await expect(card).toContainText(`Lata ${t}`);
  await expect(card.getByText('Likes you')).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.map(v => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // Pass, then undo brings the same card back and clears the stored pass.
  await page.getByRole('button', { name: `Pass on Lata ${t}` }).click();
  await expect(card).toContainText(`Omi ${t}`);
  expect(status(me.id, liker.id)).toBe('passed');
  await page.getByRole('button', { name: 'Undo last pass' }).click();
  await expect(card).toContainText(`Lata ${t}`);
  expect(status(me.id, liker.id)).toBe('none');
  // Like with the keyboard: it is mutual, so the match screen appears.
  await page.getByRole('button', { name: `Like Lata ${t}` }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading', { name: 'It’s a match!' })).toBeVisible();
  expect(status(me.id, liker.id)).toBe('mutual');
  await page.getByRole('button', { name: 'Keep swiping' }).click();
  // Drag the next card to the right to like it.
  await expect(card).toContainText(`Omi ${t}`);
  await dragCard(page, card, 150);
  await expect(page.getByRole('heading', { name: 'You’re all caught up' })).toBeVisible();
  expect(status(me.id, other.id)).toBe('sent');
  // The match is waiting in Chats.
  await page.goto('/app/messages');
  await expect(page.getByRole('link', { name: new RegExp(`Lata ${t}`) })).toBeVisible();
});

test('swiping rooms: a short drag snaps back, a left swipe passes, a right swipe sends interest with the listing', async ({ page }) => {
  const t = tag();
  const [seeker, ownerA, ownerB, mod] = await Promise.all([member('sr-seeker'), member('sr-a'), member('sr-b'), moderator()]);
  const noida = { city: 'noida', areas: ['sector-137'], min: 1_000_000, max: 2_500_000 };
  await Promise.all([dbOnboard(seeker, { name: `Sia ${t}`, ...noida }), dbOnboard(ownerA, { name: `Aman ${t}`, intent: 'have_room', ...noida }), dbOnboard(ownerB, { name: `Bala ${t}`, intent: 'have_room', ...noida })]);
  const place = { city_id: 'noida', locality_id: 'sector-137' };
  await liveListing(ownerA, mod, { title: `Swipe room one ${t}`, ...place });
  await liveListing(ownerB, mod, { title: `Swipe room two ${t}`, ...place });
  await signIn(page, seeker.email);
  await page.goto(`/app/discover?mode=rooms&area=sector-137`);
  const card = page.locator('article.swipe-card');
  await expect(card).toContainText(/Swipe room (one|two)/);
  await expect(card.getByText('₹17,000')).toBeVisible();
  const first = (await card.getAttribute('aria-label'))!;
  await dragCard(page, card, 40);
  await expect(card).toHaveAttribute('aria-label', first);
  await dragCard(page, card, -150);
  await expect(card).not.toHaveAttribute('aria-label', first);
  const second = (await card.getAttribute('aria-label'))!;
  await dragCard(page, card, 150);
  await expect(page.getByRole('heading', { name: 'You’re all caught up' })).toBeVisible();
  const owners: Record<string, string> = { [`Swipe room one ${t}`]: ownerA.id, [`Swipe room two ${t}`]: ownerB.id };
  expect(status(seeker.id, owners[first])).toBe('passed');
  expect(status(seeker.id, owners[second])).toBe('sent');
});
