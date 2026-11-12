import { beforeAll, describe, expect, it } from 'vitest';
import { anon, draftWithPhoto, liveListing, matched, member, moderator, onboard, service, sql, type Member } from '../support/local';

/** Row-level security and RPC authorisation, exercised through the same API the browser can reach. */
let a: Member, b: Member, c: Member, mod: Member;
let room: string, chat: string;
beforeAll(async () => {
  [a, b, c, mod] = await Promise.all([member('asha'), member('ravi'), member('mallory'), moderator()]);
  await Promise.all([onboard(a, { name: 'Asha', intent: 'have_room' }), onboard(b, { name: 'Ravi' }), onboard(c, { name: 'Mallory' })]);
  room = await liveListing(a, mod);
  chat = await matched(a, b);
  const sent = await a.db.rpc('send_message', { c: chat, body: 'Hello Ravi, the room is free from next week.', request_key: crypto.randomUUID() });
  expect(sent.error).toBeNull();
});

describe('signed-out visitors', () => {
  it('cannot read any private table', async () => {
    const db = anon();
    for (const table of ['profiles', 'listings', 'messages', 'interests', 'reports', 'listing_images', 'admin_audit_logs', 'user_preference_answers', 'visit_requests']) {
      const { data, error } = await db.from(table).select('*').limit(1);
      expect(error ?? data, table).toSatisfy(v => (Array.isArray(v) ? v.length === 0 : true));
    }
  });
  it('see only safe listing fields through public_rooms', async () => {
    const { data, error } = await anon().rpc('public_rooms', { room_id: room });
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(Object.keys(data[0]).sort()).toEqual(['available_from', 'available_until', 'brokerage', 'city_id', 'confirmed_at', 'deposit', 'fees', 'id', 'locality_id', 'maintenance', 'recurring', 'rent', 'reviewed_at', 'room_type', 'title', 'utilities']);
    expect(data[0]).not.toHaveProperty('owner_id');
  });
  it('cannot call member RPCs or list stored photos', async () => {
    const db = anon();
    expect((await db.rpc('discover_people', { city: 'gurugram' })).error).not.toBeNull();
    expect((await db.rpc('inbox')).error).not.toBeNull();
    expect((await db.storage.from('room-photos').list(a.id)).data ?? []).toHaveLength(0);
  });
});

describe('members and other people’s data', () => {
  it('cannot read another member’s profile row, answers or consents', async () => {
    expect((await c.db.from('profiles').select('*').eq('id', a.id)).data).toEqual([]);
    expect((await c.db.from('user_preference_answers').select('*').eq('user_id', a.id)).data).toEqual([]);
    expect((await c.db.from('user_consents').select('*').eq('user_id', a.id)).data).toEqual([]);
    expect((await c.db.from('profiles').select('id')).data).toEqual([{ id: c.id }]);
  });
  it('cannot write to business tables directly', async () => {
    const attempts = await Promise.all([
      c.db.from('profiles').update({ status: 'active', display_name: 'Hacked' }).eq('id', a.id),
      c.db.from('profiles').update({ display_name: 'Self edit' }).eq('id', c.id),
      c.db.from('listings').update({ status: 'active' }).eq('id', room),
      c.db.from('verification_checks').insert({ user_id: c.id, kind: 'email', verified_at: new Date().toISOString() }),
      c.db.from('matches').insert({ member_a: a.id, member_b: c.id }),
      c.db.from('user_consents').insert({ user_id: a.id, purpose: 'analytics', granted: true, revision: 'x' }),
      c.db.from('messages').insert({ conversation_id: chat, sender_id: c.id, body: 'hi', request_key: crypto.randomUUID() }),
      c.db.from('visit_events').insert({ visit_id: crypto.randomUUID(), status: 'completed' }),
      c.db.from('moderation_actions').insert({ target_type: 'listing', target_id: room, action: 'approve', reason: 'self' }),
    ]);
    for (const r of attempts) expect(r.error, JSON.stringify(r)).not.toBeNull();
    expect(sql(`select display_name from public.profiles where id='${a.id}'`)).toBe('Asha');
  });
  it('cannot edit or transition another member’s listing', async () => {
    expect((await c.db.rpc('listing_transition', { l: room, action: 'fill' })).error?.message).toMatch(/unavailable/i);
    const draft = await draftWithPhoto(a);
    expect((await c.db.from('listings').select('id').eq('id', draft)).data).toEqual([]);
    expect((await c.db.from('listing_images').select('id').eq('listing_id', draft)).data).toEqual([]);
  });
  it('cannot read or join a conversation they are not part of', async () => {
    expect((await c.db.from('messages').select('*').eq('conversation_id', chat)).data).toEqual([]);
    expect((await c.db.from('conversations').select('*')).data).toEqual([]);
    expect((await c.db.rpc('send_message', { c: chat, body: 'let me in', request_key: crypto.randomUUID() })).error).not.toBeNull();
    expect((await c.db.rpc('visit_transition', { c: chat, v: null, action: 'request', at_time: new Date(Date.now() + 864e5).toISOString() })).error).not.toBeNull();
    expect((await b.db.from('messages').select('body').eq('conversation_id', chat)).data).toHaveLength(1);
  });
  it('cannot read stored photos directly, even as the owner', async () => {
    expect((await c.db.storage.from('room-photos').list(a.id)).data ?? []).toHaveLength(0);
    expect((await a.db.storage.from('room-photos').list(a.id)).data ?? []).toHaveLength(0);
    expect((await c.db.rpc('attach_sanitized_photo', { u: c.id, l: room, p: 'x', d: 'y' })).error).not.toBeNull();
  });
});

