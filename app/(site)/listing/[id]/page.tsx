import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { Receipt } from '@/components/costs';
import { RoomFacts } from '@/components/rooms';
import { publicRooms } from '@/lib/db';
import { dateText, uuid } from '@/lib/validate';

export const revalidate = 120;
type Props = { params: Promise<{ id: string }> };
const load = cache(async (raw: string) => {
  const id = uuid.safeParse(raw);
  if (!id.success) return null;
  return (await publicRooms(undefined, undefined, id.data))?.[0] ?? null;
});
export async function generateMetadata({ params }: Props) {
  const room = await load((await params).id);
  return room ? { title: room.title, description: 'Room listing with itemised monthly and move-in costs.' } : { title: 'Listing unavailable', robots: { index: false } };
}
/** Public preview: safe fields only. Photos, house rules and contact need a signed-in, active member. */
export default async function Page({ params }: Props) {
  const room = await load((await params).id);
  if (!room) notFound();
  return (
    <div className="narrow">
      <div className="page-head">
        <p className="eyebrow">Room listing</p>
        <h1>{room.title}</h1>
        <RoomFacts room={room} />
      </div>
      <div className="stack section">
        <Receipt costs={room} />
        <p className="muted">Available {dateText(room.available_from)} to {dateText(room.available_until)}.{room.confirmed_at ? ` The poster last confirmed availability on ${dateText(room.confirmed_at)}.` : ''}</p>
        <div className="note">
          <p><strong>Sign in to see photos, house rules and how well this home fits you.</strong> The exact address is never public; the poster can share it only for a confirmed visit.</p>
        </div>
        <div className="row">
          <Link className="btn primary" href={`/app/rooms/${room.id}`}>See full listing</Link>
          <Link className="btn" href="/safety">Safety checklist</Link>
        </div>
      </div>
    </div>
  );
}
