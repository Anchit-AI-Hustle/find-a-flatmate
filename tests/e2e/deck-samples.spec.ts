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
  await expect(page.getByText('Answer a few more questions to see fit scores.')).toHaveCount(0);
  for (const size of sizes) {
    await page.setViewportSize(size);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations.map(v => `${size.width}: ${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.setViewportSize(sizes[0]);
  // Liking a sample makes a practice match: the dialog says it is a sample and links to a practice chat, not a real one.
  await page.getByRole('button', { name: 'Like Aarav, a sample' }).click();
  await expect(page.getByRole('alertdialog', { name: 'It’s a match!' })).toHaveAccessibleDescription(/Aarav is a sample, so this is a practice match/);
  await expect(page.getByRole('link', { name: 'Say hello' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Try the chat' })).toHaveAttribute('href', '/app/messages/sample-aarav');
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
  // Wait for the Rooms deck itself: until the navigation lands, the People deck is still on screen.
  await expect(page).toHaveURL(/mode=rooms/);
  await expect(card(page)).not.toHaveAttribute('aria-label', third);
  const room = (await card(page).getAttribute('aria-label'))!;
  expect(room).toMatch(/^Sample: /);
  await page.getByRole('button', { name: /^Like / }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('alertdialog', { name: 'It’s a match!' })).toHaveAccessibleDescription(/is a sample/);
  await page.getByRole('button', { name: 'Keep swiping' }).click();
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
  // Passed samples can be brought back on request; the liked one stays out of the deck because it is now a practice match.
  await page.goto('/app/discover');
  await page.getByRole('button', { name: 'See the samples again' }).click();
  await expect(card(page)).toHaveAttribute('aria-label', second);
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
  // Two answers are too few for a fit score; the page says so and links to the questions.
  await expect(page.getByText('Answer a few more questions to see fit scores.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'How you live' })).toHaveAttribute('href', '/onboarding/lifestyle');
  await expect(card(page).locator('.fit-badge')).toHaveCount(0);
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
    if (i % 2 === 0) await page.getByRole('button', { name: 'Keep swiping' }).click();
    await expect(page.locator(`article.swipe-card[aria-label="${label}"]`)).toHaveCount(0);
  }
  expect(seen.length).toBeGreaterThanOrEqual(2);
  expect(seen).not.toContain('Sample: Furnished room near the metro');
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
  const kept = async () => (await page.context().cookies()).filter(c => c.name.startsWith('ff_samples_') && c.value).map(c => c.name).sort();
  expect(await kept()).toEqual(['ff_samples_liked', 'ff_samples_seen']);
  await page.goto('/app/settings');
  await page.getByRole('button', { name: 'Sign out' }).first().click();
  await expect(page).toHaveURL(/\/$/);
  expect(await kept()).toEqual([]);
  expect(stored(me.id)).toBe('0');
  expect(errors).toEqual([]);
});

test('practice matches show in Matches and Chats, and the practice chat works without sending anything', async ({ page }) => {
  const errors = watchConsole(page);
  const me = await member('smp-chat');
  await dbOnboard(me, { name: `Pia ${tag()}`, ...alone() }, everyAnswer);
  await signIn(page, me.email);
  const actions: string[] = [];
  page.on('request', r => { if (r.method() === 'POST' && r.headers()['next-action']) actions.push(r.url()); });
  const check = async (label: string) => {
    for (const size of sizes) {
      await page.setViewportSize(size);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(axe.violations.map(v => `${label} ${size.width}: ${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${label} overflows at ${size.width}`).toBe(true);
    }
    await page.setViewportSize(sizes[0]);
  };
  // Nothing yet.
  await page.goto('/app/matches');
  await expect(page.getByRole('heading', { name: 'No matches yet' })).toBeVisible();
  // Like one sample person, arriving from the empty Matches page; going Back must show the match, not the empty state.
  await page.getByRole('link', { name: 'Discover people and rooms' }).click();
  await page.getByRole('button', { name: 'Like Aarav, a sample' }).click();
  await page.getByRole('button', { name: 'Keep swiping' }).click();
  await page.goBack();
  await expect(page.getByRole('region', { name: 'Sample matches' }).getByRole('link', { name: /Aarav/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No matches yet' })).toHaveCount(0);
  // And one sample room.
  await page.goto('/app/discover?mode=rooms');
  const room = (await card(page).getAttribute('aria-label'))!.replace('Sample: ', '');
  await page.getByRole('button', { name: /^Like / }).click();
  // The match screen leads straight into the practice chat.
  await page.getByRole('link', { name: 'Try the chat' }).click();
  await expect(page).toHaveURL(/\/app\/messages\/sample-[a-z]+$/);
  await expect(page.getByRole('heading', { name: room, level: 1 })).toBeVisible();
  // Both practice matches are listed, labelled, in Matches and in Chats.
  for (const [path, heading] of [['/app/matches', 'Sample matches'], ['/app/messages', 'Sample chats']] as const) {
    await page.goto(path);
    const list = page.getByRole('region', { name: heading });
    await expect(list.getByRole('link')).toHaveCount(2);
    await expect(list.getByRole('link', { name: /Aarav/ })).toContainText('Sample');
    await expect(list.getByRole('link', { name: new RegExp(room) })).toContainText('Sample');
    await expect(list.getByText('Samples are not real members')).toBeVisible();
    await expect(page.getByRole('heading', { name: /No matches yet|No conversations yet/ })).toHaveCount(0);
    await check(path);
  }
  // The practice chat: an opening line, a reply to each message, and it survives a reload.
  await page.getByRole('region', { name: 'Sample chats' }).getByRole('link', { name: /Aarav/ }).click();
  await expect(page).toHaveURL(/\/app\/messages\/sample-aarav$/);
  await expect(page.getByRole('heading', { name: 'Aarav', level: 1 })).toBeVisible();
  await expect(page.getByText('Nobody receives these messages; they stay on this device.')).toBeVisible();
  const log = page.getByRole('log');
  await expect(log).toContainText('I’m Aarav, a sample profile');
  await page.getByRole('textbox', { name: 'Message' }).fill('Hello, when can you move in?');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(log).toContainText('Hello, when can you move in?');
  await expect(log).toContainText('With a real match, this is where you compare move-in dates');
  await expect(page.getByRole('textbox', { name: 'Message' })).toHaveValue('');
  // Enter adds a line, as in a real chat; only Send sends.
  await page.getByRole('textbox', { name: 'Message' }).fill('Shall we plan a visit?');
  await page.getByRole('textbox', { name: 'Message' }).press('Enter');
  await expect(log).not.toContainText('Shall we plan a visit?');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(log).toContainText('Next comes a visit.');
  await check('practice chat');
  await page.reload();
  await expect(page.getByRole('log')).toContainText('Shall we plan a visit?');
  await expect(page.getByRole('log')).toContainText('Next comes a visit.');
  // Practice matches never count as real ones: Home still says none and the tabs carry no badges.
  await page.goto('/app');
  await expect(page.getByRole('link', { name: /^0\s*mutual matches$/ })).toBeVisible();
  await expect(page.locator('.tabbar .badge, .side .count')).toHaveCount(0);
  await page.goto('/app/messages/sample-aarav');
  // None of that touched the server or the database.
  expect(actions).toEqual([]);
  expect(stored(me.id)).toBe('0');
  expect(sql(`select (select count(*) from public.conversation_members where user_id='${me.id}') + (select count(*) from public.messages where sender_id='${me.id}')`)).toBe('0');
  // Removing a practice match takes it out of Matches and Chats and closes its chat, in another open tab too.
  const other = await page.context().newPage();
  await other.goto('/app/messages');
  await expect(other.getByRole('region', { name: 'Sample chats' }).getByRole('link')).toHaveCount(2);
  await page.getByRole('button', { name: 'Remove this sample match' }).click();
  await expect(page).toHaveURL(/\/app\/matches$/);
  await expect(page.getByRole('region', { name: 'Sample matches' }).getByRole('link')).toHaveCount(1);
  await expect(other.getByRole('region', { name: 'Sample chats' }).getByRole('link')).toHaveCount(1);
  // A tab still showing the removed chat closes it instead of taking more messages.
  await page.goBack();
  await expect(page.getByText('This sample match was removed, so its practice chat is closed.')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Message' })).toHaveCount(0);
  // Signing out forgets the practice messages kept in this browser.
  const chats = () => other.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('ff_sample_chat_')).length);
  expect(await chats()).toBe(1);
  await other.goto('/app/settings');
  await other.getByRole('button', { name: 'Sign out' }).first().click();
  await expect(other).toHaveURL(/\/$/);
  expect(await chats()).toBe(0);
  await other.close();
  await signIn(page, me.email);
  await page.goto('/app/messages/sample-aarav');
  await expect(page.getByRole('heading', { name: /not found|can’t find/i })).toBeVisible();
  // A sample that was never liked has no chat either.
  await page.goto('/app/messages/sample-meher');
  await expect(page.getByRole('heading', { name: /not found|can’t find/i })).toBeVisible();
  expect(errors.filter(e => !/404/.test(e))).toEqual([]);
});
