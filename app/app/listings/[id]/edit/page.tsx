import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/form';
import { ListingForm } from '@/components/listing-form';
import { Photo } from '@/components/room-card';
import { expandedListing, me, type Listing } from '@/lib/db';
import { uuid } from '@/lib/validate';

export const metadata = { title: 'Edit listing' };
export default async function EditListing({ params }: { params: Promise<{ id: string }> }) {
  const id = uuid.safeParse((await params).id);
  if (!id.success) notFound();
  const { db, user } = await me();
  const { data: l } = await db.from('listings').select(expandedListing).eq('id', id.data).eq('owner_id', user.id).maybeSingle<Listing>();
  if (!l || l.status === 'filled' || l.status === 'removed') notFound();
  const photos = l.listing_images ?? [];
  const draft = l.status === 'draft';
  return (
    <div className="stack">
      <p><Link href="/app/listings">← My listings</Link></p>
      <h1>Edit listing</h1>
      <section className="card stack" aria-labelledby="photos">
        <h2 id="photos">Photos ({photos.length} of 6)</h2>
        {photos.length ? (
          <div className="thumbs">
            {photos.map((p, n) => (
              <figure key={p.id}>
                <Photo id={p.id} alt={`Listing photo ${n + 1}`} />
                {draft ? <ActionForm op="removePhoto" submit="Remove" small variant="plain" quiet confirm="Remove this photo?"><input type="hidden" name="id" value={p.id} /></ActionForm> : null}
              </figure>
            ))}
          </div>
        ) : <p className="muted">No photos yet. A listing needs at least one before it can be reviewed.</p>}
        {draft ? (
          photos.length < 6 ? (
            <ActionForm op="upload" submit="Upload photo" small pendingLabel="Uploading…">
              <input type="hidden" name="id" value={l.id} />
              <div className="field"><label htmlFor="photo">Add a photo (JPG, PNG or WebP, under 2.5 MB)</label><input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required /></div>
              <label className="check" style={{ marginBottom: 12 }}><input type="checkbox" name="permission" required />I took this photo or have permission to use it, and it shows no people or documents.</label>
            </ActionForm>
          ) : null
        ) : <p className="small muted">Photos can be changed only while the listing is a draft. Saving any change below returns it to draft.</p>}
        <p className="hint">Photos are re-encoded on upload, which removes embedded location and device data.</p>
      </section>
      {draft ? (
        <section className="card stack" aria-labelledby="submit">
          <h2 id="submit">Submit for review</h2>
          <p className="muted">A moderator checks every listing before it goes live. Submitting also confirms the room is available today.</p>
          <ActionForm op="listingState" submit="Submit for review" pendingLabel="Submitting…"><input type="hidden" name="id" value={l.id} /><input type="hidden" name="action" value="submit" /></ActionForm>
        </section>
      ) : null}
      <ListingForm listing={l} />
    </div>
  );
}
