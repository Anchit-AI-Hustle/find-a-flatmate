import { expect, test } from '@playwright/test';
import { liveListing, matched, member, moderator, onboard as dbOnboard, sql } from '../support/local';
import { signIn } from './helpers';

/** Defects found by independent review; each test sets up state through the real RPCs, then checks the screen. */
const tag = () => Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 5) || 'zz';

test('a declined interest request clears from Matches and from the badge', async ({ page }) => {
  const t = tag();
  const [a, b] = await Promise.all([member('req-a'), member('req-b')]);
  await Promise.all([dbOnboard(a, { name: `Anil ${t}` }), dbOnboard(b, { name: `Bela ${t}` })]);
  expect((await a.db.rpc('interest_transition', { target: b.id, action: 'like' })).error).toBeNull();
  await signIn(page, b.email);
  await expect(page.getByRole('link', { name: /Review 1 interest request/ })).toBeVisible();
  await page.goto('/app/matches');
  const card = page.locator('article').filter({ hasText: `Anil ${t}` });
  await expect(card.getByText('Compatible expectations for smoking.')).toBeVisible();
  await card.getByRole('button', { name: 'Not for me' }).click();
  await expect(page.getByRole('heading', { name: 'Interested in you' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Passed or withdrawn' })).toBeVisible();
  await page.goto('/app');
  await expect(page.getByRole('link', { name: /interest request/ })).toHaveCount(0);
});

test('a request that conflicts with a dealbreaker explains why it cannot be accepted', async ({ page }) => {
  const t = tag();
  const [a, b] = await Promise.all([member('deal-a'), member('deal-b')]);
  await dbOnboard(a, { name: `Arun ${t}` }, { pets: { habit: 'Pets welcome', strength: 'flexible' } });
  await dbOnboard(b, { name: `Bina ${t}` }, {});
  expect((await a.db.rpc('interest_transition', { target: b.id, action: 'like' })).error).toBeNull();
  expect((await b.db.rpc('save_lifestyle', { answers: { pets: { habit: 'No pets', want: 'No pets', strength: 'dealbreaker' } } })).error).toBeNull();
  await signIn(page, b.email);
  await page.goto('/app/matches');
  const card = page.locator('article').filter({ hasText: `Arun ${t}` });
  await expect(card.getByText('Dealbreaker: Pets')).toBeVisible();
  await expect(card.getByText(/a chat can’t be opened/)).toBeVisible();
  await expect(card.getByRole('button', { name: 'Accept and open chat' })).toHaveCount(0);
});

test('any received message can be reported, and a shared address stays visible after the visit starts', async ({ page }) => {
  const t = tag();
  const [a, b] = await Promise.all([member('chat-a'), member('chat-b')]);
  await Promise.all([dbOnboard(a, { name: `Asif ${t}` }), dbOnboard(b, { name: `Bhavna ${t}` })]);
  const chat = await matched(a, b);
  await a.db.rpc('send_message', { c: chat, body: 'You are not welcome here.', request_key: crypto.randomUUID() });
  const visit = (await a.db.rpc('visit_transition', { c: chat, v: null, action: 'request', at_time: new Date(Date.now() + 3 * 36e5).toISOString() })).data as string;
  await b.db.rpc('visit_transition', { c: chat, v: visit, action: 'confirm' });
  expect((await a.db.rpc('visit_location', { c: chat, v: visit, location: 'Flat 12, Tower B, by the east gate' })).error).toBeNull();
  sql(`update public.visit_requests set starts_at=now()-interval '20 minutes' where id='${visit}'`);
  await signIn(page, b.email);
  await page.goto(`/app/messages/${chat}`);
  await expect(page.getByText('Flat 12, Tower B, by the east gate')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Visit happened' })).toBeVisible();
  await expect(page.getByText('Share or remove the address for this visit')).toHaveCount(0);
  const bubble = page.locator('.bubble').filter({ hasText: 'You are not welcome here.' });
  await bubble.getByText('Report this message').click();
  await bubble.getByLabel('What’s wrong?').selectOption('harassment');
  await bubble.getByLabel('What happened?').fill(`Hostile message (${t}).`);
  await bubble.getByRole('button', { name: 'Send report' }).click();
  await expect(bubble.getByText('Report received. Moderators can review it.')).toBeVisible();
  expect(sql(`select count(*) from public.reports where details='Hostile message (${t}).' and message_id is not null`)).toBe('1');
});

test('a paused owner is told their listing is hidden instead of being offered buttons that fail', async ({ page }) => {
  const t = tag();
  const [owner, mod] = await Promise.all([member('pause-o'), moderator()]);
  await dbOnboard(owner, { name: `Padma ${t}`, intent: 'have_room' });
  await liveListing(owner, mod, { title: `Paused owner room ${t}` });
  await owner.db.rpc('save_privacy', { v: { status: 'paused', discoverable: true, analytics: false, reminders: false } });
  await signIn(page, owner.email);
  await page.goto('/app/listings');
  await expect(page.getByText('Hidden while paused')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Resume your profile' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark as filled' })).toHaveCount(0);
  await page.goto('/app/discover');
  await expect(page.getByText(/Your profile is paused/)).toBeVisible();
});

test('passing on a room hides that owner’s rooms and can be undone from the room page', async ({ page }) => {
  const t = tag();
  const [owner, seeker, mod] = await Promise.all([member('pass-o'), member('pass-s'), moderator()]);
  await Promise.all([dbOnboard(owner, { name: `Omar ${t}`, intent: 'have_room' }), dbOnboard(seeker, { name: `Sana ${t}` })]);
  const id = await liveListing(owner, mod, { title: `Passable room ${t}` });
  await signIn(page, seeker.email);
  await page.goto(`/app/rooms/${id}`);
  await page.getByRole('button', { name: 'Not for me' }).click();
  await expect(page.getByText('You passed')).toBeVisible();
  await page.goto('/app/discover?mode=rooms');
  await expect(page.locator('article').filter({ hasText: `Passable room ${t}` })).toHaveCount(0);
  await page.goto(`/app/rooms/${id}`);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: 'I’m interested in this room' })).toBeVisible();
});
