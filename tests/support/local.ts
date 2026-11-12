import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Test helpers for the LOCAL Supabase stack only (`supabase start`). They refuse to run against any remote project. */
function load(): Record<string, string> {
  const file = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
  const parsed = Object.fromEntries(file.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
  return { ...parsed, ...(process.env as Record<string, string>) };
}
const e = load();
export const url = e.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const publishable = e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const secret = e.SUPABASE_SERVICE_ROLE_KEY ?? '';
export const dbUrl = e.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
export const mailUrl = e.MAILPIT_URL ?? 'http://127.0.0.1:54324';
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) throw new Error('These tests create and delete users. They only run against a local Supabase stack (see README).');

const options = { auth: { persistSession: false, autoRefreshToken: false } };
export const service = createClient(url, secret, options);
export const anon = () => createClient(url, publishable, options);
export function sql(query: string): string {
  return execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-Atc', query], { encoding: 'utf8' }).trim();
}
export type Member = { id: string; email: string; db: SupabaseClient };
/** A confirmed-email member with their own RLS-scoped client. */
export async function member(label: string): Promise<Member> {
  const email = `${label}-${randomUUID().slice(0, 8)}@example.test`;
  const password = randomUUID();
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  const db = anon();
  const signIn = await db.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(signIn.error.message);
  return { id: data.user.id, email, db };
}
export const istDate = (offsetDays = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + offsetDays * 864e5));
export const basics = (over: Record<string, unknown> = {}) => ({ name: 'Tester', city: 'gurugram', areas: ['sector-56'], min: 1_000_000, max: 2_500_000, from: istDate(1), until: istDate(40), months: 11, intent: 'looking_for_room', adult: true, terms: true, ...over });
export const quiet = { sleep: { habit: 'Early nights', want: 'Early nights', strength: 'preference' }, smoking: { habit: 'No shared-space smoking', want: 'No shared-space smoking', strength: 'dealbreaker' } };
export async function onboard(m: Member, over: Record<string, unknown> = {}, answers: Record<string, unknown> = quiet) {
  for (const [fn, args] of [['save_basics', { v: basics(over) }], ['save_lifestyle', { answers }], ['save_privacy', { v: { status: 'active', discoverable: true, analytics: true, reminders: false } }]] as const) {
    const { error } = await m.db.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
  }
}
export const listing = (over: Record<string, unknown> = {}) => ({
  title: `Bright room ${randomUUID().slice(0, 6)}`, description: 'Quiet flat with two working professionals and a balcony.', city_id: 'gurugram', locality_id: 'sector-56', room_type: 'private_room',
  building: 'Society apartment', furnishing: 'Furnished', bath_sharing: 'Shared', rooms: 3, bathrooms: 2, occupants: 2, capacity: 3, poster_type: 'Occupant', attested: true, transport: '', restrictions: '',
  rent: 1_500_000, maintenance: 200_000, utilities: null, recurring: 0, deposit: 3_000_000, brokerage: 0, fees: 0, available_from: istDate(2), available_until: istDate(45), min_months: 6, amenities: ['Wi-Fi'], rules: quiet, ...over,
});
const tinyWebp = Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=', 'base64');
/** Creates a listing and, like the upload handler, attaches one stored photo through the service-only RPC. */
export async function draftWithPhoto(owner: Member, over: Record<string, unknown> = {}): Promise<string> {
  const { data: id, error } = await owner.db.rpc('save_listing', { l: null, v: listing(over) });
  if (error) throw new Error(`save_listing: ${error.message}`);
  const path = `${owner.id}/${id}/${randomUUID()}.webp`;
  const up = await service.storage.from('room-photos').upload(path, tinyWebp, { contentType: 'image/webp' });
  if (up.error) throw new Error(`upload: ${up.error.message}`);
  const attach = await service.rpc('attach_sanitized_photo', { u: owner.id, l: id, p: path, d: 'a'.repeat(64) });
  if (attach.error) throw new Error(`attach: ${attach.error.message}`);
  return id as string;
}
export async function liveListing(owner: Member, moderator: Member, over: Record<string, unknown> = {}): Promise<string> {
  const id = await draftWithPhoto(owner, over);
  let r = await owner.db.rpc('listing_transition', { l: id, action: 'submit' });
  if (r.error) throw new Error(`submit: ${r.error.message}`);
  r = await moderator.db.rpc('moderate', { kind: 'listing', target: id, action: 'approve', reason: 'Looks genuine' });
  if (r.error) throw new Error(`approve: ${r.error.message}`);
  return id;
}
export async function moderator(): Promise<Member> {
  const m = await member('mod');
  sql(`insert into private.moderators(user_id) values ('${m.id}')`);
  return m;
}
/** Two active members with a mutual match; returns the conversation id. */
export async function matched(a: Member, b: Member): Promise<string> {
  const first = await a.db.rpc('interest_transition', { target: b.id, action: 'like' });
  if (first.error) throw new Error(first.error.message);
  const second = await b.db.rpc('interest_transition', { target: a.id, action: 'like' });
  if (second.error || !second.data) throw new Error(`no match: ${second.error?.message}`);
  return second.data as string;
}
