import { beforeAll, describe, expect, it } from 'vitest';
import { basics, istDate, liveListing, matched, member, moderator, onboard, sql, type Member } from '../support/local';

/** Regression tests for the defects fixed in 20261112160000_hardening.sql. */
let mod: Member;
beforeAll(async () => { mod = await moderator(); });
const active = async (label: string, over: Record<string, unknown> = {}, answers?: Record<string, unknown>) => {
  const m = await member(label);
  await onboard(m, { name: label.replace(/[^a-z]/gi, '') || 'Member', ...over }, answers);
  return m;
};

describe('interest rules', () => {
  it('does not let anyone send interest to a hidden profile by id', async () => {
    const [x, hidden] = await Promise.all([active('hx'), active('hidden')]);
    expect((await hidden.db.rpc('save_privacy', { v: { status: 'active', discoverable: false, analytics: false, reminders: false } })).error).toBeNull();
    expect((await x.db.rpc('interest_transition', { target: hidden.id, action: 'like' })).error?.message).toMatch(/Candidate unavailable/);
    // The hidden member can still reach out themselves, and the other person can then accept.
    expect((await hidden.db.rpc('interest_transition', { target: x.id, action: 'like' })).error).toBeNull();
    expect((await x.db.rpc('interest_transition', { target: hidden.id, action: 'like' })).data).toBeTruthy();
  });
  it('cannot use a made-up or unrelated listing id to skip the dealbreaker check', async () => {
    const [x, smoker, owner] = await Promise.all([
      active('lx'), active('ls', {}, { smoking: { habit: 'Shared-space smoking', want: 'Shared-space smoking', strength: 'flexible' } }), active('lo', { intent: 'have_room' }),
    ]);
    const other = await liveListing(owner, mod);
    for (const listing of [crypto.randomUUID(), other]) {
      expect((await x.db.rpc('interest_transition', { target: smoker.id, action: 'like', listing })).error?.message).toMatch(/Listing unavailable/);
    }
    expect((await x.db.rpc('interest_transition', { target: smoker.id, action: 'like' })).error?.message).toMatch(/dealbreaker/i);
  });
  it('refuses interest in a room that is over budget even when the two profiles overlap', async () => {
    const [seeker, owner] = await Promise.all([active('bs', { max: 2_000_000 }), active('bo', { intent: 'have_room' })]);
    const pricey = await liveListing(owner, mod, { rent: 3_000_000 });
    expect((await seeker.db.rpc('interest_transition', { target: owner.id, action: 'like', listing: pricey })).error?.message).toMatch(/does not fit/);
  });
  it('enforces a household dealbreaker against the seeker’s habit', async () => {
    const [seeker, owner] = await Promise.all([active('ps', {}, { pets: { habit: 'Pets welcome', strength: 'flexible' } }), active('po', { intent: 'have_room' })]);
    const home = await liveListing(owner, mod, { rules: { pets: { habit: 'No pets', want: 'No pets', strength: 'dealbreaker' } } });
    expect((await seeker.db.rpc('interest_transition', { target: owner.id, action: 'like', listing: home })).error?.message).toMatch(/household rule/i);
  });
});

describe('discovery scope', () => {
  it('only ever lists people in the caller’s own city', async () => {
    const [g, n] = await Promise.all([active('cg'), active('cn', { city: 'noida', areas: ['sector-62'] })]);
    const seen = (await g.db.rpc('discover_people', { city: 'noida' })).data as { id: string; city_id: string }[];
    expect(seen.every(p => p.city_id === 'gurugram')).toBe(true);
    expect(seen.some(p => p.id === n.id)).toBe(false);
  });
});

