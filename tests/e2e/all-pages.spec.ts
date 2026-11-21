import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { liveListing, matched, member, moderator, onboard as dbOnboard } from '../support/local';
import { signIn, watchConsole } from './helpers';

/**
 * Every signed-in page, opened by a member whose account has something in each of them (a match, a chat with messages,
 * a visit, saved items, sent and received interest, a live listing and a draft). Each page must render its own heading
 * and content at phone, tablet and desktop widths with no error screen, console error, overflow or accessibility issue.
 */
const tag = () => Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 5) || 'zz';
const sizes = [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1440, height: 900 }];

async function audit(page: Page, path: string, heading: string, shows: (string | RegExp)[] = []) {
  const response = await page.goto(path);
  expect(response?.status(), `${path} status`).toBeLessThan(400);
  await expect(page.getByRole('heading', { name: heading, level: 1 }), `${path} heading`).toBeVisible();
  // The page must be the one asked for, not a redirect target that happens to have a heading.
  expect(new URL(page.url()).pathname, `${path} was redirected`).toBe(path.split('?')[0]);
  await expect(page.getByRole('heading', { name: 'Something went wrong' }), `${path} error screen`).toHaveCount(0);
  for (const text of shows) await expect(page.getByText(text).first(), `${path} shows ${text}`).toBeVisible();
  for (const size of sizes) {
    await page.setViewportSize(size);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations.map(v => `${path} ${size.width}: ${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} overflows at ${size.width}`).toBe(true);
  }
  await page.setViewportSize(sizes[0]);
}

