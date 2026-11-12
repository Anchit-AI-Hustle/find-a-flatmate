import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cities, type City } from '@/lib/catalog';
import { publicRooms } from '@/lib/db';
import { PublicRoomCard } from './rooms';
import { Art } from './site';

export function cityOf(id: string): City | null { return Object.hasOwn(cities, id) ? (id as City) : null; }
export function localityOf(city: City, id: string): string | null {
  return Object.hasOwn(cities[city].areas, id) ? (cities[city].areas as Record<string, string>)[id] : null;
}
export async function CityPage({ city, locality }: { city: string; locality?: string }) {
  const c = cityOf(city);
  const area = c && locality ? localityOf(c, locality) : null;
  if (!c || (locality && !area)) notFound();
  const rooms = await publicRooms(c, locality);
  const place = area ? `${area}, ${cities[c].name}` : cities[c].name;
  return (
    <div className="wrap">
      <div className="page-head">
        <p className="eyebrow">{area ? <Link href={`/city/${c}`}>{cities[c].name}</Link> : 'City'}</p>
        <h1>Rooms and flatmates in {place}</h1>
        <p className="lede">Every room here was posted by a signed-in member, reviewed by a moderator and reconfirmed as available within the last 21 days.</p>
        {!area ? (
          <ul className="facts" aria-label="Localities">
            {Object.entries(cities[c].areas).map(([id, name]) => <li key={id}><Link className="chip plain" href={`/city/${c}/${id}`}>{name}</Link></li>)}
          </ul>
        ) : null}
      </div>
      <section className="section" aria-label="Live rooms">
        {rooms && rooms.length ? (
          <div className="grid two">{rooms.map(r => <PublicRoomCard key={r.id} room={r} />)}</div>
        ) : (
          <div className="card empty">
            <Art name="together" width={960} height={720} />
            <h2>{rooms === null ? 'Listings open here soon' : `No live rooms in ${place} yet`}</h2>
            <p className="muted">We only show real, current vacancies, so this page stays empty until one is approved. {area ? <>Try <Link href={`/city/${c}`}>all of {cities[c].name}</Link>, or </> : null}set up your profile and we’ll match you as rooms and people join.</p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <Link className="btn primary" href="/onboarding/intent">Create my profile</Link>
              <Link className="btn" href="/onboarding/intent">List a room</Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
export async function cityMetadata(city: string, locality?: string) {
  const c = cityOf(city);
  const area = c && locality ? localityOf(c, locality) : null;
  if (!c || (locality && !area)) return { title: 'Not found' };
  const rooms = await publicRooms(c, locality);
  const place = area ? `${area}, ${cities[c].name}` : cities[c].name;
  return {
    title: `Flatmates and rooms in ${place}`,
    description: `Find compatible flatmates and moderator-reviewed rooms in ${place} with full monthly costs.`,
    // Empty pages are not offered to search engines: no doorway pages.
    robots: rooms && rooms.length ? undefined : { index: false },
  };
}
