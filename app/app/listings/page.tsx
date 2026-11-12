import Link from 'next/link';
import { Price } from '@/components/costs';
import { ActionForm } from '@/components/form';
import { RoomFacts } from '@/components/rooms';
import { Art } from '@/components/site';
import { expandedListing, me, type Listing } from '@/lib/db';
import { dateText } from '@/lib/validate';

export const metadata = { title: 'My listings' };
const status: Record<string, [string, string, string]> = {
  draft: ['Draft', 'amber', 'Not visible. Add at least one photo, then submit for review.'],
  pending_review: ['In review', 'amber', 'A moderator is checking it. You’ll see it go live here.'],
  active: ['Live', '', 'Visible to matching seekers.'],
  paused: ['Paused', 'plain', 'Hidden. Reconfirm availability to make it live again.'],
  expired: ['Expired', 'coral', 'Hidden because availability wasn’t reconfirmed. Reconfirm to relist.'],
  filled: ['Filled', 'plain', 'Closed. Thanks for telling us.'],
  removed: ['Removed', 'coral', 'Removed by a moderator or with your account.'],
};
export default async function Listings() {
  const { db, user } = await me();
  const { data } = await db.from('listings').select(expandedListing).eq('owner_id', user.id).order('created_at', { ascending: false }).overrideTypes<Listing[], { merge: false }>();
  const listings = data ?? [];
  const act = (id: string, action: string, text: string, variant: 'primary' | 'plain' | 'danger' = 'plain', confirm?: string) => (
    <ActionForm op="listingState" submit={text} small variant={variant} confirm={confirm} quiet className="inline-form"><input type="hidden" name="id" value={id} /><input type="hidden" name="action" value={action} /></ActionForm>
  );
  return (
    <>
      <div className="page-title"><h1>My listings</h1><Link className="btn primary small" href="/app/listings/new">List a room</Link></div>
      {listings.length ? (
        <div className="stack">
          {listings.map(l => {
            const [name, tone, help] = status[l.status] ?? [l.status, 'plain', ''];
            const closed = l.status === 'filled' || l.status === 'removed';
            return (
              <article key={l.id} className="card result">
                <div className="head"><div style={{ minWidth: 0 }}><h2 style={{ fontSize: '1.2rem', margin: 0 }}>{l.title}</h2><Price costs={l} /></div><span className={`chip ${tone}`} style={{ marginLeft: 'auto' }}>{name}</span></div>
                <RoomFacts room={l} />
                <p className="small muted" style={{ margin: 0 }}>{help}{l.status === 'active' && l.expires_at ? ` Reconfirm by ${dateText(l.expires_at)} or it expires.` : ''} {l.listing_images?.length ?? 0} photo{l.listing_images?.length === 1 ? '' : 's'}.</p>
                {closed ? null : (
                  <div className="row">
                    <Link className="btn small" href={`/app/listings/${l.id}/edit`}>{l.status === 'draft' ? 'Edit, add photos and submit' : 'Edit'}</Link>
                    {l.status === 'active' ? act(l.id, 'pause', 'Pause') : null}
                    {['active', 'paused', 'expired'].includes(l.status) && l.reviewed_at ? act(l.id, 'renew', l.status === 'active' ? 'Still available — reconfirm' : 'Reconfirm and relist', 'primary') : null}
                    {act(l.id, 'fill', 'Mark as filled', 'danger', 'Close this listing as filled? This can’t be undone.')}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card empty">
          <Art name="visit" width={960} height={720} />
          <h2>You haven’t listed a room</h2>
          <p className="muted">List a real vacancy with its full costs and house rules. A moderator reviews each listing before it goes live, and it stays live for 21 days at a time.</p>
          <Link className="btn primary" href="/app/listings/new">List a room</Link>
        </div>
      )}
    </>
  );
}
