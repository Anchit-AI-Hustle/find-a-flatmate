import Link from 'next/link';
import { Art } from '@/components/site';
import { me, type Thread, type Visit } from '@/lib/db';
import { timeText } from '@/lib/validate';

export const metadata = { title: 'Visits' };
const label: Record<string, string> = { requested: 'Awaiting reply', confirmed: 'Confirmed', declined: 'Declined', rescheduled: 'New time proposed', cancelled: 'Cancelled', completed: 'Completed', no_show: 'No-show' };
export default async function Visits() {
  const { db, user } = await me();
  const [rows, inbox] = await Promise.all([db.from('visit_requests').select('*').order('starts_at', { ascending: false }).limit(60), db.rpc('inbox')]);
  const visits = (rows.data ?? []) as Visit[];
  const names = new Map(((inbox.data ?? []) as Thread[]).map(t => [t.id, t.display_name]));
  const open = visits.filter(v => ['requested', 'confirmed', 'rescheduled'].includes(v.status));
  const past = visits.filter(v => !open.includes(v));
  const row = (v: Visit) => (
    <Link key={v.id} className="list-link" href={`/app/messages/${v.conversation_id}`}>
      <span className="grow"><strong>{timeText(v.starts_at)}</strong><br /><span className="small muted">With {names.get(v.conversation_id) ?? 'a match'}{v.status !== 'confirmed' && open.includes(v) ? (v.proposer_id === user.id ? ' · waiting for them' : ' · needs your reply') : ''}</span></span>
      <span className={`chip ${v.status === 'confirmed' ? '' : open.includes(v) ? 'amber' : 'plain'}`}>{label[v.status]}</span>
    </Link>
  );
  return (
    <>
      <div className="page-title"><h1>Visits</h1></div>
      {visits.length ? (
        <>
          <section className="stack" aria-labelledby="open"><h2 id="open">Open</h2>{open.length ? open.map(row) : <p className="muted">No open visits.</p>}</section>
          {past.length ? <section className="stack section" aria-labelledby="past"><h2 id="past">Earlier</h2>{past.map(row)}</section> : null}
        </>
      ) : (
        <div className="card empty">
          <Art name="visit" width={960} height={720} />
          <h2>No visits planned</h2>
          <p className="muted">Once you’ve matched and chatted, either of you can propose a time from the conversation. The address is shared only after a visit is confirmed.</p>
          <Link className="btn primary" href="/app/messages">Open messages</Link>
        </div>
      )}
    </>
  );
}
