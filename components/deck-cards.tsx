import { CalendarDays, Check, CircleHelp, Heart, MapPin, TriangleAlert, Wallet } from 'lucide-react';
import { areaName, rupees, roomTypes, totals } from '@/lib/catalog';
import type { Candidate, Listing } from '@/lib/db';
import type { matchPeople } from '@/lib/matching';
import { dateText } from '@/lib/validate';
import { Doodle } from './doodle';
import { Art } from './site';

type Result = ReturnType<typeof matchPeople>;
const short = (d: string) => dateText(d).replace(/ \d{4}$/, '');

/** The few lines that matter: how well it fits, the best reasons, and one thing to talk about. */
function FitLines({ result }: { result: Result }) {
  const friction = result.potential_friction[0];
  return (
    <ul className="deck-fit">
      {result.top_reasons.slice(0, 2).map(r => <li key={r} className="good"><Check size={16} aria-hidden="true" />{r}</li>)}
      {friction ? <li className="diff"><TriangleAlert size={16} aria-hidden="true" />{friction}</li> : null}
      {result.score === null ? <li className="miss"><CircleHelp size={16} aria-hidden="true" />Not enough answers to score yet</li> : null}
    </ul>
  );
}
function FitBadge({ result }: { result: Result }) {
  return result.score === null ? null : <span className="fit-badge"><b>{result.score}</b><span>fit</span><span className="sr"> out of 100, {result.confidence} confidence</span></span>;
}
export function PersonDeckCard({ c, result, likesYou }: { c: Candidate; result: Result; likesYou: boolean }) {
  return (
    <>
      <div className="deck-media person"><Doodle id={c.id} size={148} /><FitBadge result={result} />{likesYou ? <span className="likes-you"><Heart size={14} aria-hidden="true" /> Likes you</span> : null}</div>
      <div className="deck-body">
        <h2>{c.display_name}</h2>
        <ul className="deck-facts">
          <li><MapPin size={16} aria-hidden="true" />{c.localities.map(a => areaName(c.city_id, a)).join(', ')}</li>
          <li><Wallet size={16} aria-hidden="true" />{rupees(c.budget_min)}–{rupees(c.budget_max)}</li>
          <li><CalendarDays size={16} aria-hidden="true" />{short(c.move_from)} – {short(c.move_until)}</li>
        </ul>
        <FitLines result={result} />
      </div>
    </>
  );
}
export function RoomDeckCard({ l, result }: { l: Listing; result: Result }) {
  const photo = l.listing_images?.[0];
  const t = totals(l);
  return (
    <>
      <div className="deck-media">
        {/* eslint-disable-next-line @next/next/no-img-element -- private, authenticated, no-store media route */}
        {photo ? <img src={`/api/media/${photo.id}`} alt={`Photo of ${l.title}`} draggable={false} /> : <Art name="visit" width={960} height={720} />}
        <FitBadge result={result} />
      </div>
      <div className="deck-body">
        <h2>{l.title}</h2>
        <p className="price" style={{ margin: 0 }}>{rupees(t.monthly)} <small>/ month{t.incomplete ? ' + utilities' : ''}</small></p>
        <ul className="deck-facts">
          <li><MapPin size={16} aria-hidden="true" />{areaName(l.city_id, l.locality_id)}</li>
          <li>{roomTypes[l.room_type as keyof typeof roomTypes] ?? l.room_type}</li>
          <li><CalendarDays size={16} aria-hidden="true" />From {short(l.available_from)}</li>
        </ul>
        <FitLines result={result} />
      </div>
    </>
  );
}
