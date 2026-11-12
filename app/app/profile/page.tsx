import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';
import { areaName, cities, dimensions, intents, rupees, titles, today, type City } from '@/lib/catalog';
import { me } from '@/lib/db';
import { logout } from '@/lib/actions';
import { dateText } from '@/lib/validate';

export const metadata = { title: 'Your profile' };
export default async function ProfilePage() {
  const { profile: p, answers, user } = await me();
  const keys = Object.keys(dimensions) as (keyof typeof dimensions)[];
  const stale = p.move_until < today();
  const answered = keys.filter(k => answers[k]?.habit || answers[k]?.want).length;
  return (
    <div className="stack">
      <div className="page-title"><h1>{p.display_name}</h1><span className={`chip ${p.status === 'active' && !stale ? '' : 'amber'}`}>{p.status !== 'active' ? 'Paused' : stale ? 'Not shown in Discover: update your dates' : p.discoverable ? 'Active and discoverable' : 'Active, hidden from Discover'}</span></div>
      <section className="card stack" aria-labelledby="basics">
        <div className="row between"><h2 id="basics">Basics</h2><Link className="btn small" href="/onboarding/basics">Edit basics</Link></div>
        <dl className="receipt" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px' }}>
          <dt>I’m here because</dt><dd style={{ textAlign: 'left' }}>{intents[p.intent as keyof typeof intents]} · <Link href="/onboarding/intent">change</Link></dd>
          <dt>Where</dt><dd style={{ textAlign: 'left' }}>{p.localities.map(a => areaName(p.city_id, a)).join(', ')}, {cities[p.city_id as City]?.name}</dd>
          <dt>Monthly budget</dt><dd style={{ textAlign: 'left' }}>{rupees(p.budget_min)} – {rupees(p.budget_max)}</dd>
          <dt>Move-in window</dt><dd style={{ textAlign: 'left' }}>{dateText(p.move_from)} – {dateText(p.move_until)}</dd>
          <dt>Planned stay</dt><dd style={{ textAlign: 'left' }}>{p.stay_months} months</dd>
        </dl>
        <p className="small muted" style={{ margin: 0 }}><BadgeCheck size={14} aria-hidden="true" /> Email verified ({user.email}). Your email is never shown to other members. No other checks have been done.</p>
      </section>
      <section className="card stack" aria-labelledby="life">
        <div className="row between"><h2 id="life">How you live</h2><Link className="btn small" href="/onboarding/lifestyle">Edit answers</Link></div>
        <p className="muted" style={{ margin: 0 }}>{answered} of {keys.length} topics answered.{answered < keys.length ? ' More answers mean more confident matches.' : ''}</p>
        <ul className="facts">{keys.filter(k => answers[k]?.habit).map(k => <li key={k} className="chip plain">{titles[k]}: {answers[k]!.habit}</li>)}</ul>
      </section>
      <nav className="stack" aria-label="More">
        <Link className="list-link" href="/app/listings"><span className="grow"><strong>My listings</strong></span><span aria-hidden="true">→</span></Link>
        <Link className="list-link" href="/app/visits"><span className="grow"><strong>Visits</strong></span><span aria-hidden="true">→</span></Link>
        <Link className="list-link" href="/app/saved"><span className="grow"><strong>Saved</strong></span><span aria-hidden="true">→</span></Link>
        <Link className="list-link" href="/app/group"><span className="grow"><strong>Find a home together</strong><br /><span className="small muted">Coming later</span></span><span aria-hidden="true">→</span></Link>
        <Link className="list-link" href="/app/settings"><span className="grow"><strong>Settings, privacy and data</strong></span><span aria-hidden="true">→</span></Link>
      </nav>
      <form action={logout}><button className="btn">Sign out</button></form>
    </div>
  );
}