test('every signed-in page renders with real content for a member who has used every feature', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchConsole(page);
  const t = tag();
  const [seeker, owner, fan, target, mod] = await Promise.all([member('all-seeker'), member('all-owner'), member('all-fan'), member('all-target'), moderator()]);
  await Promise.all([
    dbOnboard(seeker, { name: `Sara ${t}` }), dbOnboard(owner, { name: `Omar ${t}`, intent: 'have_room' }),
    dbOnboard(fan, { name: `Farah ${t}` }), dbOnboard(target, { name: `Tanvi ${t}` }), dbOnboard(mod, { name: `Mod ${t}` }),
  ]);
  const listing = await liveListing(owner, mod, { title: `Audit room ${t}` });
  // A mutual match with messages both ways and a visit request.
  const chat = await matched(seeker, owner);
  for (const [who, body] of [[seeker, `Hello Omar ${t}, is the room still free?`], [owner, `Yes Sara ${t}, come and see it.`]] as const)
    expect((await who.db.rpc('send_message', { c: chat, body, request_key: crypto.randomUUID() })).error).toBeNull();
  expect((await seeker.db.rpc('visit_transition', { c: chat, v: null, action: 'request', at_time: new Date(Date.now() + 2 * 864e5).toISOString() })).error).toBeNull();
  // Someone interested in the seeker, someone the seeker is waiting on, and saved items of both kinds.
  expect((await fan.db.rpc('interest_transition', { target: seeker.id, action: 'like' })).error).toBeNull();
  expect((await seeker.db.rpc('interest_transition', { target: target.id, action: 'like' })).error).toBeNull();
  expect((await seeker.db.rpc('save_item', { kind: 'listing', target: listing, enabled: true })).error).toBeNull();
  expect((await seeker.db.rpc('save_item', { kind: 'profile', target: owner.id, enabled: true })).error).toBeNull();

  await signIn(page, seeker.email);
  await audit(page, '/app', `Hello, Sara ${t}`, ['mutual matches', 'Review 1 interest request']);
  await audit(page, '/app/discover', 'Discover');
  await audit(page, '/app/discover?view=list', 'Discover');
  await audit(page, '/app/discover?mode=rooms', 'Discover');
  // Newest first, so this run's room is on the page however many older fixtures exist.
  await audit(page, '/app/discover?mode=rooms&view=list&sort=new', 'Discover', [`Audit room ${t}`]);
  // Matches: every state has its own section and the right person in it.
  await audit(page, '/app/matches', 'Matches', ['Interested in you', 'Mutual matches', 'Waiting for a reply']);
  await expect(page.getByRole('region', { name: 'Interested in you' })).toContainText(`Farah ${t}`);
  await expect(page.getByRole('region', { name: 'Mutual matches' }).getByRole('link', { name: new RegExp(`Omar ${t}`) })).toHaveAttribute('href', `/app/messages/${chat}`);
  await expect(page.getByRole('region', { name: 'Waiting for a reply' })).toContainText(`Tanvi ${t}`);
  // Chats: the match is listed and its conversation shows both sides' messages and the visit.
  await audit(page, '/app/messages', 'Messages', [`Omar ${t}`]);
  await expect(page.getByRole('link', { name: new RegExp(`Omar ${t}`) })).toHaveAttribute('href', `/app/messages/${chat}`);
  await audit(page, `/app/messages/${chat}`, `Omar ${t}`, [`Hello Omar ${t}, is the room still free?`, `Yes Sara ${t}, come and see it.`]);
  await audit(page, '/app/visits', 'Visits', [`Omar ${t}`]);
  await audit(page, '/app/saved', 'Saved', [`Audit room ${t}`, `Omar ${t}`]);
  await audit(page, `/app/people/${owner.id}`, `Omar ${t}`);
  await audit(page, `/app/rooms/${listing}`, `Audit room ${t}`);
  await audit(page, '/app/profile', `Sara ${t}`, ['How you live']);
  await audit(page, '/app/settings', 'Settings');
  await audit(page, '/app/settings/privacy', 'Privacy and visibility');
  await audit(page, '/app/settings/data', 'Data and support');
  await audit(page, '/app/group', 'Group search is coming later');
  await audit(page, '/app/listings', 'My listings');
  await audit(page, '/app/listings/new', 'List a room');
  await audit(page, '/onboarding/basics', 'Edit your basics');
  await audit(page, '/onboarding/lifestyle', 'How you live');
  await audit(page, '/onboarding/complete', `You’re in, Sara ${t}.`);
  // The last onboarding step is only for a new profile; an active member is sent to the privacy settings instead.
  await page.goto('/onboarding/preferences');
  await expect(page).toHaveURL(/\/app\/settings\/privacy$/);
  // Accepting the request turns it into a second match and a second chat, both listed at once.
  await page.goto('/app/matches');
  await page.getByRole('region', { name: 'Interested in you' }).getByRole('button', { name: /Accept|Like|Match|Yes/ }).first().click();
  await expect(page).toHaveURL(/\/app\/messages\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: `Farah ${t}`, level: 1 })).toBeVisible();
  await page.goto('/app/matches');
  await expect(page.getByRole('region', { name: 'Mutual matches' }).getByRole('link')).toHaveCount(2);
  await page.goto('/app/messages');
  await expect(page.getByRole('link', { name: new RegExp(`(Omar|Farah) ${t}`) })).toHaveCount(2);
  await page.goto('/app');
  await expect(page.getByRole('link', { name: /2\s*mutual matches/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('the owner’s listing pages and the moderation dashboard render at every width', async ({ page, browser }) => {
  test.setTimeout(180_000);
  const errors = watchConsole(page);
  const t = tag();
  const [owner, mod] = await Promise.all([member('all-own'), moderator()]);
  await Promise.all([dbOnboard(owner, { name: `Olga ${t}`, intent: 'have_room' }), dbOnboard(mod, { name: `Mira ${t}` })]);
  const live = await liveListing(owner, mod, { title: `Owner live ${t}` });
  const { data: draft, error } = await owner.db.rpc('save_listing', { l: null, v: (await import('../support/local')).listing({ title: `Owner draft ${t}` }) });
  expect(error).toBeNull();
  await signIn(page, owner.email);
  await audit(page, '/app/listings', 'My listings', [`Owner live ${t}`, `Owner draft ${t}`]);
  await audit(page, `/app/listings/${draft}/edit`, 'Edit listing', ['Submit for review']);
  await expect(page.locator('input[name="title"]')).toHaveValue(`Owner draft ${t}`);
  await audit(page, `/app/listings/${live}/edit`, 'Edit listing');
  await expect(page.locator('input[name="title"]')).toHaveValue(`Owner live ${t}`);
  await audit(page, `/app/rooms/${live}`, `Owner live ${t}`);
  expect(errors).toEqual([]);
  const admin = await (await browser.newContext({ viewport: sizes[0] })).newPage();
  const adminErrors = watchConsole(admin);
  await signIn(admin, mod.email);
  await audit(admin, '/admin', 'Moderation');
  expect(adminErrors).toEqual([]);
  await admin.context().close();
});