describe('moderation privileges', () => {
  it('are refused to ordinary members', async () => {
    expect((await c.db.rpc('is_moderator')).data).toBe(false);
    expect((await c.db.rpc('moderate', { kind: 'listing', target: room, action: 'remove', reason: 'I do not like it' })).error?.message).toMatch(/moderator/i);
    expect((await c.db.rpc('moderate', { kind: 'profile', target: a.id, action: 'suspend', reason: 'because I can' })).error).not.toBeNull();
    expect((await c.db.rpc('moderation_profiles')).data).toEqual([]);
    expect((await c.db.rpc('review_reported_message', { report_id: crypto.randomUUID(), justification: 'curious about this chat' })).error).not.toBeNull();
    for (const table of ['admin_audit_logs', 'moderation_actions', 'product_events']) expect((await c.db.from(table).select('*')).data, table).toEqual([]);
    expect((await c.db.rpc('expire_rooms')).error).not.toBeNull();
  });
  it('are audited when a moderator acts', async () => {
    const before = Number(sql('select count(*) from public.admin_audit_logs'));
    const draft = await draftWithPhoto(c);
    expect((await c.db.rpc('listing_transition', { l: draft, action: 'submit' })).error).toBeNull();
    expect((await mod.db.rpc('moderate', { kind: 'listing', target: draft, action: 'reject', reason: 'Photo is unclear' })).error).toBeNull();
    expect(Number(sql('select count(*) from public.admin_audit_logs'))).toBe(before + 1);
    expect(sql(`select status from public.listings where id='${draft}'`)).toBe('draft');
  });
  it('do not let a moderator approve their own listing or browse chats', async () => {
    await onboard(mod, { name: 'Mod' });
    const own = await draftWithPhoto(mod);
    await mod.db.rpc('listing_transition', { l: own, action: 'submit' });
    expect((await mod.db.rpc('moderate', { kind: 'listing', target: own, action: 'approve', reason: 'approving myself' })).error?.message).toMatch(/independent/i);
    expect((await mod.db.from('messages').select('*')).data).toEqual([]);
  });
});

describe('reports and evidence', () => {
  it('let a moderator read only the reported message, with a logged justification', async () => {
    const { data: messages } = await b.db.from('messages').select('id').eq('conversation_id', chat);
    const filed = await b.db.rpc('file_report', { subject: null, listing: null, message: messages![0].id, category: 'scam', details: 'Asked me for an advance.' });
    expect(filed.error).toBeNull();
    const report = filed.data as string;
    expect((await c.db.from('reports').select('*')).data).toEqual([]);
    expect((await mod.db.rpc('review_reported_message', { report_id: report, justification: 'Checking the reported text' })).error?.message).toMatch(/investigation/i);
    expect((await mod.db.rpc('moderate', { kind: 'report', target: report, action: 'resolved', reason: 'skipping steps' })).error?.message).toMatch(/Invalid report transition/);
    expect((await mod.db.rpc('moderate', { kind: 'report', target: report, action: 'investigating', reason: 'Taking a look' })).error).toBeNull();
    const read = await mod.db.rpc('review_reported_message', { report_id: report, justification: 'Checking the reported text' });
    expect(read.data).toContain('Hello Ravi');
    expect(sql(`select count(*) from public.admin_audit_logs where action='report.read_reported_message' and target_id='${report}'`)).toBe('1');
  });
});

describe('service role boundary', () => {
  it('is the only role that can attach photos, and validates the path', async () => {
    const r = await service.rpc('attach_sanitized_photo', { u: a.id, l: room, p: `${c.id}/${room}/${crypto.randomUUID()}.webp`, d: 'b'.repeat(64) });
    expect(r.error?.message).toMatch(/Invalid photo/);
  });
});
