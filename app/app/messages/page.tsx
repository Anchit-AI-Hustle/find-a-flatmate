import Link from 'next/link';
import { Avatar } from '@/components/people';
import { Art } from '@/components/site';
import { me, type Thread } from '@/lib/db';
import { timeText } from '@/lib/validate';

export const metadata = { title: 'Messages' };
export default async function Messages() {
  const { db } = await me();
  const threads = ((await db.rpc('inbox')).data ?? []) as Thread[];
  return (
    <>
      <div className="page-title"><h1>Messages</h1></div>
      {threads.length ? (
        <div className="stack">
          {threads.map(t => (
            <Link key={t.id} className="list-link" href={`/app/messages/${t.id}`}>
              <Avatar name={t.display_name} id={t.other_id} />
              <span className="grow"><strong>{t.display_name}</strong><br /><span className="small muted">Last activity {timeText(t.activity)}</span></span>
              {Number(t.unread) ? <span className="unread">{t.unread}<span className="sr"> unread</span></span> : null}
            </Link>
          ))}
        </div>
      ) : (
        <div className="card empty">
          <Art name="visit" width={960} height={720} />
          <h2>No conversations yet</h2>
          <p className="muted">Chats open only when you and another member both show interest, so nobody can message you out of the blue.</p>
          <Link className="btn primary" href="/app/discover">Discover people and rooms</Link>
        </div>
      )}
    </>
  );
}
