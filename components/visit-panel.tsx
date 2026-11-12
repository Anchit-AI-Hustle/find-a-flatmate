import { nowMs } from '@/lib/catalog';
import type { Visit } from '@/lib/db';
import { timeText } from '@/lib/validate';
import { ActionForm } from './form';

const label: Record<string, string> = { requested: 'Requested', confirmed: 'Confirmed', declined: 'Declined', rescheduled: 'New time proposed', cancelled: 'Cancelled', completed: 'Completed', no_show: 'Marked as no-show' };
const open = ['requested', 'confirmed', 'rescheduled'];
/** datetime-local value for "now + minutes" in India time. */
const istInput = (minutes: number) => new Date(nowMs() + minutes * 6e4 + 5.5 * 36e5).toISOString().slice(0, 16);

function When({ id }: { id: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>Date and time (India time)</label>
      <input id={id} name="at_time" type="datetime-local" required min={istInput(15)} max={istInput(60 * 24 * 89)} />
    </div>
  );
}
export function VisitPanel({ conversation, visit, me, other, location }: { conversation: string; visit?: Visit; me: string; other: string; location: string | null }) {
  const ids = <><input type="hidden" name="c" value={conversation} />{visit ? <input type="hidden" name="v" value={visit.id} /> : null}</>;
  const act = (action: string, text: string, variant: 'primary' | 'plain' | 'danger' = 'plain', confirm?: string) => (
    <ActionForm op="visit" submit={text} small variant={variant} confirm={confirm} quiet className="inline-form">{ids}<input type="hidden" name="action" value={action} /></ActionForm>
  );
  if (!visit || !open.includes(visit.status)) {
    return (
      <section className="card stack" aria-labelledby="visit">
        <h2 id="visit" style={{ fontSize: '1.2rem' }}>Plan a visit</h2>
        {visit ? <p className="small muted">Last visit: {label[visit.status]} ({timeText(visit.starts_at)}).</p> : null}
        <ActionForm op="visit" submit="Propose this time" small>
          <input type="hidden" name="c" value={conversation} /><input type="hidden" name="action" value="request" />
          <When id="visit-new" />
        </ActionForm>
        <p className="hint">Meet in daylight, tell a friend where you’ll be, and don’t pay anything at a first visit.</p>
      </section>
    );
  }
  const mineToAnswer = visit.proposer_id !== me;
  const past = Date.parse(visit.starts_at) <= nowMs();
  return (
    <section className="card stack" aria-labelledby="visit">
      <h2 id="visit" style={{ fontSize: '1.2rem' }}>Visit: {label[visit.status]}</h2>
      <p><strong>{timeText(visit.starts_at)}</strong><br /><span className="small muted">{visit.status === 'confirmed' ? 'You’ve both agreed to this time.' : mineToAnswer ? `${other} proposed this time. Please reply.` : `Waiting for ${other} to reply.`}</span></p>
      <div className="row">
        {visit.status !== 'confirmed' && mineToAnswer && !past ? act('confirm', 'Confirm', 'primary') : null}
        {visit.status !== 'confirmed' && mineToAnswer ? act('decline', 'Decline') : null}
        {visit.status === 'confirmed' && past ? <>{act('completed', 'Visit happened', 'primary')}{act('no_show', 'They didn’t show up')}</> : null}
        {act('cancel', 'Cancel visit', 'danger', 'Cancel this visit?')}
      </div>
      <details>
        <summary className="small">Propose a different time</summary>
        <ActionForm op="visit" submit="Propose new time" small>{ids}<input type="hidden" name="action" value="reschedule" /><When id="visit-move" /></ActionForm>
      </details>
      {visit.status === 'confirmed' ? (
        <div className="stack">
          <h3>Exact address</h3>
          {location ? <p className="note">{location}</p> : <p className="small muted">Not shared, or not visible yet. A shared address shows only to the two of you, from 24 hours before the visit until 2 hours after.</p>}
          {past ? null : <details>
            <summary className="small">Share or remove the address for this visit</summary>
            <ActionForm op="location" submit="Share for this visit" small>
              {ids}
              <div className="field"><label htmlFor="loc">Flat, building and landmark</label><input id="loc" name="location" type="text" minLength={4} maxLength={300} required /></div>
            </ActionForm>
            <ActionForm op="location" submit="Remove what I shared" small variant="danger" quiet>{ids}</ActionForm>
          </details>}
        </div>
      ) : null}
    </section>
  );
}
