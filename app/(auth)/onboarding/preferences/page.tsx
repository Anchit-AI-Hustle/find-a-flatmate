import { redirect } from 'next/navigation';
import { ActionForm } from '@/components/form';
import { PrivacyFields } from '@/components/privacy-fields';
import { profile, requireSession } from '@/lib/db';

export const metadata = { title: 'Privacy choices', robots: { index: false } };
export default async function Preferences() {
  await requireSession();
  const p = await profile();
  if (!p) redirect('/onboarding/basics');
  if (p.status !== 'draft') redirect('/app/settings/privacy');
  return (
    <div className="stack">
      <ol className="stepper" aria-label="Step 4 of 4"><li className="done" /><li className="done" /><li className="done" /><li className="done" /></ol>
      <h1>Your privacy choices</h1>
      <p className="lede">Your email, phone number and address are never shown to other members. Choose the rest.</p>
      <ActionForm op="privacy" submit="Finish and activate my profile" className="card">
        <input type="hidden" name="status" value="active" />
        <input type="hidden" name="onboarding" value="yes" />
        <PrivacyFields discoverable analytics={false} reminders={false} />
      </ActionForm>
    </div>
  );
}
