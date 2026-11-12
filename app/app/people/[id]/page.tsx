import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Fit, Score } from '@/components/fit';
import { Avatar, BlockForm, InterestActions, PersonFacts, ReportForm, SaveButton, relate } from '@/components/people';
import { dimensions, titles } from '@/lib/catalog';
import { me, person, type Candidate, type Interest } from '@/lib/db';
import { matchPeople } from '@/lib/matching';
import { uuid } from '@/lib/validate';

export const metadata = { title: 'Profile' };
export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const id = uuid.safeParse((await params).id);
  if (!id.success) notFound();
  const { db, user, person: self } = await me();
  const { data } = await db.rpc('discover_people', { city: null, candidate: id.data });
  const c = ((data ?? []) as Candidate[])[0];
  if (!c) notFound();
  const [interestRows, savedRows] = await Promise.all([
    db.from('interests').select('actor_id,target_id,status'),
    db.from('saved_items').select('id').eq('user_id', user.id).eq('profile_id', c.id),
  ]);
  void db.rpc('track_product_event', { event_name: 'compatible_profile_opened' }).then(() => {}, () => {});
  const result = matchPeople(self, person(c, c.answers));
  const keys = Object.keys(dimensions) as (keyof typeof dimensions)[];
  return (
    <div className="stack">
      <p><Link href="/app/discover">← Back to Discover</Link></p>
      <div className="card result">
        <div className="head">
          <Avatar name={c.display_name} id={c.id} />
          <div><h1 style={{ fontSize: '1.6rem', margin: 0 }}>{c.display_name}</h1><span className="small muted">Plans to stay about {c.stay_months} months</span></div>
          <Score result={result} />
        </div>
        <PersonFacts c={c} />
        <div className="row between">
          <InterestActions target={c.id} relation={relate((interestRows.data ?? []) as Interest[], user.id, c.id)} />
          <SaveButton kind="profile" target={c.id} saved={Boolean(savedRows.data?.length)} />
        </div>
      </div>
      <section className="card" aria-labelledby="fit"><h2 id="fit">How you fit</h2><Fit result={result} full /></section>
      <section className="card" aria-labelledby="habits">
        <h2 id="habits">How {c.display_name} lives</h2>
        <div className="table-scroll prose">
          <table>
            <thead><tr><th scope="col">Topic</th><th scope="col">Their habit</th><th scope="col">What they’d like</th></tr></thead>
            <tbody>
              {keys.map(k => {
                const a = c.answers[k];
                return <tr key={k}><th scope="row">{titles[k]}</th><td>{a?.habit ?? <span className="muted">Not answered</span>}</td><td>{a?.want ? <>{a.want} {a.strength === 'dealbreaker' ? <span className="chip coral">Dealbreaker</span> : a.strength === 'flexible' ? <span className="chip plain">Flexible</span> : null}</> : <span className="muted">No preference given</span>}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>
      <div className="row"><ReportForm subject={c.id} label="Report this profile" /><BlockForm target={c.id} /></div>
    </div>
  );
}
