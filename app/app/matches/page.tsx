import Link from 'next/link';
import { ActionForm } from '@/components/form';
import { Avatar, InterestActions, PersonFacts } from '@/components/people';
import { Art } from '@/components/site';
import { me, type Candidate, type Interest, type Thread } from '@/lib/db';

export const metadata = { title: 'Matches' };
export default async function Matches() {
  const { db, user } = await me();
  const [rows, inbox] = await Promise.all([
    db.from('interests').select('actor_id,target_id,status').order('updated_at', { ascending: false }).limit(120),
    db.rpc('inbox'),
  ]);
  const interests = (rows.data ?? []) as Interest[];
  const threads = (inbox.data ?? []) as Thread[];
  const incoming = interests.filter(i => i.target_id === user.id && i.status === 'sent').slice(0, 20);
  const sent = interests.filter(i => i.actor_id === user.id && i.status === 'sent').slice(0, 20);
  const set = interests.filter(i => i.actor_id === user.id && (i.status === 'passed' || i.status === 'withdrawn')).slice(0, 20);
  // Profiles are readable only through the vetted RPC, one candidate at a time.
  const lookup = async (id: string) => (((await db.rpc('discover_people', { city: null, candidate: id })).data ?? []) as Candidate[])[0];
  const [incomingPeople, sentPeople, setPeople] = await Promise.all([
    Promise.all(incoming.map(i => lookup(i.actor_id))), Promise.all(sent.map(i => lookup(i.target_id))), Promise.all(set.map(i => lookup(i.target_id))),
  ]);
  const empty = !threads.length && !incoming.length && !sent.length && !set.length;
  return (
    <>
      <div className="page-title"><h1>Matches</h1></div>
      {empty ? (
        <div className="card empty">
          <Art name="kitchen" width={960} height={720} />
          <h2>No matches yet</h2>
          <p className="muted">When you and someone else both show interest, a private chat opens here. Nobody can message you before that.</p>
          <Link className="btn primary" href="/app/discover">Discover people and rooms</Link>
        </div>
      ) : null}
      {incoming.length ? (
        <section className="stack" aria-labelledby="incoming">
          <h2 id="incoming">Interested in you</h2>
          {incomingPeople.map(c => c ? (
            <article key={c.id} className="card result">
              <div className="head"><Avatar name={c.display_name} id={c.id} /><h3><Link href={`/app/people/${c.id}`}>{c.display_name}</Link></h3></div>
              <PersonFacts c={c} />
              <InterestActions target={c.id} relation={{ theirs: 'sent' }} />
            </article>
          ) : null)}
        </section>
      ) : null}
      {threads.length ? (
        <section className="stack section" aria-labelledby="mutual">
          <h2 id="mutual">Mutual matches</h2>
          {threads.map(t => (
            <Link key={t.id} className="list-link" href={`/app/messages/${t.id}`}>
              <Avatar name={t.display_name} id={t.other_id} />
              <span className="grow"><strong>{t.display_name}</strong><br /><span className="small muted">You both showed interest. Chat is open.</span></span>
              {Number(t.unread) ? <span className="unread">{t.unread}<span className="sr"> unread</span></span> : null}
            </Link>
          ))}
        </section>
      ) : null}
      {sent.length ? (
        <section className="stack section" aria-labelledby="sent">
          <h2 id="sent">Waiting for a reply</h2>
          {sent.map((i, n) => {
            const c = sentPeople[n];
            return (
              <div key={i.target_id} className="list-link">
                <Avatar name={c?.display_name ?? '?'} id={i.target_id} />
                <span className="grow">{c ? <Link href={`/app/people/${c.id}`}><strong>{c.display_name}</strong></Link> : <strong>A member who is not browsable right now</strong>}<br /><span className="small muted">Interest sent</span></span>
                <ActionForm op="interest" submit="Withdraw" small variant="plain" quiet className="inline-form"><input type="hidden" name="target" value={i.target_id} /><input type="hidden" name="action" value="withdraw" /></ActionForm>
              </div>
            );
          })}
        </section>
      ) : null}
      {set.length ? (
        <section className="stack section" aria-labelledby="passed">
          <h2 id="passed">Passed or withdrawn</h2>
          <p className="muted small">Changed your mind? Undo puts them back in Discover.</p>
          {set.map((i, n) => {
            const c = setPeople[n];
            return (
              <div key={i.target_id} className="list-link">
                <Avatar name={c?.display_name ?? '?'} id={i.target_id} />
                <span className="grow"><strong>{c?.display_name ?? 'A member'}</strong><br /><span className="small muted">{i.status === 'passed' ? 'You passed' : 'You withdrew interest'}</span></span>
                <ActionForm op="interest" submit="Undo" small variant="plain" quiet className="inline-form"><input type="hidden" name="target" value={i.target_id} /><input type="hidden" name="action" value="reset" /></ActionForm>
              </div>
            );
          })}
        </section>
      ) : null}
    </>
  );
}
