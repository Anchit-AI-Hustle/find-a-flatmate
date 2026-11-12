import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Receipt } from '@/components/costs';
import { ActionForm } from '@/components/form';
import { Photo } from '@/components/room-card';
import { RoomFacts } from '@/components/rooms';
import { Brand } from '@/components/site';
import { expandedListing, requireModerator, type Listing } from '@/lib/db';
import { nowMs } from '@/lib/catalog';
import { timeText } from '@/lib/validate';

export const metadata = { title: 'Moderation', robots: { index: false } };
type Report = { id: string; reporter_id: string | null; subject_id: string | null; listing_id: string | null; message_id: string | null; category: string; details: string; status: string; created_at: string };
type Member = { id: string; display_name: string; status: string; created_at: string };
type Request = { id: string; user_id: string | null; kind: string; details: string | null; created_at: string };
type Audit = { id: string; moderator_id: string | null; target_type: string; target_id: string; action: string; reason: string; created_at: string };
const funnel = ['onboarding_completed', 'discover_view', 'compatible_profile_opened', 'interest_sent', 'mutual_match', 'first_message', 'visit_requested', 'visit_confirmed', 'visit_completed', 'home_found_self_reported'];
const short = (id: string | null) => (id ? id.slice(0, 8) : '—');

function Moderate({ kind, target, actions }: { kind: string; target: string; actions: [string, string, ('primary' | 'plain' | 'danger')?][] }) {
  return (
    <div className="stack">
      {actions.map(([action, text, variant = 'plain']) => (
        <ActionForm key={action} op="moderate" submit={text} small variant={variant} className="row">
          <input type="hidden" name="kind" value={kind} /><input type="hidden" name="target" value={target} /><input type="hidden" name="action" value={action} />
          <label className="sr" htmlFor={`${action}-${target}`}>Reason to {text.toLowerCase()}</label>
          <input id={`${action}-${target}`} name="reason" type="text" required minLength={5} maxLength={500} placeholder={`Reason to ${text.toLowerCase()} (logged)`} style={{ flex: 1, minWidth: 180 }} />
        </ActionForm>
      ))}
    </div>
  );
}
/** Moderator-only. The role is checked in the database on every read and every action, never from the client. */
export default async function Admin() {
  const s = await requireModerator();
  if (!s) notFound();
  const { db } = s;
  const since = new Date(nowMs() - 30 * 864e5).toISOString();
  const [pending, reports, members, requests, audit, events, live] = await Promise.all([
    db.from('listings').select(expandedListing).eq('status', 'pending_review').order('updated_at').overrideTypes<Listing[], { merge: false }>(),
    db.from('reports').select('*').in('status', ['open', 'investigating', 'escalated']).order('created_at').limit(50),
    db.rpc('moderation_profiles'),
    db.from('data_subject_requests').select('id,user_id,kind,details,created_at').eq('status', 'pending').order('created_at').limit(50),
    db.from('moderation_actions').select('*').order('created_at', { ascending: false }).limit(30),
    db.from('product_events').select('event').gte('created_at', since).limit(5000),
    db.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active'),
  ]);
  const counts = new Map<string, number>();
  for (const e of (events.data ?? []) as { event: string }[]) counts.set(e.event, (counts.get(e.event) ?? 0) + 1);
  const reportRows = (reports.data ?? []) as Report[];
  const memberRows = (members.data ?? []) as Member[];
  const next: Record<string, [string, string, ('primary' | 'plain' | 'danger')?][]> = {
    open: [['investigating', 'Start investigating', 'primary']],
    investigating: [['resolved', 'Resolve', 'primary'], ['dismissed', 'Dismiss'], ['escalated', 'Escalate', 'danger']],
    escalated: [['resolved', 'Resolve', 'primary'], ['dismissed', 'Dismiss']],
  };
  return (
    <>
      <header className="site-head"><div className="wrap"><Brand href="/app" /><Link className="btn small" href="/app">Back to app</Link></div></header>
      <main id="main" className="wrap app-main stack">
        <div className="page-title"><h1>Moderation</h1></div>
        <section aria-labelledby="kpis">
          <h2 id="kpis">Last 30 days</h2>
          <div className="kpis">
            <div className="kpi"><b>{live.count ?? 0}</b><span>live listings now</span></div>
            <div className="kpi"><b>{pending.data?.length ?? 0}</b><span>listings awaiting review</span></div>
            <div className="kpi"><b>{reportRows.length}</b><span>open reports</span></div>
            <div className="kpi"><b>{memberRows.filter(m => m.status === 'active').length}</b><span>active among the latest 60 members</span></div>
          </div>
          <div className="table-scroll prose card" style={{ marginTop: 12 }}>
            <table>
              <caption className="small muted" style={{ textAlign: 'left' }}>Funnel events from members who opted in to analytics. {events.data?.length ? '' : 'Not enough data yet.'}</caption>
              <thead><tr><th scope="col">Event</th><th scope="col">Count</th></tr></thead>
              <tbody>{funnel.map(e => <tr key={e}><td>{e.replaceAll('_', ' ')}</td><td>{counts.get(e) ?? 0}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
        <section aria-labelledby="q-listings">
          <h2 id="q-listings">Listings awaiting review</h2>
          <div className="queue">
            {pending.data?.length ? pending.data.map(l => (
              <article key={l.id} className="card stack">
                <h3>{l.title}</h3>
                <RoomFacts room={l} />
                {l.listing_images?.length ? <div className="thumbs">{l.listing_images.map((i, n) => <figure key={i.id}><Photo id={i.id} alt={`Listing photo ${n + 1}`} /></figure>)}</div> : null}
                <p style={{ whiteSpace: 'pre-wrap' }}>{l.description}</p>
                <p className="small muted">Posted by {l.poster_type.toLowerCase()} · member {short(l.owner_id)} · {l.building}, {l.furnishing} · {l.occupants} of {l.capacity} occupied{l.restrictions ? ` · Restrictions: ${l.restrictions}` : ''}</p>
                <Receipt costs={l} />
                <Moderate kind="listing" target={l.id} actions={[['approve', 'Approve', 'primary'], ['reject', 'Send back to draft'], ['remove', 'Remove', 'danger']]} />
              </article>
            )) : <p className="muted">Nothing waiting. New submissions appear here.</p>}
          </div>
        </section>
        <section aria-labelledby="q-reports">
          <h2 id="q-reports">Reports</h2>
          <div className="queue">
            {reportRows.length ? reportRows.map(r => (
              <article key={r.id} className="card stack">
                <div className="row between"><h3>{r.category} · {r.listing_id ? 'listing' : r.message_id ? 'message' : 'profile'}</h3><span className={`chip ${r.status === 'open' ? 'amber' : r.status === 'escalated' ? 'coral' : 'plain'}`}>{r.status}</span></div>
                <p style={{ whiteSpace: 'pre-wrap' }}>{r.details}</p>
                <p className="small muted">Filed {timeText(r.created_at)} by member {short(r.reporter_id)} about member {short(r.subject_id)}{r.listing_id ? ` · listing ${short(r.listing_id)}` : ''}</p>
                {r.message_id && r.status !== 'open' ? (
                  <ActionForm op="evidence" submit="Read the reported message" small variant="plain" className="row">
                    <input type="hidden" name="report_id" value={r.id} />
                    <label className="sr" htmlFor={`ev-${r.id}`}>Justification for reading the message</label>
                    <input id={`ev-${r.id}`} name="justification" type="text" required minLength={10} maxLength={500} placeholder="Why you need to read it (logged)" style={{ flex: 1, minWidth: 180 }} />
                  </ActionForm>
                ) : r.message_id ? <p className="small muted">Start investigating to request the reported message. Only that one message can be read, and each read is logged.</p> : null}
                <Moderate kind="report" target={r.id} actions={next[r.status] ?? []} />
                {r.listing_id ? <Moderate kind="listing" target={r.listing_id} actions={[['remove', 'Remove the listing', 'danger']]} /> : null}
                {r.subject_id ? <Moderate kind="profile" target={r.subject_id} actions={[['suspend', 'Suspend the reported member', 'danger']]} /> : null}
              </article>
            )) : <p className="muted">No open reports.</p>}
          </div>
        </section>
        <section aria-labelledby="q-members">
          <h2 id="q-members">Latest members</h2>
          <div className="queue">
            {memberRows.length ? memberRows.map(m => (
              <details key={m.id} className="card">
                <summary><strong>{m.display_name}</strong> <span className={`chip ${m.status === 'suspended' ? 'coral' : 'plain'}`}>{m.status}</span> <span className="small muted">member {short(m.id)} · joined {timeText(m.created_at)}</span></summary>
                <div style={{ marginTop: 12 }}><Moderate kind="profile" target={m.id} actions={m.status === 'suspended' ? [['restore', 'Restore account', 'primary']] : [['suspend', 'Suspend account', 'danger']]} /></div>
              </details>
            )) : <p className="muted">No members yet.</p>}
          </div>
        </section>
        <section aria-labelledby="q-requests">
          <h2 id="q-requests">Privacy and support requests</h2>
          <div className="queue">
            {((requests.data ?? []) as Request[]).length ? ((requests.data ?? []) as Request[]).map(r => (
              <article key={r.id} className="card stack">
                <h3>{r.kind === 'delete' ? 'Account deletion' : r.kind === 'export' ? 'Data export' : 'Support or appeal'}</h3>
                {r.details ? <p style={{ whiteSpace: 'pre-wrap' }}>{r.details}</p> : null}
                <p className="small muted">Member {short(r.user_id)} · {timeText(r.created_at)}</p>
                {r.kind === 'delete' ? <p className="small muted">Deletion is completed in the Supabase dashboard by an operator, following docs/PRIVACY-AND-SAFETY.md. It can’t be marked done from here.</p> : <Moderate kind="request" target={r.id} actions={[['fulfill', 'Mark as handled', 'primary']]} />}
              </article>
            )) : <p className="muted">No pending requests.</p>}
          </div>
        </section>
        <section aria-labelledby="audit">
          <h2 id="audit">Audit log</h2>
          <div className="table-scroll prose card">
            <table>
              <thead><tr><th scope="col">When</th><th scope="col">Moderator</th><th scope="col">Action</th><th scope="col">Target</th><th scope="col">Reason</th></tr></thead>
              <tbody>{((audit.data ?? []) as Audit[]).length ? ((audit.data ?? []) as Audit[]).map(a => <tr key={a.id}><td>{timeText(a.created_at)}</td><td>{short(a.moderator_id)}</td><td>{a.target_type}.{a.action}</td><td>{short(a.target_id)}</td><td>{a.reason}</td></tr>) : <tr><td colSpan={5} className="muted">No moderator actions recorded yet.</td></tr>}</tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
