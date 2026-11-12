import Link from 'next/link';
import { ActionForm } from '@/components/form';
import { profile, requireSession } from '@/lib/db';
import { logout } from '@/lib/actions';
import { dateText } from '@/lib/validate';

export const metadata = { title: 'Data and support' };
/** Reachable by suspended and closed accounts too, so they can appeal, export or follow up. */
export default async function Data() {
  const { db, user } = await requireSession();
  const p = await profile();
  const { data } = await db.from('data_subject_requests').select('id,kind,status,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
  const requests = (data ?? []) as { id: string; kind: string; status: string; created_at: string }[];
  const closed = p?.status === 'closed';
  return (
    <div className="stack">
      <p><Link href="/app/settings">← Settings</Link></p>
      <h1>Data and support</h1>
      {p?.status === 'suspended' ? <p className="note warn" role="alert"><strong>Your account is suspended</strong> after a moderator review. You can’t browse or message, but you can appeal below and download your data.</p> : null}
      {closed ? <p className="note warn" role="alert"><strong>Your account is closed.</strong> Your profile and listings are no longer visible. A deletion request is with our privacy queue. You can still download your data or contact support.</p> : null}
      <section className="card stack" aria-labelledby="download">
        <h2 id="download">Download your data</h2>
        <p className="muted">A JSON file with your profile, answers, listings, interests, saved items, visits, messages you sent, consents and requests.</p>
        <p><a className="btn" href="/app/settings/data/export" download>Download my data (JSON)</a></p>
      </section>
      <section className="card stack" aria-labelledby="support">
        <h2 id="support">{p?.status === 'suspended' ? 'Appeal or contact support' : 'Contact support'}</h2>
        <ActionForm op="request" submit="Send to support" small>
          <input type="hidden" name="kind" value="support" />
          <div className="field"><label htmlFor="details">How can we help?</label><textarea id="details" name="details" required minLength={5} maxLength={1200} /></div>
        </ActionForm>
        <details>
          <summary className="small">Ask for a full export from our team instead</summary>
          <ActionForm op="request" submit="Request export" small variant="plain"><input type="hidden" name="kind" value="export" /></ActionForm>
        </details>
      </section>
      {closed ? null : (
        <section className="card stack" aria-labelledby="close">
          <h2 id="close">Close my account</h2>
          <p className="muted">This immediately hides your profile, removes your listings, withdraws any visit address you shared and deletes your analytics events. Your account record is then queued for deletion. Reports and moderation records about safety are kept as described in the <Link href="/privacy">Privacy notice</Link>.</p>
          <ActionForm op="request" submit="Close my account" small variant="danger" confirm="Close your account now? This can’t be undone from the app.">
            <input type="hidden" name="kind" value="delete" />
            <label className="check" style={{ marginBottom: 12 }}><input type="checkbox" name="confirm" required />I understand my profile and listings will be removed straight away.</label>
          </ActionForm>
        </section>
      )}
      {requests.length ? (
        <section className="card prose" aria-labelledby="history">
          <h2 id="history">Your requests</h2>
          <div className="table-scroll"><table>
            <thead><tr><th scope="col">Type</th><th scope="col">Sent</th><th scope="col">Status</th></tr></thead>
            <tbody>{requests.map(r => <tr key={r.id}><td>{r.kind === 'delete' ? 'Account closure' : r.kind === 'export' ? 'Data export' : 'Support'}</td><td>{dateText(r.created_at)}</td><td>{r.status === 'pending' ? 'In the queue' : 'Done'}</td></tr>)}</tbody>
          </table></div>
        </section>
      ) : null}
      <form action={logout}><button className="btn">Sign out</button></form>
    </div>
  );
}
