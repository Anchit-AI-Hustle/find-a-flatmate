import { beforeAll, describe, expect, it } from 'vitest';
import { draftWithPhoto, istDate, listing, liveListing, matched, member, moderator, onboard, sql, type Member } from '../support/local';

/** Persisted state machines: listing, interest, chat, block, visit, report and account closure. */
let mod: Member;
beforeAll(async () => { mod = await moderator(); });
const pair = async (tag: string) => {
  const [x, y] = await Promise.all([member(`${tag}-x`), member(`${tag}-y`)]);
  await Promise.all([onboard(x, { name: 'Xena' }), onboard(y, { name: 'Yash' })]);
  return [x, y] as const;
};
const soon = (hours: number) => new Date(Date.now() + hours * 36e5).toISOString();

describe('onboarding', () => {
  it('persists a draft profile, resumes, and activates only after the privacy step', async () => {
    const m = await member('new');
    expect((await m.db.rpc('save_lifestyle', { answers: {} })).error?.message).toMatch(/Invalid lifestyle/);
    expect((await m.db.rpc('save_basics', { v: { name: 'Nia', city: 'noida', areas: ['sector-56'], min: 1, max: 2, from: istDate(1), until: istDate(9), months: 6, intent: 'looking_for_room', adult: true, terms: true } })).error?.message).toMatch(/localities/i);
    expect((await m.db.rpc('save_basics', { v: { name: 'Nia', city: 'noida', areas: ['sector-62'], min: 1_000_000, max: 2_000_000, from: istDate(1), until: istDate(9), months: 6, intent: 'looking_for_room', adult: false, terms: true } })).error?.message).toMatch(/age/i);
    await onboard(m, { name: 'Nia', city: 'noida', areas: ['sector-62'] });
    const { data } = await m.db.from('profiles').select('status,display_name,city_id,budget_max').single();
    expect(data).toEqual({ status: 'active', display_name: 'Nia', city_id: 'noida', budget_max: 2_500_000 });
    expect((await m.db.from('verification_checks').select('kind')).data).toEqual([{ kind: 'email' }]);
    expect((await m.db.from('onboarding_progress').select('step').single()).data).toEqual({ step: 'complete' });
  });
  it('rejects contact details in public text', async () => {
    const m = await member('spam');
    const r = await m.db.rpc('save_basics', { v: { name: 'Call 9876543210', city: 'gurugram', areas: ['sector-56'], min: 1, max: 2, from: istDate(1), until: istDate(9), months: 6, intent: 'have_room', adult: true, terms: true } });
    expect(r.error?.message).toMatch(/contact details/i);
  });
});

describe('listing lifecycle', () => {
  it('needs a photo, moderation and reconfirmation, and can be closed', async () => {
    const [owner, seeker] = await pair('list');
    const bare = await owner.db.rpc('save_listing', { l: null, v: listing() });
    expect(bare.error).toBeNull();
    expect((await owner.db.rpc('listing_transition', { l: bare.data, action: 'submit' })).error?.message).toMatch(/photo/i);
    const id = await draftWithPhoto(owner);
    expect((await seeker.db.from('listings').select('id').eq('id', id)).data).toEqual([]);
    expect((await owner.db.rpc('listing_transition', { l: id, action: 'renew' })).error).not.toBeNull();
    expect((await owner.db.rpc('listing_transition', { l: id, action: 'submit' })).error).toBeNull();
    expect((await seeker.db.from('listings').select('id').eq('id', id)).data).toEqual([]);
    expect((await mod.db.rpc('moderate', { kind: 'listing', target: id, action: 'approve', reason: 'Clear photos and costs' })).error).toBeNull();
    const seen = await seeker.db.from('listings').select('status,monthly,reviewed_at,expires_at').eq('id', id).single();
    expect(seen.data).toMatchObject({ status: 'active', monthly: 1_700_000 });
    expect(Date.parse(seen.data!.expires_at) - Date.now()).toBeLessThanOrEqual(21 * 864e5);
    expect((await owner.db.rpc('listing_transition', { l: id, action: 'pause' })).error).toBeNull();
    expect((await seeker.db.from('listings').select('id').eq('id', id)).data).toEqual([]);
    expect((await owner.db.rpc('listing_transition', { l: id, action: 'renew' })).error).toBeNull();
    expect(sql(`select count(*) from public.listing_reconfirmations where listing_id='${id}'`)).toBe('1');
    // Editing live content sends it back for review.
    expect((await owner.db.rpc('save_listing', { l: id, v: listing({ title: 'Edited after approval' }) })).error).toBeNull();
    expect(sql(`select status, reviewed_at is null from public.listings where id='${id}'`)).toBe('draft|t');
    expect((await owner.db.rpc('listing_transition', { l: id, action: 'fill' })).error).toBeNull();
    expect((await owner.db.rpc('save_listing', { l: id, v: listing() })).error?.message).toMatch(/cannot be edited/);
    expect((await owner.db.rpc('listing_transition', { l: id, action: 'renew' })).error).not.toBeNull();
  });
  it('stops showing a listing once it expires', async () => {
    const [owner, seeker] = await pair('exp');
    const id = await liveListing(owner, mod);
    expect((await seeker.db.rpc('public_rooms', { room_id: id })).data).toHaveLength(1);
    sql(`update public.listings set expires_at=now()-interval '1 minute' where id='${id}'`);
    expect((await seeker.db.rpc('public_rooms', { room_id: id })).data).toHaveLength(0);
    expect((await seeker.db.from('listings').select('id').eq('id', id)).data).toEqual([]);
    expect(sql('select public.expire_rooms() >= 1')).toBe('t');
    expect(sql(`select status from public.listings where id='${id}'`)).toBe('expired');
  });
  it('rejects duplicates and impossible values', async () => {
    const [owner] = await pair('dup');
    const v = listing();
    expect((await owner.db.rpc('save_listing', { l: null, v })).error).toBeNull();
    expect((await owner.db.rpc('save_listing', { l: null, v })).error?.message).toMatch(/similar listing/i);
    expect((await owner.db.rpc('save_listing', { l: null, v: listing({ occupants: 3, capacity: 3 }) })).error).not.toBeNull();
    expect((await owner.db.rpc('save_listing', { l: null, v: listing({ attested: false }) })).error?.message).toMatch(/permission/i);
  });
});

