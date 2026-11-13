import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import sharp from 'sharp';
import { sql } from '../support/local';
import { email, onboard, signIn, watchConsole } from './helpers';

/**
 * One connected story against real persistence: a poster lists a room, a moderator approves it, a seeker finds it,
 * they match, chat, plan a visit, and then an abuse case is reported, blocked and moderated.
 */
test.describe.configure({ mode: 'serial' });
const asha = email('asha'), ravi = email('ravi'), mod = email('mod'), mallory = email('mallory');
const tag = Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 5) || 'zz';
const A = `Asha ${tag}`, R = `Ravi ${tag}`, M = `Mallory ${tag}`;
const reportText = `Asked for an advance payment before any visit (${tag}).`;
const title = `Sunny room near the metro ${Date.now().toString(36)}`;
let poster: BrowserContext, seeker: BrowserContext, moderator: BrowserContext, outsider: BrowserContext;
let p: Page, s: Page, m: Page, o: Page;
let errors: string[][] = [];
let chatUrl = '', listingId = '';
const istInput = (hoursAhead: number) => new Date(Date.now() + hoursAhead * 36e5 + 5.5 * 36e5).toISOString().slice(0, 16);
const axe = async (page: Page, where: string) => {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(result.violations.map(v => `${v.id}: ${v.nodes[0]?.target}`), `axe on ${where}`).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `no horizontal scroll on ${where}`).toBe(true);
};

/** Signed-in pages stream a loading state first, so a missing page is asserted by its content, not its status code. */
const gone = async (page: Page, path: string) => {
  await page.goto(path);
  await expect(page.getByRole('heading', { name: 'We can’t find that page' })).toBeVisible();
};

test.beforeAll(async ({ browser }) => {
  [poster, seeker, moderator, outsider] = await Promise.all([
    browser.newContext({ viewport: { width: 390, height: 844 } }), browser.newContext({ viewport: { width: 390, height: 844 } }),
    browser.newContext({ viewport: { width: 1280, height: 900 } }), browser.newContext({ viewport: { width: 820, height: 1180 } }),
  ]);
  [p, s, m, o] = await Promise.all([poster.newPage(), seeker.newPage(), moderator.newPage(), outsider.newPage()]);
  errors = [p, s, m, o].map(watchConsole);
});
test.afterAll(async () => {
  expect(errors.flat().filter(e => !/404|Failed to load resource/.test(e)), 'console errors during journeys').toEqual([]);
  await Promise.all([poster, seeker, moderator, outsider].map(c => c.close()));
});

test('poster signs up with a magic link, onboards and saves a draft listing with full costs', async () => {
  await signIn(p, asha);
  await expect(p).toHaveURL(/\/onboarding\/intent/);
  await onboard(p, { name: A, intent: 'I have a room to fill' });
  await p.getByRole('link', { name: 'List my room' }).click();
  await p.getByLabel('Title').fill(title);
  await p.getByLabel('Description').fill('Two working professionals, quiet on weeknights. Bright room with a balcony and a shared kitchen.');
  await p.getByLabel('Locality').selectOption('sector-56');
  await p.getByLabel('Monthly rent').fill('15500');
  await p.getByLabel('Monthly maintenance').fill('2000');
  await p.getByLabel('Refundable deposit (one-time)').fill('31000');
  await p.getByRole('checkbox', { name: 'Wi-Fi' }).check();
  await p.getByLabel(/I confirm this vacancy is real/).check();
  await p.getByRole('group', { name: 'Smoking' }).getByRole('button', { name: 'No shared-space smoking' }).click();
  await p.getByRole('button', { name: 'Save draft' }).click();
  await expect(p).toHaveURL(/\/app\/listings\/[0-9a-f-]{36}\/edit/);
  listingId = p.url().match(/listings\/([0-9a-f-]{36})/)![1];
  await axe(p, 'listing editor');
});

