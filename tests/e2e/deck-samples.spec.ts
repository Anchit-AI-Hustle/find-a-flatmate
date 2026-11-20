import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { dimensions } from '../../lib/catalog';
import { istDate, member, onboard as dbOnboard, sql } from '../support/local';
import { signIn, watchConsole } from './helpers';

/** Sample cards let a member try swiping while real supply is thin. They are labelled, and nothing about them is stored. */
const tag = () => Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 5) || 'zz';
// A one-day move-in window months after every other fixture's, plus a narrow budget band, both picked at random. Real
// people and rooms need overlapping dates and budgets, so the deck of a member made this way holds samples only (two
// members made here collide about once in 28,000 pairs).
const alone = () => {
  const min = (30_000 + Math.floor(Math.random() * 460) * 1_000) * 100;
  const day = istDate(100 + Math.floor(Math.random() * 61));
  return { city: 'noida', areas: ['sector-62'], min, max: min + 50_000, from: day, until: day };
};
const everyAnswer = Object.fromEntries(Object.entries(dimensions).map(([k, options]) => [k, { habit: options[0], want: options[0], strength: 'preference' }]));
const stored = (id: string) => sql(`select (select count(*) from public.interests where actor_id='${id}' or target_id='${id}') + (select count(*) from public.saved_items where user_id='${id}')`);
const card = (page: Page) => page.locator('article.swipe-card');
const sizes = [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1440, height: 900 }];