describe('interest, chat and blocking', () => {
  it('opens a chat only on mutual interest and keeps passes recoverable', async () => {
    const [x, y] = await pair('int');
    expect((await x.db.rpc('interest_transition', { target: x.id, action: 'like' })).error).not.toBeNull();
    const first = await x.db.rpc('interest_transition', { target: y.id, action: 'like' });
    expect(first.error).toBeNull();
    expect(first.data).toBeNull();
    expect((await x.db.rpc('inbox')).data).toEqual([]);
    expect((await y.db.rpc('interest_transition', { target: x.id, action: 'pass' })).error).toBeNull();
    expect(((await y.db.rpc('discover_people', { city: 'gurugram' })).data as { id: string }[]).some(p => p.id === x.id)).toBe(false);
    expect((await y.db.rpc('interest_transition', { target: x.id, action: 'reset' })).error).toBeNull();
    const second = await y.db.rpc('interest_transition', { target: x.id, action: 'like' });
    expect(second.data).toBeTruthy();
    expect((await x.db.rpc('inbox')).data).toHaveLength(1);
    expect((await x.db.from('interests').select('status').eq('actor_id', x.id).single()).data).toEqual({ status: 'mutual' });
  });
  it('refuses interest when a dealbreaker conflicts or basics do not overlap', async () => {
    const [x, smoker, far] = await Promise.all([member('db-x'), member('db-s'), member('db-f')]);
    await onboard(x, { name: 'Xena' });
    await onboard(smoker, { name: 'Sam' }, { smoking: { habit: 'Shared-space smoking', want: 'Shared-space smoking', strength: 'flexible' } });
    await onboard(far, { name: 'Farah', min: 6_000_000, max: 9_000_000 });
    expect((await x.db.rpc('interest_transition', { target: smoker.id, action: 'like' })).error?.message).toMatch(/dealbreaker/i);
    expect((await x.db.rpc('interest_transition', { target: far.id, action: 'like' })).error?.message).toMatch(/overlapping/i);
  });
  it('persists messages once, tracks unread counts and flags payment requests', async () => {
    const [x, y] = await pair('msg');
    const chat = await matched(x, y);
    const key = crypto.randomUUID();
    for (let i = 0; i < 2; i++) expect((await x.db.rpc('send_message', { c: chat, body: 'Hi there', request_key: key })).error).toBeNull();
    expect((await x.db.rpc('send_message', { c: chat, body: 'Please send the token amount by UPI first', request_key: crypto.randomUUID() })).error).toBeNull();
    const seen = await y.db.from('messages').select('id,body,suspicious').eq('conversation_id', chat).order('created_at');
    expect(seen.data!.map(m => [m.body, m.suspicious])).toEqual([['Hi there', false], ['Please send the token amount by UPI first', true]]);
    expect((await y.db.rpc('inbox')).data[0].unread).toBe(2);
    expect((await x.db.rpc('inbox')).data[0].unread).toBe(0);
    expect((await y.db.rpc('mark_read', { c: chat, last_seen: seen.data![1].id })).error).toBeNull();
    expect((await y.db.rpc('inbox')).data[0].unread).toBe(0);
    expect((await x.db.rpc('send_message', { c: chat, body: '   ', request_key: crypto.randomUUID() })).error).not.toBeNull();
  });
  it('severs chat, visibility and saved items for both people when one blocks', async () => {
    const [x, y] = await pair('blk');
    const chat = await matched(x, y);
    await x.db.rpc('send_message', { c: chat, body: 'Hello', request_key: crypto.randomUUID() });
    expect((await y.db.rpc('save_item', { kind: 'profile', target: x.id, enabled: true })).error).toBeNull();
    expect((await y.db.rpc('block_account', { target: x.id })).error).toBeNull();
    for (const m of [x, y]) {
      expect((await m.db.from('messages').select('id').eq('conversation_id', chat)).data).toEqual([]);
      expect((await m.db.rpc('inbox')).data).toEqual([]);
      expect((await m.db.rpc('send_message', { c: chat, body: 'still there?', request_key: crypto.randomUUID() })).error).not.toBeNull();
    }
    expect(((await x.db.rpc('discover_people', { city: 'gurugram' })).data as { id: string }[]).some(p => p.id === y.id)).toBe(false);
    expect((await x.db.rpc('discover_people', { city: null, candidate: y.id })).data).toEqual([]);
    expect((await x.db.rpc('interest_transition', { target: y.id, action: 'like' })).error).not.toBeNull();
    expect((await y.db.from('saved_items').select('id')).data).toEqual([]);
    expect((await x.db.from('blocks').select('*')).data).toEqual([]);
  });
});

