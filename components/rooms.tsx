import Link from 'next/link';
import { BadgeCheck, CalendarDays, MapPin } from 'lucide-react';
import { areaName, cities, roomTypes, type City } from '@/lib/catalog';
import type { PublicRoom } from '@/lib/db';
import { dateText } from '@/lib/validate';
import { Price } from './costs';

export function RoomFacts({ room }: { room: PublicRoom }) {
  return (
    <ul className="facts">
      <li className="chip plain"><MapPin size={14} aria-hidden="true" />{areaName(room.city_id, room.locality_id)}, {cities[room.city_id as City]?.name ?? room.city_id}</li>
      <li className="chip plain">{roomTypes[room.room_type as keyof typeof roomTypes] ?? room.room_type}</li>
      <li className="chip plain"><CalendarDays size={14} aria-hidden="true" />From {dateText(room.available_from)}</li>
      {room.reviewed_at ? <li className="chip"><BadgeCheck size={14} aria-hidden="true" />Moderator reviewed</li> : null}
    </ul>
  );
}
/** Sanitised public card: locality only, never an address, photo or contact detail. */
export function PublicRoomCard({ room }: { room: PublicRoom }) {
  return (
    <article className="card result">
      <h3><Link href={`/listing/${room.id}`}>{room.title}</Link></h3>
      <RoomFacts room={room} />
      <Price costs={room} />
      {room.confirmed_at ? <p className="small muted" style={{ margin: 0 }}>Availability confirmed by the poster on {dateText(room.confirmed_at)}.</p> : null}
    </article>
  );
}
