'use client';
import Link from 'next/link';
import { Home } from 'lucide-react';
import { sampleInfo } from '@/lib/samples';
import { Doodle } from './doodle';
import { likedSamples, useSampleIds } from './sample-store';

/** Practice matches: the sample cards this member liked. They are listed apart from real matches and always labelled. */
export function SampleMatches({ initial, view, member }: { initial: string[]; view: 'matches' | 'chats'; member: string }) {
  const liked = useSampleIds(likedSamples, initial, member).map(sampleInfo).filter(s => s !== undefined);
  if (!liked.length) return null;
  return (
    <section className="stack section" aria-labelledby="sample-matches">
      <h2 id="sample-matches">{view === 'matches' ? 'Sample matches' : 'Sample chats'}</h2>
      <p className="muted small">For practice only. Samples are not real members, and nothing you write to them is sent.</p>
      {liked.map(s => (
        <Link key={s.id} className="list-link" href={`/app/messages/${s.id}`}>
          {s.kind === 'room' ? <span className="room-avatar" aria-hidden="true"><Home size={24} /></span> : <Doodle id={s.id} />}
          <span className="grow"><strong>{s.name}</strong><br /><span className="small muted">{view === 'matches' ? 'You liked this sample. Practice chat is open.' : 'Practice chat'}</span></span>
          <span className="chip plain">Sample</span>
        </Link>
      ))}
    </section>
  );
}

/**
 * Shows its children (a page's "nothing here yet" card) only while there are no practice matches. The decision is made
 * from the live list, the same one `SampleMatches` draws, so a page restored with Back can never show both or neither.
 */
export function WhenNoSampleMatches({ initial, member, children }: { initial: string[]; member: string; children: React.ReactNode }) {
  return useSampleIds(likedSamples, initial, member).length ? null : children;
}
