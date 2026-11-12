import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Receipt } from '@/components/costs';
import { Fit, Score } from '@/components/fit';
import { BlockForm, InterestActions, ReportForm, SaveButton, relate } from '@/components/people';
import { Photo } from '@/components/room-card';
import { RoomFacts } from '@/components/rooms';
import { titles } from '@/lib/catalog';
import { expandedListing, me, room, type Interest, type Listing } from '@/lib/db';
import { matchRoom } from '@/lib/matching';
import { dateText, uuid } from '@/lib/validate';

export const metadata = { title: 'Room' };
export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const id = uuid.safeParse((await params).id);
  if (!id.success) notFound();
  const { db, user, person: self } = await me();
  const { data: l } = await db.from('listings').select(expandedListing).eq('id', id.data).maybeSingle<Listing>();
  if (!l) notFound();
  const own = l.owner_id === user.id;
  const [interestRows, savedRows] = await Promise.all([
    db.from('interests').select('actor_id,target_id,status'),
    db.from('saved_items').select('id').eq('user_id', user.id).eq('listing_id', l.id),
  ]);
  const result = matchRoom(self, room(l));
  const rules = l.household_preferences ?? [];
  return (
    <div className="stack">
      <p><Link href="/app/discover?mode=rooms">← Back to rooms</Link></p>
      {l.listing_images?.length ? <div className="photo-strip">{l.listing_images.map((i, n) => <Photo key={i.id} id={i.id} alt={`Photo ${n + 1} of ${l.title}`} />)}</div> : null}
      <div className="card result">
        <div className="head"><h1 style={{ fontSize: '1.6rem', margin: 0 }}>{l.title}</h1>{own ? null : <Score result={result} />}</div>
        <RoomFacts room={l} />
        {own ? <p className="note">This is your listing ({l.status.replace('_', ' ')}). <Link href={`/app/listings/${l.id}/edit`}>Edit it</Link></p> : (
          <div className="row between">
            <InterestActions target={l.owner_id} listing={l.id} relation={relate((interestRows.data ?? []) as Interest[], user.id, l.owner_id)} />
            <SaveButton kind="listing" target={l.id} saved={Boolean(savedRows.data?.length)} />
          </div>
        )}
      </div>
      <Receipt costs={l} />
      {own ? null : <section className="card" aria-labelledby="fit"><h2 id="fit">How this home fits you</h2><Fit result={result} full /></section>}
      <section className="card prose" aria-labelledby="about">
        <h2 id="about">About the home</h2>
        <p style={{ whiteSpace: 'pre-wrap' }}>{l.description}</p>
        <div className="table-scroll"><table><tbody>
          <tr><th scope="row">Posted by</th><td>{l.poster_type === 'Owner' ? 'The owner' : 'A current occupant'} (self-declared, with permission to list)</td></tr>
          <tr><th scope="row">Building</th><td>{l.building} · {l.furnishing}</td></tr>
          <tr><th scope="row">Rooms</th><td>{l.rooms} bedroom{l.rooms === 1 ? '' : 's'}, {l.bathrooms} bathroom{l.bathrooms === 1 ? '' : 's'} · {l.bath_sharing.toLowerCase()} bathroom for this room</td></tr>
          <tr><th scope="row">People</th><td>{l.occupants} living there now · {l.capacity} when full</td></tr>
          <tr><th scope="row">Available</th><td>{dateText(l.available_from)} to {dateText(l.available_until)} · minimum stay {l.min_months} month{l.min_months === 1 ? '' : 's'}</td></tr>
          <tr><th scope="row">Amenities</th><td>{l.listing_amenities?.length ? l.listing_amenities.map(a => a.amenity).join(', ') : 'None listed'}</td></tr>
          {l.transport ? <tr><th scope="row">Getting around</th><td>{l.transport}</td></tr> : null}
          {l.restrictions ? <tr><th scope="row">Restrictions</th><td>{l.restrictions}</td></tr> : null}
          <tr><th scope="row">Freshness</th><td>{l.confirmed_at ? `Availability confirmed ${dateText(l.confirmed_at)}` : 'Not yet confirmed'}{l.expires_at ? ` · expires ${dateText(l.expires_at)} unless reconfirmed` : ''}</td></tr>
        </tbody></table></div>
      </section>
      <section className="card prose" aria-labelledby="rules">
        <h2 id="rules">House rules and habits</h2>
        {rules.length ? (
          <div className="table-scroll"><table>
            <thead><tr><th scope="col">Topic</th><th scope="col">This home</th><th scope="col">They’d like a flatmate who is</th></tr></thead>
            <tbody>{rules.map(r => <tr key={r.dimension}><th scope="row">{titles[r.dimension] ?? r.dimension}</th><td>{r.habit ?? '—'}</td><td>{r.expectation ? <>{r.expectation} {r.strength === 'dealbreaker' ? <span className="chip coral">Dealbreaker</span> : null}</> : '—'}</td></tr>)}</tbody>
          </table></div>
        ) : <p className="muted">The poster hasn’t described house rules yet. Ask in chat before you visit.</p>}
      </section>
      <p className="note warn">The exact address is shared only for a confirmed visit. Don’t pay any deposit or advance before you’ve visited and seen the rent agreement or the owner’s consent.</p>
      {own ? null : <div className="row"><ReportForm listing={l.id} label="Report this listing" /><BlockForm target={l.owner_id} /></div>}
    </div>
  );
}
