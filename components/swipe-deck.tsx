'use client';
import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';
import { Heart, Info, RotateCcw, X } from 'lucide-react';
import { action } from '@/lib/actions';

export type DeckItem = { key: string; target: string; listing?: string; name: string; href: string; card: React.ReactNode };
type Choice = 'like' | 'pass';

/** One card at a time: drag or tap ♥ / ✕ (or use the arrow keys). Every choice is saved through the same server action as the list view. */
export function SwipeDeck({ items, empty, matchArt }: { items: DeckItem[]; empty: React.ReactNode; matchArt: React.ReactNode }) {
  const [gone, setGone] = useState<string[]>([]);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<Choice | null>(null);
  const [error, setError] = useState('');
  const [said, setSaid] = useState('');
  const [match, setMatch] = useState<{ name: string; chat: string } | null>(null);
  const [lastPass, setLastPass] = useState<DeckItem | null>(null);
  const [busy, start] = useTransition();
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const queue = items.filter(i => !gone.includes(i.key));
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
    start(async () => {
      const result = await send(item, choice);
      setLeaving(null);
      setDx(0);
      if (result.error) { setError(result.error); return; }
      setGone(g => [...g, item.key]);
      setLastPass(choice === 'pass' ? item : null);
      setSaid(choice === 'like' ? `Liked ${item.name}.` : `Passed on ${item.name}.`);
      if (result.match) setMatch({ name: item.name, chat: result.match });
    });
  };
  const undo = () => {
    if (!lastPass || busy) return;
    const item = lastPass;
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
      <div className="deck-match" role="alertdialog" aria-labelledby="match-title">
        {matchArt}
        <h2 id="match-title">It’s a match!</h2>
        <p className="muted">You and {match.name} both said yes.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link className="btn primary" href={`/app/messages/${match.chat}`}>Say hello</Link>
          <button className="btn" onClick={() => setMatch(null)}>Keep swiping</button>
        </div>
      </div>
    );
  }
  if (!top) return <>{empty}{lastPass ? <p style={{ textAlign: 'center' }}><button className="btn small" onClick={undo} disabled={busy}><RotateCcw size={16} aria-hidden="true" /> Undo last pass</button></p> : null}</>;

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
          aria-label={top.name}
          onPointerDown={event => { if (event.button === 0 && !busy) { drag.current = { x: event.clientX, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); } }}
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
        <button className="round small" onClick={undo} disabled={!lastPass || busy} aria-label="Undo last pass"><RotateCcw size={20} aria-hidden="true" /></button>
        <button className="round no" onClick={() => choose('pass')} disabled={busy} aria-label={`Pass on ${top.name}`}><X size={30} aria-hidden="true" /></button>
        <button className="round yes" onClick={() => choose('like')} disabled={busy} aria-label={`Like ${top.name}`}><Heart size={30} aria-hidden="true" /></button>
        <Link className="round small" href={top.href} aria-label={`More about ${top.name}`}><Info size={20} aria-hidden="true" /></Link>
      </div>
      <p className="deck-count small muted">{queue.length} to go</p>
      <p className="sr" role="status">{said}</p>
      {error ? <p className="note error" role="alert">{error}</p> : null}
    </div>
  );
}
