import Link from 'next/link';
import { ActionForm } from '@/components/form';
import { Avatar, InterestActions, PersonFacts } from '@/components/people';
import { Art } from '@/components/site';
import { Fit } from '@/components/fit';
import { me, pendingRequests, person, type Candidate, type Interest, type Thread } from '@/lib/db';
import { matchPeople } from '@/lib/matching';

export const metadata = { title: 'Matches' };
export default async function Matches() {
  const s = await me();
  const { db, user, person: self } = s;
  const [rows, inbox, pending] = await Promise.all([
    db.from('interests').select('actor_id,target_id,status').order('updated_at', { ascending: false }).limit(120),
    db.rpc('inbox'),
    pendingRequests(s),
  ]);
  const interests = (rows.data ?? []) as Interest[];
  const threads = (inbox.data ?? []) as Thread[];
  const incoming = pending.slice(0, 20);
  const sent = interests.filter(i => i.actor_id === user.id && i.status === 'sent').slice(0, 20);
  const set = interests.filter(i => i.actor_id === user.id && (i.status === 'passed' || i.status === 'withdrawn')).slice(0, 20);
  // Profiles are readable only through the vetted RPC, one candidate at a time.
  const lookup = async (id: string) => (((await db.rpc('discover_people', { city: null, candidate: id })).data ?? []) as Candidate[])[0];
  const [incomingPeople, sentPeople, setPeople] = await Promise.all([
    Promise.all(incoming.map(i => lookup(i.actor_id))), Promise.all(sent.map(i => lookup(i.target_id))), Promise.all(set.map(i => lookup(i.target_id))),
  ]);
  const unavailable = incomingPeople.filter(c => !c).length;
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
          {incomingPeople.map(c => {
            if (!c) return null;
            const result = matchPeople(self, person(c, c.answers));
            const blocked = result.hard_fail_reasons.some(r => r.startsWith('Dealbreaker'));
            return (
              <article key={c.id} className="card result">
                <div className="head"><Avatar name={c.display_name} id={c.id} /><h3><Link href={`/app/people/${c.id}`}>{c.display_name}</Link></h3></div>
                <PersonFacts c={c} />
                <Fit result={result} limit={2} />
                {blocked ? (
                  <div className="stack">
                    <p className="note warn">One of you has marked this difference as a dealbreaker, so a chat can’t be opened. You can change your own answers in your profile.</p>
                    <ActionForm op="interest" submit="Not for me" small variant="plain" quiet className="inline-form"><input type="hidden" name="target" value={c.id} /><input type="hidden" name="action" value="pass" /></ActionForm>
                  </div>
                ) : <InterestActions target={c.id} relation={{ theirs: 'sent' }} />}
              </article>
            );
          })}
          {unavailable ? <p className="small muted">{unavailable} more request{unavailable === 1 ? ' is' : 's are'} from {unavailable === 1 ? 'a member who has' : 'members who have'} paused or left. {unavailable === 1 ? 'It' : 'They'} will reappear if they come back.</p> : null}
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
