import Link from 'next/link';
import { ActionForm } from '@/components/form';
import { cities, intents, type City } from '@/lib/catalog';
import { me, type Thread } from '@/lib/db';

export const metadata = { title: 'Overview' };
export default async function Overview() {
  const { db, user, profile } = await me();
  const [inbox, incoming, visits, mine, people, rooms, waiting] = await Promise.all([
    db.rpc('inbox'),
    db.from('interests').select('actor_id', { count: 'exact', head: true }).eq('target_id', user.id).eq('status', 'sent'),
    db.from('visit_requests').select('id', { count: 'exact', head: true }).in('status', ['requested', 'confirmed', 'rescheduled']),
    db.from('listings').select('id,status').eq('owner_id', user.id).not('status', 'in', '(filled,removed)'),
    db.rpc('discover_people', { city: profile.city_id }),
    db.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('city_id', profile.city_id).neq('owner_id', user.id),
    db.from('availability_waitlist').select('city_id').eq('user_id', user.id),
  ]);
  const threads = (inbox.data ?? []) as Thread[];
  const unread = threads.reduce((n, t) => n + Number(t.unread), 0);
  const listings = (mine.data ?? []) as { id: string; status: string }[];
  const peopleCount = Array.isArray(people.data) ? people.data.length : 0;
  const roomCount = rooms.count ?? 0;
  const city = cities[profile.city_id as City]?.name ?? profile.city_id;
  const draft = listings.find(l => l.status === 'draft');
  const next: { href: string; label: string; why: string }[] = [];
  if (profile.status === 'paused') next.push({ href: '/app/settings/privacy', label: 'Resume your profile', why: 'You’re paused, so nobody can find or match with you.' });
  if (incoming.count) next.push({ href: '/app/matches', label: `Review ${incoming.count} interest request${incoming.count === 1 ? '' : 's'}`, why: 'Someone would like to chat. Accept to open a conversation.' });
  if (unread) next.push({ href: '/app/messages', label: `Read ${unread} new message${unread === 1 ? '' : 's'}`, why: 'Replies keep a conversation alive.' });
  if (visits.count) next.push({ href: '/app/visits', label: 'Check your visits', why: 'A visit is waiting for a reply or coming up.' });
  if (draft) next.push({ href: `/app/listings/${draft.id}/edit`, label: 'Finish your draft listing', why: 'Add a photo and submit it for review to go live.' });
  if (profile.intent === 'have_room' && !listings.length) next.push({ href: '/app/listings/new', label: 'List your room', why: 'People can only find a vacancy once it’s listed.' });
  if (peopleCount + roomCount > 0) next.push({ href: '/app/discover', label: 'See who and what fits', why: `${peopleCount} ${peopleCount === 1 ? 'person' : 'people'} and ${roomCount} room${roomCount === 1 ? '' : 's'} in ${city} right now.` });
  return (
    <>
      <div className="page-title"><h1>Hello, {profile.display_name}</h1><span className="chip plain">{intents[profile.intent as keyof typeof intents]}</span></div>
      <div className="kpis" style={{ marginBottom: 20 }}>
        <Link className="kpi" href="/app/discover" style={{ textDecoration: 'none', color: 'inherit' }}><b>{peopleCount}</b><span>people in {city}</span></Link>
        <Link className="kpi" href="/app/discover?mode=rooms" style={{ textDecoration: 'none', color: 'inherit' }}><b>{roomCount}</b><span>live rooms in {city}</span></Link>
        <Link className="kpi" href="/app/matches" style={{ textDecoration: 'none', color: 'inherit' }}><b>{threads.length}</b><span>mutual matches</span></Link>
        <Link className="kpi" href="/app/visits" style={{ textDecoration: 'none', color: 'inherit' }}><b>{visits.count ?? 0}</b><span>open visits</span></Link>
      </div>
      <section aria-labelledby="next">
        <h2 id="next">Your next step</h2>
        {next.length ? (
          <div className="stack">
            {next.map(n => <Link key={n.href + n.label} className="list-link" href={n.href}><span className="grow"><strong>{n.label}</strong><br /><span className="small muted">{n.why}</span></span><span aria-hidden="true">→</span></Link>)}
          </div>
        ) : (
          <div className="card stack">
            <h3>It’s quiet in {city} right now</h3>
            <p className="muted">We’re new and only show real people and real rooms, so there’s nothing to pretend with. You can widen your localities, budget or dates, or ask us to tell you when more is available.</p>
            <div className="row">
              <Link className="btn" href="/onboarding/basics">Widen my search</Link>
              {waiting.data?.length ? <span className="chip">You’re on the {city} waitlist</span> : <ActionForm op="waitlist" submit={`Join the ${city} waitlist`} small className="inline-form" />}
            </div>
          </div>
        )}
      </section>
      <p className="note" style={{ marginTop: 24 }}>Never pay a deposit, “token” or advance before you’ve visited and checked the paperwork. <Link href="/safety">Safety checklist</Link></p>
    </>
  );
}
