import Link from 'next/link';
import { ActionForm } from '@/components/form';
import { Art } from '@/components/site';
import { me } from '@/lib/db';

export const metadata = { title: 'Find a home together' };
export default async function Group() {
  await me();
  return (
    <div className="card empty">
      <Art name="together" width={960} height={720} />
      <h1>Group search is coming later</h1>
      <p className="muted">Shared shortlists and group compatibility aren’t built yet, and we won’t pretend they are. Today you can match one-to-one with people who also want to find a home together.</p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <Link className="btn primary" href="/app/discover?intent=find_together">See people finding a home together</Link>
        <ActionForm op="waitlist" submit="Join my city’s waitlist" small className="inline-form" />
      </div>
    </div>
  );
}
