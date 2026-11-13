import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { action } from '@/lib/actions';
import { expandedListing, person, room, session, profile, type Candidate, type Listing, type Message } from '@/lib/db';
import { matchPeople, matchRoom, type Answers } from '@/lib/matching';
import { cities, dimensions, amenities, intents, titles } from '@/lib/catalog';
import { demoResults } from '@/lib/demo';

const headers = { 'Cache-Control': 'private, no-store' };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
const member = async (request: Request) => request.headers.get('authorization')?.startsWith('Bearer ') ? session() : null;
export async function GET(request: Request) {
  const signedIn = await member(request);
  if (new URL(request.url).searchParams.get('view') === 'samples') return json(demoResults(new URL(request.url).searchParams.get('city') === 'noida' ? 'noida' : 'gurugram'));
  if (!signedIn) return json({ error: 'Sign in to continue.' }, 401);
  const { db, user } = signedIn;
  const p = await profile();
  const q = new URL(request.url).searchParams;
  const view = q.get('view') || 'home';
  const { data: a } = p ? await db.rpc('own_answers') : { data: null };
  const answers = (a ?? {}) as Answers;
  if (view === 'home') {
    const [{ data: consent }, { data: reminders }] = await Promise.all([
      db.from('user_consents').select('granted').eq('user_id',user.id).eq('purpose','analytics').maybeSingle(),
      db.from('notification_preferences').select('reminders').eq('user_id',user.id).maybeSingle(),
    ]);
    return json({ id: user.id, profile: p, answers, cities, dimensions, amenities, intents, titles,
      analytics: consent?.granted ?? false, reminders: reminders?.reminders ?? false });
  }
  if (!p || p.status !== 'active') return json({ error: 'Complete or resume your profile.' }, 403);
  const self = person(p, answers);
  const id = z.uuid().safeParse(q.get('id')).data;
  switch (view) {
    case 'people': {
      const { data, error } = await db.rpc('discover_people', { city: p.city_id });
      if (error) return json({ error: 'People could not load.' }, 503);
      return json({ items: ((data ?? []) as Candidate[]).map(c => ({
        id: c.id, title: c.display_name, city: c.city_id, areas: c.localities,
        budgetMin: c.budget_min, budgetMax: c.budget_max, from: c.move_from, until: c.move_until,
        verified: c.email_verified, fit: matchPeople(self, person(c,c.answers)),
      })).filter(c => !c.fit.hard_fail_reasons.length).sort((a,b) => (b.fit.score ?? -1) - (a.fit.score ?? -1)).slice(0,40) });
    }
    case 'rooms':
    case 'listings': {
      const mine = view === 'listings';
      let query = db.from('listings').select(expandedListing);
      query = mine ? query.eq('owner_id', user.id) : query.eq('status','active').eq('city_id',p.city_id).neq('owner_id',user.id).gt('expires_at', new Date().toISOString());
      if (id) query = query.eq('id', id);
      const { data, error } = await query.order('created_at',{ascending:false}).limit(40);
      if (error) return json({ error: 'Rooms could not load.' },503);
      return json({ items: ((data ?? []) as Listing[]).map(l => ({
        ...l, listing_images: l.listing_images?.map(({ id }) => ({ id })), fit: mine ? null : matchRoom(self,room(l)),
      })).filter(l => !l.fit?.hard_fail_reasons.length) });
    }
    case 'messages': {
      const { data, error } = await db.rpc('inbox');
      return error ? json({ error: 'Messages could not load.' },503) : json({ items: data });
    }
    case 'thread': {
      if (!id) return json({ error: 'Conversation unavailable.' },404);
      const { data: allowed } = await db.from('conversations').select('id').eq('id',id).maybeSingle();
      if (!allowed) return json({ error: 'Conversation unavailable.' },404);
      const { data, error } = await db.from('messages').select('id,sender_id,body,suspicious,created_at').eq('conversation_id',id).order('created_at',{ascending:false}).limit(100);
      if (error) return json({ error: 'Messages could not load.' },503);
      const messages = ((data ?? []) as Message[]).reverse();
      if (messages.at(-1)) await db.rpc('mark_read',{c:id,last_seen:messages.at(-1)!.id});
      return json({ items: messages, member: user.id });
    }
    case 'visits': {
      const { data, error } = await db.from('visit_requests').select('*').order('starts_at',{ascending:false}).limit(40);
      if (error) return json({ error: 'Visits could not load.' },503);
      return json({ items: await Promise.all((data ?? []).map(async v => ({
        ...v, actions: [
          ...(['requested','rescheduled'].includes(v.status) && v.proposer_id !== user.id ? ['confirm','decline'] : []),
          ...(['requested','rescheduled','confirmed'].includes(v.status) ? ['cancel'] : []),
          ...(v.status === 'confirmed' && Date.parse(v.starts_at) <= Date.now() ? ['completed','no_show'] : []),
        ], location: v.status === 'confirmed' ? (await db.rpc('read_visit_location',{v:v.id})).data : null,
      }))), member: user.id });
    }
    case 'saved': {
      const { data, error } = await db.from('saved_items').select('profile_id,listing_id').eq('user_id',user.id).limit(40);
      if (error) return json({ error:'Saved items could not load.' },503);
      const items = await Promise.all((data ?? []).map(async row => {
        if (row.listing_id) {
          const { data: listing } = await db.from('listings').select('id,title').eq('id',row.listing_id).maybeSingle();
          return listing ? { ...listing, kind: 'listing' } : null;
        }
        const { data: people } = await db.rpc('discover_people',{city:null,candidate:row.profile_id});
        const p = (people as Candidate[]|null)?.[0];
        return p ? { id:p.id,title:p.display_name,kind:'profile' } : null;
      }));
      return json({ items: items.filter(Boolean) });
    }
    case 'connections': {
      const { data, error } = await db.from('interests').select('actor_id,target_id,status').eq('target_id',user.id).eq('status','sent').limit(40);
      if (error) return json({ error:'Connections could not load.' },503);
      const items = await Promise.all((data ?? []).map(async row => {
        const { data: people } = await db.rpc('discover_people',{city:null,candidate:row.actor_id});
        const p = (people as Candidate[]|null)?.[0];
        return p ? { id:p.id,title:p.display_name } : null;
      }));
      return json({ items:items.filter(Boolean) });
    }
    default: return json({ error:'Unknown view.' },404);
  }
}

const operations = ['basics','lifestyle','privacy','interest','save','block','report','message','visit','location','listing','listingState','upload','removePhoto','request','waitlist','feedback','found'] as const;
export async function POST(request: Request) {
  if (!await member(request)) return json({ error: 'Sign in to continue.' },401);
  const op = z.enum(operations).safeParse(new URL(request.url).searchParams.get('op'));
  if (!op.success) return json({ error: 'Unknown operation.' },400);
  if (Number(request.headers.get('content-length') ?? 0) > 3_000_000) return json({ error:'File is too large.' },413);
  const form = await request.formData().catch(() => null);
  if (!form) return json({ error:'Invalid form.' },400);
  if (op.data === 'interest') form.set('stay','yes');
  if (op.data === 'message' && !form.has('request_key')) form.set('request_key',randomUUID());
  const result = await action(op.data, {}, form, 'mobile');
  return json(result, result.error ? 400 : 200);
}
