'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { sampleLine, type SampleInfo } from '@/lib/samples';
import { likedSamples, practiceChat, usePracticeChat, useSampleIds } from './sample-store';

const clock = (at: string) => new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date(at));

/** A chat with a sample match, for practice. Messages never leave this browser and the replies are a short fixed script. */
export function SampleChat({ sample, member }: { sample: SampleInfo; member: string }) {
  const router = useRouter();
  const messages = usePracticeChat(member, sample.id);
  // The page was served because this sample was liked; if it is removed here or in another tab, the chat closes.
  const open = useSampleIds(likedSamples, [sample.id], member).includes(sample.id);
  const [draft, setDraft] = useState('');
  // Stored history is drawn just after load; it should not be read out as if it had just arrived.
  const [live, setLive] = useState(false);
  const reply = useRef<number | undefined>(undefined);
  const end = useRef<HTMLDivElement>(null);
  const last = messages.at(-1)?.at;
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [last]);
  useEffect(() => {
    const timer = window.setTimeout(() => setLive(true), 600);
    return () => { window.clearTimeout(timer); window.clearTimeout(reply.current); };
  }, []);
  const send = () => {
    const body = draft.trim().slice(0, 1500);
    if (!body || !open) return;
    const turn = messages.filter(m => m.mine).length + 1;
    practiceChat.add(member, sample.id, { mine: true, body, at: new Date().toISOString() });
    setDraft('');
    window.clearTimeout(reply.current);
    reply.current = window.setTimeout(() => practiceChat.add(member, sample.id, { mine: false, body: sampleLine(sample, turn), at: new Date().toISOString() }), 600);
  };
  const remove = () => {
    window.clearTimeout(reply.current);
    practiceChat.remove(member, sample.id);
    likedSamples.write(member, now => now.filter(id => id !== sample.id));
    router.push('/app/matches');
  };
  if (!open) {
    return (
      <div className="card empty">
        <h1>{sample.name}</h1>
        <p className="muted">This sample match was removed, so its practice chat is closed.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link className="btn primary" href="/app/discover">Back to Discover</Link>
          <Link className="btn" href="/app/matches">Matches</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="stack">
      <p><Link href="/app/messages">← All messages</Link></p>
      <div className="page-title"><h1>{sample.name}</h1><span className="chip plain">Sample</span></div>
      <p className="note">Practice chat with a sample. Nobody receives these messages; they stay on this device.</p>
      <section aria-label="Messages">
        <div className="thread" role="log" aria-live={live ? 'polite' : 'off'}>
          <div className="bubble"><span className="sr">{sample.name}: </span>{sampleLine(sample, 0)}</div>
          {messages.map((m, i) => (
            <div key={`${m.at}-${m.mine ? 'me' : 'them'}-${i === 0 || messages[i - 1].at !== m.at ? 0 : i}`} className={`bubble${m.mine ? ' mine' : ''}`}>
              <span className="sr">{m.mine ? 'You' : sample.name}: </span>{m.body}
              <time dateTime={m.at}>{clock(m.at)}</time>
            </div>
          ))}
          <div ref={end} />
        </div>
        <form className="composer" onSubmit={event => { event.preventDefault(); send(); }}>
          <label className="sr" htmlFor="practice-body">Message</label>
          <textarea id="practice-body" required maxLength={1500} rows={1} placeholder="Write a message" value={draft} onChange={event => setDraft(event.target.value)} />
          <button className="btn primary">Send</button>
        </form>
      </section>
      <p><button className="btn small" onClick={remove}>Remove this sample match</button></p>
    </div>
  );
}
