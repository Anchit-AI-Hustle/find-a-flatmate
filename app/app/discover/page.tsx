import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import { Fit, Score } from '@/components/fit';
import { ActionForm } from '@/components/form';
import { Avatar, InterestActions, PersonFacts, SaveButton, relate } from '@/components/people';
import { RoomCard } from '@/components/room-card';
import { Art } from '@/components/site';
import { amenities, cities, intents, roomTypes, type City } from '@/lib/catalog';
import { expandedListing, me, person, room, type Candidate, type Interest, type Listing } from '@/lib/db';
import { matchPeople, matchRoom } from '@/lib/matching';

export const metadata = { title: 'Discover' };
type Search = { mode?: string; area?: string; max?: string; type?: string; intent?: string; amenity?: string; sort?: string; all?: string };
const rank = <T extends { result: { score: number | null; hard_fail_reasons: string[] } }>(a: T, b: T) =>
  Number(a.result.hard_fail_reasons.length > 0) - Number(b.result.hard_fail_reasons.length > 0) || (b.result.score ?? -1) - (a.result.score ?? -1);

export default async function Discover({ searchParams }: { searchParams: Promise<Search> }) {
  const q = await searchParams;
  const { db, user, profile, person: self } = await me();
  const rooms = q.mode === 'rooms';
  const city = profile.city_id as City;
  const areas = cities[city]?.areas ?? {};
  const max = q.max && /^\d{1,6}$/.test(q.max) ? Number(q.max) * 100 : null;
  const [interestRows, savedRows] = await Promise.all([
    db.from('interests').select('actor_id,target_id,status'),
    db.from('saved_items').select('profile_id,listing_id').eq('user_id', user.id),
  ]);
  const interests = (interestRows.data ?? []) as Interest[];
  const saved = (savedRows.data ?? []) as { profile_id: string | null; listing_id: string | null }[];
  void db.rpc('track_product_event', { event_name: 'discover_view' }).then(() => {}, () => {});

  let cards: React.ReactNode[] = [];
  let hidden = 0;
  let total = 0;
  if (rooms) {
    let query = db.from('listings').select(expandedListing).eq('status', 'active').eq('city_id', city).neq('owner_id', user.id).gt('expires_at', new Date().toISOString());
    if (q.area && Object.hasOwn(areas, q.area)) query = query.eq('locality_id', q.area);
    if (q.type && Object.hasOwn(roomTypes, q.type)) query = query.eq('room_type', q.type);
    if (max !== null) query = query.lte('monthly', max);
    query = q.sort === 'new' ? query.order('created_at', { ascending: false }) : query.order('available_from');
    const { data } = await query.limit(60).overrideTypes<Listing[], { merge: false }>();
    let list = (data ?? []).map(l => ({ l, result: matchRoom(self, room(l)) }));
    if (q.amenity && (amenities as readonly string[]).includes(q.amenity)) list = list.filter(x => x.l.listing_amenities?.some(a => a.amenity === q.amenity));
    total = list.length;
    if (!q.sort || q.sort === 'fit') list.sort(rank);
    if (!q.all) { hidden = list.filter(x => x.result.hard_fail_reasons.length).length; list = list.filter(x => !x.result.hard_fail_reasons.length); }
    cards = list.map(({ l, result }) => <RoomCard key={l.id} listing={l} result={result} relation={relate(interests, user.id, l.owner_id)} saved={saved.some(s => s.listing_id === l.id)} />);
  } else {
    const { data } = await db.rpc('discover_people', { city });
    let list = ((data ?? []) as Candidate[]).map(c => ({ c, result: matchPeople(self, person(c, c.answers)) }));
    if (q.area && Object.hasOwn(areas, q.area)) list = list.filter(x => x.c.localities.includes(q.area!));
    if (q.intent && Object.hasOwn(intents, q.intent)) list = list.filter(x => x.c.intent === q.intent);
    if (max !== null) list = list.filter(x => x.c.budget_min <= max);
    total = list.length;
    if (!q.sort || q.sort === 'fit') list.sort(rank);
    if (!q.all) { hidden = list.filter(x => x.result.hard_fail_reasons.length).length; list = list.filter(x => !x.result.hard_fail_reasons.length); }
    cards = list.map(({ c, result }) => (
      <article key={c.id} className="card result">
        <div className="head">
          <Avatar name={c.display_name} id={c.id} />
          <div style={{ minWidth: 0 }}><h3><Link href={`/app/people/${c.id}`}>{c.display_name}</Link></h3><span className="small muted">Plans to stay about {c.stay_months} months</span></div>
          <Score result={result} />
        </div>
        <PersonFacts c={c} />
        <Fit result={result} />
        <div className="row between">
          <InterestActions target={c.id} relation={relate(interests, user.id, c.id)} />
          <SaveButton kind="profile" target={c.id} saved={saved.some(s => s.profile_id === c.id)} />
        </div>
      </article>
    ));
  }
  const params = (extra: Record<string, string>) => '?' + new URLSearchParams({ ...Object.fromEntries(Object.entries(q).filter(([, v]) => v)), ...extra }).toString();
  const filtered = Boolean(q.area || q.max || q.type || q.intent || q.amenity);
  return (
    <>
      <div className="page-title"><h1>Discover</h1><span className="chip plain">{cities[city]?.name}</span></div>
      <nav className="segmented" aria-label="What to show">
        <Link href="/app/discover" aria-current={rooms ? undefined : 'true'}>Find a person</Link>
        <Link href="/app/discover?mode=rooms" aria-current={rooms ? 'true' : undefined}>Find a room</Link>
      </nav>
      <details className="filterbox" open={filtered}>
        <summary><SlidersHorizontal size={16} aria-hidden="true" />Filter and sort</summary>
        <form method="get" className="filters">
          {rooms ? <input type="hidden" name="mode" value="rooms" /> : null}
          <div className="field"><label htmlFor="f-area">Locality</label>
            <select id="f-area" name="area" defaultValue={q.area ?? ''}><option value="">Any</option>{Object.entries(areas).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></div>
          <div className="field"><label htmlFor="f-max">{rooms ? 'Monthly total up to (₹)' : 'Their budget starts under (₹)'}</label>
            <input id="f-max" name="max" type="text" inputMode="numeric" pattern="\d{1,6}" defaultValue={q.max ?? ''} placeholder="Any" /></div>
          {rooms ? (
            <>
              <div className="field"><label htmlFor="f-type">Room type</label>
                <select id="f-type" name="type" defaultValue={q.type ?? ''}><option value="">Any</option>{Object.entries(roomTypes).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></div>
              <div className="field"><label htmlFor="f-amenity">Must have</label>
                <select id="f-amenity" name="amenity" defaultValue={q.amenity ?? ''}><option value="">Anything</option>{amenities.map(a => <option key={a}>{a}</option>)}</select></div>
            </>
          ) : (
            <div className="field"><label htmlFor="f-intent">They are</label>
              <select id="f-intent" name="intent" defaultValue={q.intent ?? ''}><option value="">Anyone</option><option value="looking_for_room">Looking for a room</option><option value="have_room">Offering a room</option><option value="find_together">Finding a home together</option></select></div>
          )}
          <div className="field"><label htmlFor="f-sort">Sort by</label>
            <select id="f-sort" name="sort" defaultValue={q.sort ?? 'fit'}><option value="fit">Best fit</option><option value="new">{rooms ? 'Newest' : 'Recently active'}</option>{rooms ? <option value="soon">Available soonest</option> : null}</select></div>
          <div className="field"><button className="btn small">Apply</button></div>
        </form>
      </details>
      <p className="small muted" role="status">{cards.length} shown{hidden ? <> · {hidden} hidden because budget, dates, locality or a dealbreaker don’t line up. <Link href={params({ all: '1' })}>Show them anyway</Link></> : null}</p>
      {cards.length ? <div className="grid two" style={{ marginTop: 12 }}>{cards}</div> : (
        <div className="card empty">
          <Art name="together" width={960} height={720} />
          <h2>{total ? 'Nothing meets all your basics yet' : filtered ? 'No results for these filters' : rooms ? 'No live rooms here yet' : 'No one to show yet'}</h2>
          <p className="muted">{total ? 'Some results clash on budget, dates, locality or a dealbreaker. You can view them, or relax what you’re looking for.' : 'We only show real, current people and rooms. Try other localities, a wider budget or different dates, or check the other tab.'}</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            {filtered ? <Link className="btn" href={rooms ? '/app/discover?mode=rooms' : '/app/discover'}>Clear filters</Link> : null}
            <Link className="btn" href="/onboarding/basics">Change my localities, budget or dates</Link>
            <ActionForm op="waitlist" submit="Tell me when there’s more" small className="inline-form" />
          </div>
        </div>
      )}
      {cards.length ? (
        <div className="row" style={{ marginTop: 20 }}>
          <span className="small muted">Was this ranking useful?</span>
          <ActionForm op="feedback" submit="Yes" small variant="plain" className="inline-form"><input type="hidden" name="useful" value="yes" /></ActionForm>
          <ActionForm op="feedback" submit="No" small variant="plain" className="inline-form"><input type="hidden" name="useful" value="no" /></ActionForm>
        </div>
      ) : null}
    </>
  );
}
