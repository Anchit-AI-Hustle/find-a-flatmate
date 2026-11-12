import Link from 'next/link';
import { ListingForm } from '@/components/listing-form';
import { me } from '@/lib/db';

export const metadata = { title: 'List a room' };
export default async function NewListing() {
  await me();
  return (
    <div className="stack">
      <p><Link href="/app/listings">← My listings</Link></p>
      <h1>List a room</h1>
      <p className="lede">Save a draft first. You’ll add photos and submit it for review on the next screen.</p>
      <ListingForm />
    </div>
  );
}