describe('visits', () => {
  it('follow the request → confirm flow and share an address only with the other participant, only near the visit', async () => {
    const [x, y] = await pair('vis');
    const outsider = await member('vis-o');
    await onboard(outsider, { name: 'Omar' });
    const chat = await matched(x, y);
    expect((await x.db.rpc('visit_transition', { c: chat, v: null, action: 'request', at_time: soon(-1) })).error?.message).toMatch(/future/i);
    const made = await x.db.rpc('visit_transition', { c: chat, v: null, action: 'request', at_time: soon(72) });
    expect(made.error).toBeNull();
    const visit = made.data as string;
    expect((await x.db.rpc('visit_transition', { c: chat, v: null, action: 'request', at_time: soon(80) })).error?.message).toMatch(/already open/i);
    expect((await x.db.rpc('visit_transition', { c: chat, v: visit, action: 'confirm' })).error?.message).toMatch(/unavailable/i);
    expect((await x.db.rpc('visit_location', { c: chat, v: visit, location: 'Flat 4B, Tower 2' })).error?.message).toMatch(/confirmed/i);
    expect((await y.db.rpc('visit_transition', { c: chat, v: visit, action: 'reschedule', at_time: soon(6) })).error).toBeNull();
    expect((await y.db.rpc('visit_transition', { c: chat, v: visit, action: 'confirm' })).error).not.toBeNull();
    expect((await x.db.rpc('visit_transition', { c: chat, v: visit, action: 'confirm' })).error).toBeNull();
    expect((await x.db.rpc('visit_transition', { c: chat, v: visit, action: 'completed' })).error?.message).toMatch(/unavailable/i);
    expect((await x.db.rpc('visit_location', { c: chat, v: visit, location: 'Flat 4B, Tower 2, near the park' })).error).toBeNull();
    expect((await y.db.rpc('read_visit_location', { v: visit })).data).toBe('Flat 4B, Tower 2, near the park');
    expect((await outsider.db.rpc('read_visit_location', { v: visit })).data).toBeNull();
    expect((await outsider.db.from('visit_requests').select('id')).data).toEqual([]);
    expect((await y.db.rpc('visit_location', { c: chat, v: visit, location: 'Somewhere else entirely' })).error?.message).toMatch(/Only the person/i);
    // Outside the window (more than 24 hours ahead) the address is not readable yet.
    sql(`update public.visit_requests set starts_at=now()+interval '3 days' where id='${visit}'`);
    expect((await y.db.rpc('read_visit_location', { v: visit })).data).toBeNull();
    // Cancelling withdraws the address.
    expect((await y.db.rpc('visit_transition', { c: chat, v: visit, action: 'cancel' })).error).toBeNull();
    expect(sql(`select count(*) from private.visit_locations where visit_id='${visit}'`)).toBe('0');
    expect(sql(`select string_agg(status::text, ',' order by created_at) from public.visit_events where visit_id='${visit}'`)).toBe('requested,rescheduled,confirmed,cancelled');
  });
  it('records completion only after the confirmed time has passed', async () => {
    const [x, y] = await pair('done');
    const chat = await matched(x, y);
    const visit = (await x.db.rpc('visit_transition', { c: chat, v: null, action: 'request', at_time: soon(5) })).data as string;
    await y.db.rpc('visit_transition', { c: chat, v: visit, action: 'confirm' });
    sql(`update public.visit_requests set starts_at=now()-interval '1 hour' where id='${visit}'`);
    expect((await y.db.rpc('visit_transition', { c: chat, v: visit, action: 'completed' })).error).toBeNull();
    expect((await x.db.rpc('visit_transition', { c: chat, v: visit, action: 'no_show' })).error).not.toBeNull();
  });
});