describe('reports after contact is cut', () => {
  it('still accepts a report about a message or person after a block', async () => {
    const [x, y] = await Promise.all([active('rx'), active('ry')]);
    const chat = await matched(x, y);
    await x.db.rpc('send_message', { c: chat, body: 'Send your Aadhaar and OTP now', request_key: crypto.randomUUID() });
    const id = sql(`select id from public.messages where conversation_id='${chat}'`);
    expect(sql(`select suspicious from public.messages where id='${id}'`)).toBe('t');
    expect((await x.db.rpc('block_account', { target: y.id })).error).toBeNull();
    expect((await y.db.rpc('file_report', { subject: null, listing: null, message: id, category: 'scam', details: 'Demanded ID details then blocked me.' })).error).toBeNull();
    expect((await y.db.rpc('file_report', { subject: x.id, listing: null, message: null, category: 'harassment', details: 'Reporting the person as well.' })).error).toBeNull();
    const stranger = await active('rs');
    expect((await stranger.db.rpc('file_report', { subject: null, listing: null, message: id, category: 'other', details: 'I should not be able to do this.' })).error?.message).toMatch(/unavailable/);
  });
  it('does not flag ordinary words that merely contain a keyword', async () => {
    const [x, y] = await Promise.all([active('wx'), active('wy')]);
    const chat = await matched(x, y);
    await x.db.rpc('send_message', { c: chat, body: 'The second room is occupied until the group moves out.', request_key: crypto.randomUUID() });
    expect(sql(`select suspicious from public.messages where conversation_id='${chat}'`)).toBe('f');
  });
});

describe('blocking and visits', () => {
  it('cancels an open visit and deletes the shared address', async () => {
    const [x, y] = await Promise.all([active('vx'), active('vy')]);
    const chat = await matched(x, y);
    const visit = (await x.db.rpc('visit_transition', { c: chat, v: null, action: 'request', at_time: new Date(Date.now() + 6 * 36e5).toISOString() })).data as string;
    await y.db.rpc('visit_transition', { c: chat, v: visit, action: 'confirm' });
    expect((await x.db.rpc('visit_location', { c: chat, v: visit, location: 'Flat 9, Block C' })).error).toBeNull();
    expect((await y.db.rpc('block_account', { target: x.id })).error).toBeNull();
    expect(sql(`select status from public.visit_requests where id='${visit}'`)).toBe('cancelled');
    expect(sql(`select count(*) from private.visit_locations where visit_id='${visit}'`)).toBe('0');
  });
});

describe('moderation fixes', () => {
  it('lets a moderator mark a support request handled, but not a deletion', async () => {
    const x = await active('mx');
    await x.db.rpc('data_request', { kind: 'support', details: 'Please help me change my email.' });
    const id = sql(`select id from public.data_subject_requests where user_id='${x.id}' and kind='support'`);
    expect((await mod.db.rpc('moderate', { kind: 'request', target: id, action: 'fulfill', reason: 'Answered by email' })).error).toBeNull();
    expect(sql(`select status from public.data_subject_requests where id='${id}'`)).toBe('fulfilled');
    await x.db.rpc('data_request', { kind: 'delete' });
    const del = sql(`select id from public.data_subject_requests where user_id='${x.id}' and kind='delete'`);
    expect((await mod.db.rpc('moderate', { kind: 'request', target: del, action: 'fulfill', reason: 'Trying to tick it off' })).error?.message).toMatch(/Only export or support/);
  });
  it('makes a moderator expiry stick until the listing is reviewed again', async () => {
    const owner = await active('eo', { intent: 'have_room' });
    const id = await liveListing(owner, mod);
    expect((await mod.db.rpc('moderate', { kind: 'listing', target: id, action: 'expire', reason: 'Reported as no longer available' })).error).toBeNull();
    expect((await owner.db.rpc('listing_transition', { l: id, action: 'renew' })).error).not.toBeNull();
    expect(sql(`select status from public.listings where id='${id}'`)).toBe('expired');
  });
  it('gives a full freshness window from the moment of approval', async () => {
    const owner = await active('fo', { intent: 'have_room' });
    const id = await liveListing(owner, mod, { available_until: istDate(120) });
    expect(sql(`select expires_at > now() + interval '20 days' from public.listings where id='${id}'`)).toBe('t');
  });
});

describe('onboarding order', () => {
  it('cannot activate a profile before the lifestyle step is saved or skipped', async () => {
    const m = await member('skip');
    expect((await m.db.rpc('save_basics', { v: basics({ name: 'Skipper' }) })).error).toBeNull();
    expect((await m.db.rpc('save_privacy', { v: { status: 'active', discoverable: true, analytics: false, reminders: false } })).error?.message).toMatch(/lifestyle/i);
    expect((await m.db.rpc('save_lifestyle', { answers: {} })).error).toBeNull();
    expect((await m.db.rpc('save_privacy', { v: { status: 'active', discoverable: true, analytics: false, reminders: false } })).error).toBeNull();
  });
});
