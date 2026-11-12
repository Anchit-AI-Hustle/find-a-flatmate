import Link from 'next/link';
import { BadgeCheck, CalendarDays, MapPin, Wallet } from 'lucide-react';
import { areaName, intents, rupees } from '@/lib/catalog';
import type { Candidate, Interest } from '@/lib/db';
import { dateText } from '@/lib/validate';
import { Doodle } from './doodle';
import { ActionForm } from './form';

export function Avatar({ name, id }: { name: string; id: string }) {
  void name;
  return <Doodle id={id} />;
}
export function PersonFacts({ c }: { c: Candidate }) {
  return (
    <ul className="facts">
      <li className="chip plain">{intents[c.intent as keyof typeof intents] ?? c.intent}</li>
      <li className="chip plain"><MapPin size={14} aria-hidden="true" />{c.localities.map(a => areaName(c.city_id, a)).join(', ')}</li>
      <li className="chip plain"><Wallet size={14} aria-hidden="true" />{rupees(c.budget_min)}–{rupees(c.budget_max)} / month</li>
      <li className="chip plain"><CalendarDays size={14} aria-hidden="true" />Moving {dateText(c.move_from)} – {dateText(c.move_until)}</li>
      {c.email_verified ? <li className="chip"><BadgeCheck size={14} aria-hidden="true" />Email verified</li> : null}
    </ul>
  );
}
export type Relation = { mine?: Interest['status']; theirs?: Interest['status'] };
export function relate(rows: Interest[], me: string, other: string): Relation {
  return {
    mine: rows.find(r => r.actor_id === me && r.target_id === other)?.status as Relation['mine'],
    theirs: rows.find(r => r.actor_id === other && r.target_id === me)?.status as Relation['theirs'],
  };
}
/** Interest buttons reflect the persisted state: sent, incoming, mutual, or none. */
export function InterestActions({ target, relation, listing, conversation }: { target: string; relation: Relation; listing?: string; conversation?: string }) {
  const hidden = <><input type="hidden" name="target" value={target} />{listing ? <input type="hidden" name="listing" value={listing} /> : null}</>;
  if (relation.mine === 'mutual') return conversation ? <Link className="btn primary small" href={`/app/messages/${conversation}`}>Open chat</Link> : <Link className="btn primary small" href="/app/messages">You’ve matched — open chats</Link>;
  if (relation.mine === 'sent') {
    return (
      <div className="row">
        <span className="chip">Interest sent</span>
        <ActionForm op="interest" submit="Withdraw" small variant="plain" quiet className="inline-form">{hidden}<input type="hidden" name="action" value="withdraw" /></ActionForm>
      </div>
    );
  }
  if (relation.mine === 'passed' || relation.mine === 'withdrawn') {
    return (
      <div className="row">
        <span className="chip plain">{relation.mine === 'passed' ? 'You passed' : 'Interest withdrawn'}</span>
        <ActionForm op="interest" submit="Undo" small variant="plain" quiet className="inline-form">{hidden}<input type="hidden" name="action" value="reset" /></ActionForm>
      </div>
    );
  }
  return (
    <div className="row">
      <ActionForm op="interest" submit={relation.theirs === 'sent' ? 'Accept and open chat' : listing ? 'I’m interested in this room' : 'I’m interested'} small className="inline-form" pendingLabel="Sending…">{hidden}<input type="hidden" name="action" value="like" /></ActionForm>
      <ActionForm op="interest" submit="Not for me" small variant="plain" quiet className="inline-form">{hidden}<input type="hidden" name="action" value="pass" /></ActionForm>
    </div>
  );
}
export function SaveButton({ kind, target, saved }: { kind: 'profile' | 'listing'; target: string; saved: boolean }) {
  return (
    <ActionForm op="save" submit={saved ? 'Saved ✓' : 'Save'} small variant="plain" quiet className="inline-form">
      <input type="hidden" name="kind" value={kind} /><input type="hidden" name="target" value={target} /><input type="hidden" name="enabled" value={saved ? 'no' : 'yes'} />
    </ActionForm>
  );
}
export function ReportForm({ subject, listing, message, label = 'Report' }: { subject?: string; listing?: string; message?: string; label?: string }) {
  return (
    <details>
      <summary className="small">{label}</summary>
      <ActionForm op="report" submit="Send report" small variant="danger" className="card flat stack">
        {subject ? <input type="hidden" name="subject" value={subject} /> : null}
        {listing ? <input type="hidden" name="listing" value={listing} /> : null}
        {message ? <input type="hidden" name="message" value={message} /> : null}
        <div className="field">
          <label>What’s wrong?
            <select name="category" required defaultValue="">
              <option value="" disabled>Choose a reason</option>
              <option value="scam">Scam or asking for advance payment</option>
              <option value="harassment">Harassment or abuse</option>
              <option value="underage">Seems under 18</option>
              <option value="stale">Fake, duplicate or no longer available</option>
              <option value="privacy">Shared private information</option>
              <option value="other">Something else</option>
            </select>
          </label>
        </div>
        <div className="field"><label>What happened?<textarea name="details" required minLength={5} maxLength={1200} /></label></div>
        <label className="check"><input type="checkbox" name="also_block" />Also block this person</label>
      </ActionForm>
    </details>
  );
}
export function BlockForm({ target }: { target: string }) {
  return (
    <details>
      <summary className="small">Block</summary>
      <ActionForm op="block" submit="Block this person" small variant="danger" className="card flat stack">
        <input type="hidden" name="target" value={target} />
        <label className="check"><input type="checkbox" name="confirm" required />Block them. We’ll stop all chat and hide you from each other straight away.</label>
      </ActionForm>
    </details>
  );
}