test('sample people: labelled, swipeable, and never stored', async ({ page }) => {
  const errors = watchConsole(page);
  const me = await member('smp-me');
  await dbOnboard(me, { name: `Sami ${tag()}`, ...alone() }, everyAnswer);
  await signIn(page, me.email);
  // Swiping a sample must never call a server action.
  const actions: string[] = [];
  page.on('request', r => { if (r.method() === 'POST' && r.headers()['next-action']) actions.push(r.url()); });
  await page.goto('/app/discover');
  // The sample who "likes you" comes first, exactly as a real one would, and every sample says what it is.
  await expect(card(page)).toHaveAttribute('aria-label', 'Sample: Aarav');
  await expect(card(page).getByText('Sample', { exact: true })).toBeVisible();
  await expect(card(page).getByText('Likes you')).toBeVisible();
  await expect(card(page).locator('.fit-badge b')).toHaveText(/^\d{2,3}$/);
  await expect(card(page).getByText('Sector 62')).toBeVisible();
  await expect(page.getByText('Sample for practice · nothing is sent')).toBeVisible();
  await expect(page.getByRole('link', { name: /More about/ })).toHaveCount(0);
  for (const size of sizes) {
    await page.setViewportSize(size);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations.map(v => `${size.width}: ${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.setViewportSize(sizes[0]);
  // Liking a sample who likes you shows a practice match with no chat to open.
  await page.getByRole('button', { name: 'Like Aarav, a sample' }).click();
  await expect(page.getByRole('alertdialog', { name: 'It’s a match!' })).toHaveAccessibleDescription(/Aarav is a sample/);
  await expect(page.getByText('Aarav is a sample. With a real member, a private chat opens here.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Say hello' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Keep swiping' }).click();
  // Pass, undo, then pass again with the keyboard.
  const second = (await card(page).getAttribute('aria-label'))!;
  expect(second).toMatch(/^Sample: /);
  const name = second.replace('Sample: ', '');
  await page.getByRole('button', { name: `Pass on ${name}` }).click();
  await expect(card(page)).not.toHaveAttribute('aria-label', second);
  await page.getByRole('button', { name: 'Undo last pass' }).click();
  await expect(card(page)).toHaveAttribute('aria-label', second);
  await page.getByRole('button', { name: `Pass on ${name}` }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(card(page)).not.toHaveAttribute('aria-label', second);
  // While a swipe is animating out, undo is locked, so it cannot be overwritten by the swipe that is finishing.
  const third = (await card(page).getAttribute('aria-label'))!;
  await expect(page.getByRole('button', { name: 'Undo last pass' })).toBeEnabled();
  expect(await page.evaluate(async () => {
    const buttons = [...document.querySelectorAll('button')];
    buttons.find(b => b.getAttribute('aria-label')?.startsWith('Pass on '))!.click();
    await new Promise(done => requestAnimationFrame(done));
    return buttons.find(b => b.getAttribute('aria-label') === 'Undo last pass')!.disabled;
  })).toBe(true);
  await expect(card(page)).not.toHaveAttribute('aria-label', third);
  await page.getByRole('button', { name: 'Undo last pass' }).click();
  await expect(card(page)).toHaveAttribute('aria-label', third);
  expect(stored(me.id)).toBe('0');
  // Samples swiped on the Rooms tab are remembered alongside these, and coming Back does not revive any of them.
  await page.getByRole('navigation', { name: 'What to show' }).getByRole('link', { name: 'Rooms' }).click();
  const room = (await card(page).getAttribute('aria-label'))!;
  expect(room).toMatch(/^Sample: /);
  await page.getByRole('button', { name: /^Like / }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(card(page)).not.toHaveAttribute('aria-label', room);
  await page.goBack();
  await expect(card(page)).toHaveAttribute('aria-label', third);
  await page.goForward();
  await expect(card(page)).toHaveAttribute('aria-label', /^Sample: /);
  await expect(card(page)).not.toHaveAttribute('aria-label', room);
  await page.goBack();
  // Swiped samples stay away after a reload, and the rest can be swiped to the end.
  await page.reload();
  await expect(card(page)).toHaveAttribute('aria-label', /^Sample: /);
  await expect(card(page)).not.toHaveAttribute('aria-label', /Aarav/);
  await expect(card(page)).not.toHaveAttribute('aria-label', second);
  for (let i = 0; i < 12 && await card(page).count(); i++) {
    const label = (await card(page).getAttribute('aria-label'))!;
    await page.getByRole('button', { name: /^Pass on / }).click();
    await expect(page.locator(`article.swipe-card[aria-label="${label}"]`)).toHaveCount(0);
  }
  await expect(page.getByRole('heading', { name: 'You’re all caught up' })).toBeVisible();
  expect(stored(me.id)).toBe('0');
  expect(sql(`select count(*) from public.conversation_members where user_id='${me.id}'`)).toBe('0');
  expect(actions).toEqual([]);
  // Nothing in Chats or Matches came from the samples.
  await page.goto('/app/messages');
  await expect(page.getByText('Aarav')).toHaveCount(0);
  // They can be brought back on request.
  await page.goto('/app/discover');
  await page.getByRole('button', { name: 'See the samples again' }).click();
  await expect(card(page)).toHaveAttribute('aria-label', 'Sample: Aarav');
  expect(errors).toEqual([]);
});

test('sample rooms: priced inside the member’s budget, hidden from the list and from filtered searches', async ({ page }) => {
  const errors = watchConsole(page);
  const me = await member('smp-rooms');
  // The default fixture has a smoking dealbreaker, so samples that clash with it must not appear at all.
  const search = alone();
  await dbOnboard(me, { name: `Rhea ${tag()}`, ...search });
  await signIn(page, me.email);
  await page.goto('/app/discover?mode=rooms');
  await expect(card(page)).toHaveAttribute('aria-label', /^Sample: /);
  await expect(card(page).getByText('Sample', { exact: true })).toBeVisible();
  const price = Number((await card(page).locator('.price').innerText()).match(/₹([\d,]+)/)![1].replaceAll(',', ''));
  expect(price).toBeGreaterThan(0);
  expect(price).toBeLessThanOrEqual(search.max / 100);
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.map(v => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  const seen: string[] = [];
  for (let i = 0; i < 10 && await card(page).count(); i++) {
    const label = (await card(page).getAttribute('aria-label'))!;
    seen.push(label);
    await page.getByRole('button', { name: i % 2 ? /^Pass on / : /^Like / }).click();
    await expect(page.locator(`article.swipe-card[aria-label="${label}"]`)).toHaveCount(0);
  }
  expect(seen.length).toBeGreaterThanOrEqual(2);
  expect(seen).not.toContain('Sample: Furnished room near the metro');
  await expect(page.getByRole('heading', { name: 'It’s a match!' })).toHaveCount(0);
  expect(stored(me.id)).toBe('0');
  // People samples that clash with the dealbreaker are left out too.
  await page.goto('/app/discover');
  const people: string[] = [];
  for (let i = 0; i < 12 && await card(page).count(); i++) {
    const label = (await card(page).getAttribute('aria-label'))!;
    people.push(label);
    await page.getByRole('button', { name: /^Pass on / }).click();
    await expect(page.locator(`article.swipe-card[aria-label="${label}"]`)).toHaveCount(0);
  }
  expect(people).toEqual(expect.arrayContaining(['Sample: Aarav', 'Sample: Tara']));
  for (const smoker of ['Kabir', 'Rohan', 'Isha']) expect(people).not.toContain(`Sample: ${smoker}`);
  // The list view and filtered searches only ever show real results.
  await page.goto('/app/discover?view=list');
  await expect(page.getByText('Sample', { exact: true })).toHaveCount(0);
  await expect(page.locator('.sample-tag')).toHaveCount(0);
  await expect(page.locator('article.card.result')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /No one to show yet|Nothing meets all your basics yet/ })).toBeVisible();
  await page.goto('/app/discover?area=sector-62');
  await expect(card(page)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'You’re all caught up' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'See the samples again' })).toHaveCount(0);
  // Signing out clears the memory, so the next person on this browser gets a full set.
  expect((await page.context().cookies()).some(c => c.name === 'ff_samples_seen' && c.value)).toBe(true);
  await page.goto('/app/settings');
  await page.getByRole('button', { name: 'Sign out' }).first().click();
  await expect(page).toHaveURL(/\/$/);
  expect((await page.context().cookies()).some(c => c.name === 'ff_samples_seen' && c.value)).toBe(false);
  expect(stored(me.id)).toBe('0');
  expect(errors).toEqual([]);
});
