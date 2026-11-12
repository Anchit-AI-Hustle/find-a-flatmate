import Link from 'next/link';
import { Price } from '@/components/costs';
import { Avatar, PersonFacts, SaveButton } from '@/components/people';
import { RoomFacts } from '@/components/rooms';
import { Art } from '@/components/site';
import { expandedListing, me, type Candidate, type Listing } from '@/lib/db';

export const metadata = { title: 'Saved' };
export default async function Saved() {
  const { db, user } = await me();
  const { data } = await db.from('saved_items').select('profile_id,listing_id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(60);
  const items = (data ?? []) as { profile_id: string | null; listing_id: string | null }[];
  const listingIds = items.flatMap(i => (i.listing_id ? [i.listing_id] : []));
  const [people, rooms] = await Promise.all([
    Promise.all(items.flatMap(i => (i.profile_id ? [db.rpc('discover_people', { city: null, candidate: i.profile_id }).then(r => ((r.data ?? []) as Candidate[])[0])] : []))),
    listingIds.length ? db.from('listings').select(expandedListing).in('id', listingIds).overrideTypes<Listing[], { merge: false }>().then(r => r.data ?? []) : Promise.resolve([] as Listing[]),
  ]);
  const shownPeople = people.filter(Boolean) as Candidate[];
  return (
    <>
      <div className="page-title"><h1>Saved</h1></div>
      {!shownPeople.length && !rooms.length ? (
        <div className="card empty">
          <Art name="costs" width={760} height={779} />
          <h2>Nothing saved yet</h2>
          <p className="muted">Save a person or a room to compare later. Saved items stay here across devices. If a listing closes or someone blocks you, it disappears from this list.</p>
          <Link className="btn primary" href="/app/discover">Go to Discover</Link>
        </div>
      ) : null}
      {rooms.length ? (
        <section className="stack" aria-labelledby="rooms"><h2 id="rooms">Rooms</h2>
          <div className="grid two">{rooms.map(l => (
            <article key={l.id} className="card result">
              <h3><Link href={`/app/rooms/${l.id}`}>{l.title}</Link></h3><RoomFacts room={l} /><Price costs={l} />
              <SaveButton kind="listing" target={l.id} saved />
            </article>
          ))}</div>
        </section>
      ) : null}
      {shownPeople.length ? (
        <section className="stack section" aria-labelledby="people"><h2 id="people">People</h2>
          <div className="grid two">{shownPeople.map(c => (
            <article key={c.id} className="card result">
              <div className="head"><Avatar name={c.display_name} id={c.id} /><h3><Link href={`/app/people/${c.id}`}>{c.display_name}</Link></h3></div>
              <PersonFacts c={c} /><SaveButton kind="profile" target={c.id} saved />
            </article>
          ))}</div>
        </section>
      ) : null}
    </>
  );
}
