'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { sampleLine, type SampleInfo } from '@/lib/samples';
import { likedSamples, practiceChat, usePracticeChat } from './sample-store';

const clock = (at: string) => new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date(at));

/** A chat with a sample match, for practice. Messages never leave this browser and the replies are a short fixed script. */
export function SampleChat({ sample, member }: { sample: SampleInfo; member: string }) {
  const router = useRouter();
  const messages = usePracticeChat(member, sample.id);
  const [draft, setDraft] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);
  const send = () => {
    const body = draft.trim().slice(0, 1500);
    if (!body) return;
    const turn = messages.filter(m => m.mine).length + 1;
    practiceChat.add(member, sample.id, { mine: true, body, at: new Date().toISOString() });
    setDraft('');
    window.setTimeout(() => practiceChat.add(member, sample.id, { mine: false, body: sampleLine(sample, turn), at: new Date().toISOString() }), 600);
  };
  const remove = () => {
    practiceChat.remove(member, sample.id);
    likedSamples.write(now => now.filter(id => id !== sample.id));
    router.push('/app/matches');
  };
  return (
    <div className="stack">
      <p><Link href="/app/messages">← All messages</Link></p>
      <div className="page-title"><h1>{sample.name}</h1><span className="chip plain">Sample</span></div>
      <p className="note">Practice chat with a sample. Nobody receives these messages; they stay on this device.</p>
      <section aria-label="Messages">
        <div className="thread" role="log" aria-live="polite">
          <div className="bubble"><span className="sr">{sample.name}: </span>{sampleLine(sample, 0)}</div>
          {messages.map((m, i) => (
            <div key={i} className={`bubble${m.mine ? ' mine' : ''}`}>
              <span className="sr">{m.mine ? 'You' : sample.name}: </span>{m.body}
              <time dateTime={m.at}>{clock(m.at)}</time>
            </div>
          ))}
          <div ref={end} />
        </div>
        <form className="composer" onSubmit={event => { event.preventDefault(); send(); }}>
          <label className="sr" htmlFor="practice-body">Message</label>
          <textarea
            id="practice-body" required maxLength={1500} rows={1} placeholder="Write a message" value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }}
          />
          <button className="btn primary">Send</button>
        </form>
      </section>
      <p><button className="btn small" onClick={remove}>Remove this sample match</button></p>
    </div>
  );
}
