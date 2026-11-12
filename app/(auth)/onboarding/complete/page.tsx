import Link from 'next/link';
import { Art } from '@/components/site';
import { requireProfile } from '@/lib/db';

export const metadata = { title: 'You’re in', robots: { index: false } };
export default async function Complete() {
  const { profile } = await requireProfile();
  const hasRoom = profile.intent === 'have_room';
  return (
    <div className="stack">
      <Art name="hero" width={1248} height={832} />
      <h1>You’re in, {profile.display_name}.</h1>
      <p className="lede">{hasRoom ? 'Next, list your room with its real costs and house rules. A moderator reviews it before it goes live.' : 'Your profile is active. See who and what fits, with the reasons spelled out.'}</p>
      <div className="row">
        {hasRoom ? <Link className="btn primary" href="/app/listings/new">List my room</Link> : <Link className="btn primary" href="/app/discover">Start discovering</Link>}
        <Link className="btn" href="/app">Go to my overview</Link>
      </div>
      {profile.intent === 'find_together' ? <p className="note">Group search is coming later. For now you can match one-to-one with people who also want to find a home together.</p> : null}
    </div>
  );
}
