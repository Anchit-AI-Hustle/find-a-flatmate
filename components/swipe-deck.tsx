'use client';
import Link from 'next/link';
import { useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { Heart, Info, RotateCcw, X } from 'lucide-react';
import { action } from '@/lib/actions';

/** `sample` items are practice cards generated in code: swiping them never calls the server, so nothing is stored or sent. */
export type DeckItem = { key: string; target: string; listing?: string; name: string; href?: string; card: React.ReactNode; sample?: boolean; likesBack?: boolean };
type Choice = 'like' | 'pass';
/**
 * Swiped samples are remembered in a small first-party cookie so they do not come back on the next visit. The cookie is
 * the single source of truth: every write starts from what is stored now, so a second tab or a page restored by the Back
 * button cannot put old samples back or drop newer ones.
 */
const cookieName = 'ff_samples_seen';
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const storedSeen = () => document.cookie.split('; ').find(c => c.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) ?? '';
const parseSeen = (raw: string) => raw.split('.').filter(v => /^[a-z]{1,20}$/.test(v)).map(v => `sample-${v}`);
function storeSeen(change: (now: string[]) => string[]) {
  const next = [...new Set(change(parseSeen(storedSeen())))].map(k => k.replace('sample-', '')).join('.');
  document.cookie = `${cookieName}=${next}; path=/app; max-age=15552000; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`;
  listeners.forEach(listener => listener());
}

/** One card at a time: drag or tap ♥ / ✕ (or use the arrow keys). Every choice is saved through the same server action as the list view. */
export function SwipeDeck({ items, empty, matchArt, seenSamples = [] }: { items: DeckItem[]; empty: React.ReactNode; matchArt: React.ReactNode; seenSamples?: string[] }) {
  const [gone, setGone] = useState<string[]>([]);
  const seenRaw = useSyncExternalStore(subscribe, storedSeen, () => seenSamples.map(k => k.replace('sample-', '')).join('.'));
  const seen = useMemo(() => parseSeen(seenRaw), [seenRaw]);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<Choice | null>(null);
  const [error, setError] = useState('');
  const [said, setSaid] = useState('');
  const [match, setMatch] = useState<{ name: string; chat?: string } | null>(null);
  const [lastPass, setLastPass] = useState<DeckItem | null>(null);
  const [busy, start] = useTransition();
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const queue = items.filter(i => !gone.includes(i.key) && !(i.sample && seen.includes(i.key)));
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
        storeSeen(now => [...now, item.key]);
        setLastPass(choice === 'pass' ? item : null);
        setSaid(choice === 'like' ? `Liked ${item.name}, a sample. Nothing was sent.` : `Passed on ${item.name}, a sample.`);
        if (choice === 'like' && item.likesBack) setMatch({ name: item.name });
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
      if (result.match) setMatch({ name: item.name, chat: result.match });
    });
  };
  const undo = () => {
    // Undo waits for a swipe that is still animating out, so the two cannot overwrite each other's result.
    if (!lastPass || busy || leaving) return;
    const item = lastPass;
    if (item.sample) {
      storeSeen(now => now.filter(k => k !== item.key));
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
        <p className="muted" id="match-detail">{match.chat ? `You and ${match.name} both said yes.` : `${match.name} is a sample. With a real member, a private chat opens here.`}</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          {match.chat ? <Link className="btn primary" href={`/app/messages/${match.chat}`}>Say hello</Link> : null}
          <button className="btn" onClick={() => setMatch(null)}>Keep swiping</button>
        </div>
      </div>
    );
  }
  if (!top) {
    const samplesSeen = items.some(i => i.sample && seen.includes(i.key));
    return (
      <>
        {empty}
        {lastPass || samplesSeen ? (
          <p className="row" style={{ justifyContent: 'center' }}>
            {lastPass ? <button className="btn small" onClick={undo} disabled={busy}><RotateCcw size={16} aria-hidden="true" /> Undo last pass</button> : null}
            {samplesSeen ? <button className="btn small" onClick={() => { storeSeen(now => now.filter(k => !items.some(i => i.key === k))); setLastPass(null); }}>See the samples again</button> : null}
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
