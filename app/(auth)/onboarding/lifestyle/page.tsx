import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ActionForm } from '@/components/form';
import { LifestyleFields } from '@/components/lifestyle';
import { profile, requireSession } from '@/lib/db';
import type { Answers } from '@/lib/matching';

export const metadata = { title: 'How you live', robots: { index: false } };
export default async function Lifestyle() {
  const { db } = await requireSession();
  const p = await profile();
  if (!p) redirect('/onboarding/basics');
  if (p.status === 'suspended' || p.status === 'closed') redirect('/app/settings/data');
  const { data } = await db.rpc('own_answers');
  const editing = p.status !== 'draft';
  return (
    <div className="stack">
      {editing ? <p><Link href="/app/profile">← Back to profile</Link></p> : <ol className="stepper" aria-label="Step 3 of 4"><li className="done" /><li className="done" /><li className="done" /><li /></ol>}
      <h1>How you live</h1>
      <p className="lede">Tell us your own habit and what you’d like in a home. Mark something a dealbreaker only if you truly couldn’t live with the alternative.</p>
      <ActionForm op="lifestyle" submit={editing ? 'Save answers' : 'Continue'}>
        {editing ? <input type="hidden" name="editing" value="yes" /> : null}
        <LifestyleFields initial={(data ?? {}) as Answers} />
      </ActionForm>
    </div>
  );
}