describe('moderation outcomes and account closure', () => {
  it('suspends a member, locks them out, and lets them appeal', async () => {
    const [x, y] = await pair('sus');
    const chat = await matched(x, y);
    expect((await mod.db.rpc('moderate', { kind: 'profile', target: x.id, action: 'suspend', reason: 'Repeated payment requests' })).error).toBeNull();
    expect((await x.db.rpc('send_message', { c: chat, body: 'hello?', request_key: crypto.randomUUID() })).error).not.toBeNull();
    expect((await x.db.rpc('discover_people', { city: 'gurugram' })).data).toEqual([]);
    expect((await y.db.rpc('inbox')).data).toEqual([]);
    expect((await x.db.rpc('data_request', { kind: 'support', details: 'I would like to appeal this suspension.' })).error).toBeNull();
    expect((await x.db.rpc('moderate', { kind: 'profile', target: x.id, action: 'restore', reason: 'restoring myself' })).error).not.toBeNull();
    expect((await mod.db.rpc('moderate', { kind: 'profile', target: x.id, action: 'restore', reason: 'Appeal accepted' })).error).toBeNull();
    expect(sql(`select status from public.profiles where id='${x.id}'`)).toBe('paused');
  });
  it('closes an account on request: hides the profile, removes listings and analytics', async () => {
    const [x, y] = await pair('del');
    const id = await liveListing(x, mod);
    await x.db.rpc('track_product_event', { event_name: 'discover_view' });
    expect(Number(sql(`select count(*) from public.product_events where user_id='${x.id}'`))).toBeGreaterThan(0);
    expect((await x.db.rpc('data_request', { kind: 'delete' })).error).toBeNull();
    expect(sql(`select status, discoverable from public.profiles where id='${x.id}'`)).toBe('closed|f');
    expect(sql(`select status from public.listings where id='${id}'`)).toBe('removed');
    expect(sql(`select count(*) from public.product_events where user_id='${x.id}'`)).toBe('0');
    expect((await y.db.rpc('public_rooms', { room_id: id })).data).toHaveLength(0);
    expect(((await y.db.rpc('discover_people', { city: 'gurugram' })).data as { id: string }[]).some(p => p.id === x.id)).toBe(false);
    expect((await x.db.rpc('save_basics', { v: {} })).error?.message).toMatch(/Sign in/);
    expect((await x.db.from('data_subject_requests').select('kind,status')).data).toEqual([{ kind: 'delete', status: 'pending' }]);
    expect((await mod.db.rpc('moderate', { kind: 'request', target: crypto.randomUUID(), action: 'fulfill', reason: 'not a real one' })).error).not.toBeNull();
  });
  it('records analytics events only for members who opted in', async () => {
    const m = await member('noan');
    await m.db.rpc('save_basics', { v: { name: 'Quiet', city: 'gurugram', areas: ['sector-56'], min: 1_000_000, max: 2_000_000, from: istDate(1), until: istDate(9), months: 6, intent: 'looking_for_room', adult: true, terms: true } });
    await m.db.rpc('save_lifestyle', { answers: {} });
    await m.db.rpc('save_privacy', { v: { status: 'active', discoverable: true, analytics: false, reminders: false } });
    await m.db.rpc('track_product_event', { event_name: 'discover_view' });
    expect(sql(`select count(*) from public.product_events where user_id='${m.id}'`)).toBe('0');
  });
});
