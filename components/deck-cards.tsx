import { CalendarDays, Check, CircleHelp, Heart, MapPin, TriangleAlert, Wallet } from 'lucide-react';
import { areaName, rupees, roomTypes, totals } from '@/lib/catalog';
import type { Listing } from '@/lib/db';
import type { SampleRoom } from '@/lib/samples';
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
type PersonCard = { id: string; display_name: string; city_id: string; localities: string[]; budget_min: number; budget_max: number; move_from: string; move_until: string };
/** Sample cards are practice profiles generated in code; the tag keeps them from being mistaken for a member or a home. */
const SampleTag = () => <span className="sample-tag">Sample</span>;
export function PersonDeckCard({ c, result, likesYou, sample = false }: { c: PersonCard; result: Result; likesYou: boolean; sample?: boolean }) {
  return (
    <>
      <div className="deck-media person">
        <Doodle id={c.id} size={148} /><FitBadge result={result} />
        {sample || likesYou ? <div className="deck-tags">{sample ? <SampleTag /> : null}{likesYou ? <span className="likes-you"><Heart size={14} aria-hidden="true" /> Likes you</span> : null}</div> : null}
      </div>
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
function RoomBody({ title, monthly, incomplete, city, area, type, from, result }: { title: string; monthly: number; incomplete: boolean; city: string; area: string; type: string; from: string; result: Result }) {
  return (
    <div className="deck-body">
      <h2>{title}</h2>
      <p className="price" style={{ margin: 0 }}>{rupees(monthly)} <small>/ month{incomplete ? ' + utilities' : ''}</small></p>
      <ul className="deck-facts">
        <li><MapPin size={16} aria-hidden="true" />{areaName(city, area)}</li>
        <li>{roomTypes[type as keyof typeof roomTypes] ?? type}</li>
        <li><CalendarDays size={16} aria-hidden="true" />From {short(from)}</li>
      </ul>
      <FitLines result={result} />
    </div>
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
      <RoomBody title={l.title} monthly={t.monthly} incomplete={t.incomplete} city={l.city_id} area={l.locality_id} type={l.room_type} from={l.available_from} result={result} />
    </>
  );
}
export function SampleRoomDeckCard({ r, result }: { r: SampleRoom; result: Result }) {
  const t = totals(r.room.costs);
  return (
    <>
      <div className="deck-media"><Art name={r.art} width={960} height={720} /><FitBadge result={result} /><div className="deck-tags"><SampleTag /></div></div>
      <RoomBody title={r.title} monthly={t.monthly} incomplete={t.incomplete} city={r.room.city} area={r.room.areas[0]} type={r.type} from={r.room.from} result={result} />
    </>
  );
}