test('poster cannot submit without a photo, uploads one (metadata stripped), and submits for review', async () => {
  await p.getByRole('button', { name: 'Submit for review' }).click();
  await expect(p.getByRole('alert').filter({ hasText: /needs a photo/ })).toBeVisible();
  await p.getByLabel(/Add a photo/).setInputFiles({ name: 'notes.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('<script>alert(1)</script> not really an image') });
  await p.getByLabel(/I took this photo/).check();
  await p.getByRole('button', { name: 'Upload photo' }).click();
  await expect(p.getByRole('alert').filter({ hasText: /could not be read as a supported photo/ })).toBeVisible();
  const photo = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#88b7a5' } }).withExif({ IFD0: { Copyright: 'secret-gps-marker' } }).jpeg().toBuffer();
  await p.getByLabel(/Add a photo/).setInputFiles({ name: 'room.jpg', mimeType: 'image/jpeg', buffer: photo });
  await p.getByRole('button', { name: 'Upload photo' }).click();
  await expect(p.getByText('Photo added. Embedded metadata was removed.')).toBeVisible();
  await expect(p.getByRole('heading', { name: 'Photos (1 of 6)' })).toBeVisible();
  const src = await p.getByAltText('Listing photo 1').getAttribute('src');
  const served = await p.request.get(src!);
  expect(served.headers()['content-type']).toBe('image/webp');
  expect((await served.body()).includes(Buffer.from('secret-gps-marker'))).toBe(false);
  await p.getByRole('button', { name: 'Submit for review' }).click();
  await p.goto('/app/listings');
  await expect(p.getByText('In review')).toBeVisible();
  // Not public before moderation.
  expect((await p.request.get(`/listing/${listingId}`)).status()).toBe(404);
});

test('an ordinary member cannot open the moderation dashboard', async () => {
  const response = await p.goto('/admin');
  expect(response?.status()).toBe(404);
});

test('moderator reviews the listing with its evidence and approves it, leaving an audit entry', async () => {
  await signIn(m, mod);
  sql(`insert into private.moderators(user_id) select id from auth.users where email='${mod}'`);
  await m.goto('/admin');
  await expect(m.getByRole('heading', { name: 'Moderation', level: 1 })).toBeVisible();
  const card = m.locator('article').filter({ hasText: title });
  await expect(card.getByText('Cash needed to move in')).toBeVisible();
  await expect(card.getByAltText('Listing photo 1')).toBeVisible();
  await card.getByLabel('Reason to approve').fill('Photos, costs and dates look genuine');
  await card.getByRole('button', { name: 'Approve' }).click();
  await expect(m.locator('article').filter({ hasText: title })).toHaveCount(0);
  await expect(m.getByRole('cell', { name: 'listing.approve' }).first()).toBeVisible();
  await axe(m, 'admin dashboard');
});

test('the approved listing is public with safe fields only', async () => {
  await o.goto(`/listing/${listingId}`);
  await expect(o.getByRole('heading', { name: title })).toBeVisible();
  await expect(o.getByText('₹17,500')).toBeVisible();
  await expect(o.getByText('₹48,500')).toBeVisible();
  await expect(o.getByText('Not known yet')).toBeVisible();
  await expect(o.locator('img[src*="/api/media/"]')).toHaveCount(0);
  await expect(o.getByText(A)).toHaveCount(0);
});

test('seeker onboards, finds the room with honest costs and fit reasons, saves it and shows interest', async () => {
  await signIn(s, ravi);
  await onboard(s, { name: R, intent: 'I’m looking for a room' });
  await s.goto('/app/discover?mode=rooms&view=list');
  const card = s.locator('article').filter({ hasText: title });
  await expect(card.getByText('₹17,500')).toBeVisible();
  await expect(card.getByText('Your preferred localities overlap.')).toBeVisible();
  await expect(card.getByText(/Utilities are unknown/)).toBeVisible();
  await axe(s, 'discover rooms');
  await card.getByRole('button', { name: 'Save' }).click();
  await expect(card.getByRole('button', { name: 'Saved ✓' })).toBeVisible();
  await card.getByRole('link', { name: title }).click();
  await expect(s.getByRole('heading', { name: 'How this home fits you' })).toBeVisible();
  await expect(s.getByText('Compatible expectations for smoking.')).toBeVisible();
  await axe(s, 'room detail');
  await s.getByRole('button', { name: 'I’m interested in this room' }).click();
  await expect(s.getByText('Interest sent', { exact: true })).toBeVisible();
  await s.goto('/app/saved');
  await expect(s.getByRole('link', { name: title })).toBeVisible();
  // Filters that exclude it give an honest empty state.
  await s.goto('/app/discover?mode=rooms&max=5000&view=list');
  await expect(s.getByRole('heading', { name: 'No results for these filters' })).toBeVisible();
  // People tab: Asha appears with a symmetric explanation.
  await s.goto('/app/discover?view=list');
  await expect(s.locator('article').filter({ hasText: A }).getByText('Email verified')).toBeVisible();
});

test('no chat exists until the poster accepts; then a mutual match opens a conversation', async () => {
  await s.goto('/app/messages');
  await expect(s.getByRole('heading', { name: 'No conversations yet' })).toBeVisible();
  await p.goto('/app/matches');
  const request = p.locator('article').filter({ hasText: R });
  await expect(request).toBeVisible();
  await request.getByRole('button', { name: 'Accept and open chat' }).click();
  await expect(p).toHaveURL(/\/app\/messages\/[0-9a-f-]{36}/);
  chatUrl = new URL(p.url()).pathname;
  await p.getByRole('textbox', { name: 'Message' }).fill('Hi Ravi! The room is free from next week. Would you like to see it?');
  await p.getByRole('button', { name: 'Send' }).click();
  await expect(p.locator('.bubble.mine')).toContainText('Would you like to see it?');
  await expect(p.getByRole('textbox', { name: 'Message' })).toHaveValue('');
  await axe(p, 'conversation');
});

test('seeker sees the unread message, replies, and the count clears', async () => {
  await s.goto('/app');
  await expect(s.getByRole('link', { name: /Read 1 new message/ })).toBeVisible();
  await s.goto('/app/messages');
  await expect(s.getByText('1 unread')).toBeVisible();
  await s.getByRole('link', { name: new RegExp(A) }).click();
  await expect(s.locator('.bubble').first()).toContainText('Would you like to see it?');
  await s.getByRole('textbox', { name: 'Message' }).fill('Yes please. Saturday morning works for me.');
  await s.getByRole('button', { name: 'Send' }).click();
  await expect(s.locator('.bubble.mine')).toContainText('Saturday morning');
  await s.goto('/app/messages');
  await expect(s.getByText('1 unread')).toHaveCount(0);
  // The poster's open chat picks the reply up by polling, without a reload.
  await expect(p.locator('.bubble').last()).toContainText('Saturday morning', { timeout: 20_000 });
});

test('a third member cannot open their conversation, even with the link', async () => {
  await signIn(o, mallory);
  await onboard(o, { name: M, intent: 'I’m looking for a room' });
  await gone(o, chatUrl);
  await expect(o.getByText('Would you like to see it?')).toHaveCount(0);
});

test('seeker proposes a visit; poster confirms and shares the address only with the seeker', async () => {
  await s.goto(chatUrl);
  await s.locator('#visit-new').fill(istInput(5));
  await s.getByRole('button', { name: 'Propose this time' }).click();
  await expect(s.getByRole('heading', { name: 'Visit: Requested' })).toBeVisible();
  await expect(s.getByRole('button', { name: 'Confirm' })).toHaveCount(0);
  await p.goto('/app/visits');
  await expect(p.getByText(/needs your reply/)).toBeVisible();
  await p.goto(chatUrl);
  await p.getByRole('button', { name: 'Confirm' }).click();
  await expect(p.getByRole('heading', { name: 'Visit: Confirmed' })).toBeVisible();
  await p.getByText('Share or remove the address for this visit').click();
  await p.getByLabel('Flat, building and landmark').fill('Flat 4B, Tower 2, opposite the park gate');
  await p.getByRole('button', { name: 'Share for this visit' }).click();
  await s.goto(chatUrl);
  await expect(s.getByText('Flat 4B, Tower 2, opposite the park gate')).toBeVisible();
  await s.goto('/app/visits');
  await expect(s.getByText('Confirmed')).toBeVisible();
  await axe(s, 'visits');
});

test('a payment request is flagged; the seeker reports the message and blocks, which cuts both sides off', async () => {
  await p.goto(chatUrl);
  await p.getByRole('textbox', { name: 'Message' }).fill('Please send a token amount by UPI today to hold the room.');
  await p.getByRole('button', { name: 'Send' }).click();
  await expect(p.locator('.bubble.mine').last()).toContainText('token amount');
  await s.goto(chatUrl);
  await expect(s.getByRole('alert').filter({ hasText: 'Be careful.' })).toBeVisible();
  await s.locator('.bubble.flag').getByText('Report this message').click();
  const form = s.locator('.bubble.flag form');
  await form.getByLabel('What’s wrong?').selectOption('scam');
  await form.getByLabel('What happened?').fill(reportText);
  await form.getByLabel('Also block this person').check();
  await form.getByRole('button', { name: 'Send report' }).click();
  await expect(s).toHaveURL(/\/app\/matches/);
  for (const page of [s, p]) await gone(page, chatUrl);
  await s.goto('/app/discover?view=list');
  await expect(s.locator('article').filter({ hasText: A })).toHaveCount(0);
  await s.goto('/app/discover?mode=rooms&view=list');
  await expect(s.locator('article').filter({ hasText: title })).toHaveCount(0);
});

test('moderator investigates, reads only the reported message with a logged reason, and suspends the member', async () => {
  await m.goto('/admin');
  const report = m.locator('article').filter({ hasText: reportText });
  await expect(report.getByRole('button', { name: 'Read the reported message' })).toHaveCount(0);
  await report.getByLabel('Reason to start investigating').fill('Possible advance-payment scam');
  await report.getByRole('button', { name: 'Start investigating' }).click();
  await expect(report.getByText('investigating', { exact: true })).toBeVisible();
  await report.getByLabel('Justification for reading the message').fill('Need the exact wording to decide');
  await report.getByRole('button', { name: 'Read the reported message' }).click();
  await expect(report.getByText('Please send a token amount by UPI today to hold the room.')).toBeVisible();
  const suspensionReason = `Requested advance payment before a visit (${tag})`;
  await report.getByLabel('Reason to suspend the reported member').fill(suspensionReason);
  await report.getByRole('button', { name: 'Suspend the reported member' }).click();
  const suspension = m.getByRole('row').filter({ hasText: suspensionReason });
  await expect(suspension.getByRole('cell', { name: 'profile.suspend', exact: true })).toBeVisible();
  await expect(m.getByRole('cell', { name: 'report.read_reported_message' }).first()).toBeVisible();
  // The suspended member is locked out of the app but can still appeal and export.
  await p.goto('/app/discover');
  await expect(p).toHaveURL(/\/app\/settings\/data/);
  await expect(p.getByText('Your account is suspended')).toBeVisible();
  await p.getByLabel('How can we help?').fill(`I would like to appeal (${tag}). That was a misunderstanding.`);
  await p.getByRole('button', { name: 'Send to support' }).click();
  await expect(p.getByText('Your request is in the support queue.')).toBeVisible();
  await m.reload();
  await expect(m.getByText(`I would like to appeal (${tag}). That was a misunderstanding.`)).toBeVisible();
  // Their listing is no longer public.
  expect((await o.request.get(`/listing/${listingId}`)).status()).toBe(404);
});

test('data persists across sign-out; the seeker can edit, export and close their account', async () => {
  await s.goto('/app/profile');
  await s.getByRole('button', { name: 'Sign out' }).click();
  await expect(s).toHaveURL(/\/$/);
  await s.goto('/app');
  await expect(s).toHaveURL(/\/login/);
  await signIn(s, ravi);
  await expect(s).toHaveURL(/\/app$/);
  await expect(s.getByRole('heading', { name: `Hello, ${R}` })).toBeVisible();
  await s.goto('/onboarding/lifestyle');
  await expect(s.locator('input[name="smoking_strength"]')).toHaveValue('dealbreaker');
  await s.getByRole('group', { name: 'Noise' }).getByRole('button', { name: 'Usually quiet' }).click();
  await s.getByRole('button', { name: 'Save answers' }).click();
  await expect(s).toHaveURL(/\/app\/profile/);
  await expect(s.getByText('3 of 14 topics answered.')).toBeVisible();
  await axe(s, 'profile');
  const exported = await s.request.get('/app/settings/data/export');
  expect(exported.status()).toBe(200);
  const data = await exported.json();
  expect(data.profile[0].display_name).toBe(R);
  expect(data.account.email).toBe(ravi);
  expect(data.messages_sent.map((x: { body: string }) => x.body)).toContain('Yes please. Saturday morning works for me.');
  expect(JSON.stringify(data)).not.toContain(asha);
  await s.goto('/app/settings/privacy');
  await s.getByLabel('Profile status').selectOption('paused');
  await s.getByRole('button', { name: 'Save choices' }).click();
  await expect(s.getByText('Saved.')).toBeVisible();
  await o.goto('/app/discover?view=list');
  await expect(o.locator('article').filter({ hasText: R })).toHaveCount(0);
  await s.goto('/app/settings/data');
  await axe(s, 'data and support');
  s.once('dialog', d => d.accept());
  await s.getByLabel(/I understand my profile and listings will be removed/).check();
  await s.getByRole('button', { name: 'Close my account' }).click();
  await expect(s.getByText('Your account is closed.')).toBeVisible();
  await s.goto('/app/discover');
  await expect(s).toHaveURL(/\/app\/settings\/data/);
});
