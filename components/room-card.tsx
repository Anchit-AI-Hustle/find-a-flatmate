import Link from 'next/link';
import type { Listing } from '@/lib/db';
import type { matchRoom } from '@/lib/matching';
import { Price } from './costs';
import { Fit, Score } from './fit';
import { InterestActions, SaveButton, type Relation } from './people';
import { RoomFacts } from './rooms';

export function Photo({ id, alt }: { id: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- private, authenticated, no-store media route
  return <img src={`/api/media/${id}`} alt={alt} loading="lazy" decoding="async" width={800} height={600} />;
}
export function RoomCard({ listing, result, relation, saved }: { listing: Listing; result: ReturnType<typeof matchRoom>; relation: Relation; saved: boolean }) {
  const first = listing.listing_images?.[0];
  return (
    <article className="card result">
      {first ? <div className="photo-strip" style={{ gridAutoColumns: '100%' }}><Photo id={first.id} alt={`Photo of ${listing.title}`} /></div> : null}
      <div className="head">
        <div style={{ minWidth: 0 }}>
          <h3><Link href={`/app/rooms/${listing.id}`}>{listing.title}</Link></h3>
          <Price costs={listing} />
        </div>
        <Score result={result} />
      </div>
      <RoomFacts room={listing} />
      <Fit result={result} />
      <div className="row between">
        <InterestActions target={listing.owner_id} listing={listing.id} relation={relation} />
        <SaveButton kind="listing" target={listing.id} saved={saved} />
      </div>
    </article>
  );
}
