import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChatLive } from '@/components/chat-live';
import { ActionForm } from '@/components/form';
import { BlockForm, ReportForm } from '@/components/people';
import { VisitPanel } from '@/components/visit-panel';
import { me, type Message, type Thread, type Visit } from '@/lib/db';
import { timeText, uuid } from '@/lib/validate';

export const metadata = { title: 'Conversation' };
export default async function Conversation({ params }: { params: Promise<{ id: string }> }) {
  const id = uuid.safeParse((await params).id);
  if (!id.success) notFound();
  const { db, user } = await me();
  const thread = (((await db.rpc('inbox')).data ?? []) as Thread[]).find(t => t.id === id.data);
  if (!thread) notFound();
  const [rows, visits] = await Promise.all([
    db.from('messages').select('id,sender_id,body,suspicious,created_at').eq('conversation_id', thread.id).order('created_at', { ascending: false }).limit(100),
    db.from('visit_requests').select('*').eq('conversation_id', thread.id).order('created_at', { ascending: false }).limit(1),
  ]);
  const messages = ((rows.data ?? []) as Message[]).reverse();
  const visit = ((visits.data ?? []) as Visit[])[0];
  const last = messages.at(-1);
  if (last) await db.rpc('mark_read', { c: thread.id, last_seen: last.id });
  const location = visit?.status === 'confirmed' ? ((await db.rpc('read_visit_location', { v: visit.id })).data as string | null) : null;
  const flagged = messages.some(m => m.suspicious && m.sender_id !== user.id);
  return (
    <div className="stack">
      <p><Link href="/app/messages">← All messages</Link></p>
      <div className="page-title"><h1><Link href={`/app/people/${thread.other_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{thread.display_name}</Link></h1>
        <div className="row"><ReportForm subject={thread.other_id} label="Report" /><BlockForm target={thread.other_id} /></div>
      </div>
      {flagged ? <p className="note warn" role="alert"><strong>Be careful.</strong> A message here mentions payments, OTPs, ID details or moving to another app. Don’t pay or share those before you’ve visited and verified the home. You can report the message below it.</p> : null}
      <VisitPanel conversation={thread.id} visit={visit} me={user.id} other={thread.display_name} location={location} />
      <section aria-label="Messages">
        <div className="thread" role="log" aria-live="polite">
          {messages.length ? messages.map(m => {
            const mine = m.sender_id === user.id;
            return (
              <div key={m.id} className={`bubble${mine ? ' mine' : ''}${m.suspicious ? ' flag' : ''}`}>
                <span className="sr">{mine ? 'You' : thread.display_name}: </span>{m.body}
                <time dateTime={m.created_at}>{timeText(m.created_at)}</time>
                {!mine && m.suspicious ? <ReportForm message={m.id} label="Report this message" /> : null}
              </div>
            );
          }) : <p className="muted">You’ve matched. Say hello — a good first message mentions your move-in date and one thing from their profile.</p>}
          <ChatLive count={messages.length} />
        </div>
        <ActionForm op="message" submit="Send" compose quiet className="composer" pendingLabel="Sending…">
          <input type="hidden" name="c" value={thread.id} />
          <label className="sr" htmlFor="body">Message</label>
          <textarea id="body" name="body" required maxLength={1500} rows={1} placeholder="Write a message" />
        </ActionForm>
      </section>
    </div>
  );
}
