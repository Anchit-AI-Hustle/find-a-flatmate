'use client';
import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';
import { Heart, Info, RotateCcw, X } from 'lucide-react';
import { action } from '@/lib/actions';
import { likedSamples, seenSamples, useSampleIds } from './sample-store';

/**
 * `sample` items are practice cards generated in code: swiping them never calls the server, so nothing is stored or sent.
 * Liking one makes it a practice match, kept in this browser and listed (labelled) in Matches and Chats.
 */
export type DeckItem = { key: string; target: string; listing?: string; name: string; href?: string; card: React.ReactNode; sample?: boolean };
type Choice = 'like' | 'pass';

/** One card at a time: drag or tap ♥ / ✕ (or use the arrow keys). Every choice is saved through the same server action as the list view. */
export function SwipeDeck({ items, empty, matchArt, seen: seenAtLoad = [], liked: likedAtLoad = [] }: { items: DeckItem[]; empty: React.ReactNode; matchArt: React.ReactNode; seen?: string[]; liked?: string[] }) {
  const [gone, setGone] = useState<string[]>([]);
  const seen = useSampleIds(seenSamples, seenAtLoad);
  const liked = useSampleIds(likedSamples, likedAtLoad);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<Choice | null>(null);
  const [error, setError] = useState('');
  const [said, setSaid] = useState('');
  const [match, setMatch] = useState<{ name: string; href: string; sample?: boolean } | null>(null);
  const [lastPass, setLastPass] = useState<DeckItem | null>(null);
  const [busy, start] = useTransition();
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const queue = items.filter(i => !gone.includes(i.key) && !(i.sample && (seen.includes(i.key) || liked.includes(i.key))));
  const top = queue[0];
  const behind = queue[1];

  const send = (item: DeckItem, verb: 'like' | 'pass' | 'reset') => {
    const data = new FormData();
    data.set('target', item.target);
    data.set('action', verb);
    data.set('stay', 'yes');
    if (item.listing && verb === 'like') data.set('listing', item.listing);
    return action('interest', {}, data);
  };
  const choose = (choice: Choice) => {
    if (!top || busy || leaving) return;
    const item = top;
    setError('');
    setLeaving(choice);
    if (item.sample) {
      window.setTimeout(() => {
        setLeaving(null);
        setDx(0);
        seenSamples.write(now => [...now, item.key]);
        setLastPass(choice === 'pass' ? item : null);
        setSaid(choice === 'like' ? `Liked ${item.name}, a sample. Nothing was sent.` : `Passed on ${item.name}, a sample.`);
        // Every liked sample becomes a practice match, so the whole flow (match, Matches, Chats) can be tried.
        if (choice === 'like') { likedSamples.write(now => [...now, item.key]); setMatch({ name: item.name, href: `/app/messages/${item.key}`, sample: true }); }
      }, 240);
      return;
    }
    start(async () => {
      const result = await send(item, choice);
      setLeaving(null);
      setDx(0);
      if (result.error) { setError(result.error); return; }
      setGone(g => [...g, item.key]);
      setLastPass(choice === 'pass' ? item : null);
      setSaid(choice === 'like' ? `Liked ${item.name}.` : `Passed on ${item.name}.`);
      if (result.match) setMatch({ name: item.name, href: `/app/messages/${result.match}` });
    });
  };
  const undo = () => {
    // Undo waits for a swipe that is still animating out, so the two cannot overwrite each other's result.
    if (!lastPass || busy || leaving) return;
    const item = lastPass;
    if (item.sample) {
      seenSamples.write(now => now.filter(k => k !== item.key));
      setLastPass(null);
      setSaid(`Brought back ${item.name}.`);
      return;
    }
    start(async () => {
      const result = await send(item, 'reset');
      if (result.error) { setError(result.error); return; }
      setGone(g => g.filter(k => k !== item.key));
      setLastPass(null);
      setSaid(`Brought back ${item.name}.`);
    });
  };

  if (match) {
    return (
      <div className="deck-match" role="alertdialog" aria-labelledby="match-title" aria-describedby="match-detail">
        {matchArt}
        <h2 id="match-title">It’s a match!</h2>
        <p className="muted" id="match-detail">{match.sample ? `${match.name} is a sample, so this is a practice match. It is in Matches and Chats.` : `You and ${match.name} both said yes.`}</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link className="btn primary" href={match.href}>{match.sample ? 'Try the chat' : 'Say hello'}</Link>
          <button className="btn" onClick={() => setMatch(null)}>Keep swiping</button>
        </div>
      </div>
    );
  }
  if (!top) {
    const samplesSeen = items.some(i => i.sample && seen.includes(i.key) && !liked.includes(i.key));
    return (
      <>
        {empty}
        {lastPass || samplesSeen ? (
          <p className="row" style={{ justifyContent: 'center' }}>
            {lastPass ? <button className="btn small" onClick={undo} disabled={busy}><RotateCcw size={16} aria-hidden="true" /> Undo last pass</button> : null}
            {samplesSeen ? <button className="btn small" onClick={() => { seenSamples.write(now => now.filter(k => !items.some(i => i.key === k))); setLastPass(null); }}>See the samples again</button> : null}
          </p>
        ) : null}
      </>
    );
  }

  const shift = leaving ? (leaving === 'like' ? 520 : -520) : dx;
  return (
    <div
      className="deck"
      onKeyDown={event => {
        if (event.key === 'ArrowRight') { event.preventDefault(); choose('like'); }
        if (event.key === 'ArrowLeft') { event.preventDefault(); choose('pass'); }
      }}
    >
      <div className="deck-stack">
        {behind ? <div className="swipe-card behind" aria-hidden="true" inert>{behind.card}</div> : null}
        <article
          key={top.key}
          className={`swipe-card${leaving ? ' leaving' : dx ? ' dragging' : ''}`}
          style={{ transform: `translateX(${shift}px) rotate(${shift / 24}deg)` }}
          aria-label={top.sample ? `Sample: ${top.name}` : top.name}
          onDragStart={event => event.preventDefault()}
          onPointerDown={event => { if (event.button === 0 && !busy && !leaving) { drag.current = { x: event.clientX, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); } }}
          onPointerMove={event => { if (drag.current) { const d = event.clientX - drag.current.x; if (Math.abs(d) > 6) drag.current.moved = true; if (drag.current.moved) setDx(d); } }}
          onPointerUp={event => { const gesture = drag.current; drag.current = null; if (!gesture?.moved) return; const distance = event.clientX - gesture.x; if (distance > 90) choose('like'); else if (distance < -90) choose('pass'); else setDx(0); }}
          onPointerCancel={() => { drag.current = null; setDx(0); }}
          onClickCapture={event => { if (Math.abs(dx) > 6) { event.preventDefault(); event.stopPropagation(); } }}
        >
          <span className="stamp yes" style={{ opacity: Math.min(1, Math.max(0, shift / 90)) }} aria-hidden="true">Like</span>
          <span className="stamp no" style={{ opacity: Math.min(1, Math.max(0, -shift / 90)) }} aria-hidden="true">Pass</span>
          {top.card}
        </article>
      </div>
      <div className="deck-actions">
        <button className="round small" onClick={undo} disabled={!lastPass || busy || Boolean(leaving)} aria-label="Undo last pass"><RotateCcw size={20} aria-hidden="true" /></button>
        <button className="round no" onClick={() => choose('pass')} disabled={busy || Boolean(leaving)} aria-label={`Pass on ${top.name}${top.sample ? ', a sample' : ''}`}><X size={30} aria-hidden="true" /></button>
        <button className="round yes" onClick={() => choose('like')} disabled={busy || Boolean(leaving)} aria-label={`Like ${top.name}${top.sample ? ', a sample' : ''}`}><Heart size={30} aria-hidden="true" /></button>
        {top.href ? <Link className="round small" href={top.href} aria-label={`More about ${top.name}`}><Info size={20} aria-hidden="true" /></Link> : <span className="round small spacer" aria-hidden="true" />}
      </div>
      <p className="deck-count small muted">{top.sample ? 'Sample for practice · nothing is sent' : `${queue.filter(i => !i.sample).length} to go`}</p>
      <p className="sr" role="status">{said}</p>
      {error ? <p className="note error" role="alert">{error}</p> : null}
    </div>
  );
}
