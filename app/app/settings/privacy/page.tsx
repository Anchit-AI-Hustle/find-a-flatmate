import Link from 'next/link';
import { ActionForm } from '@/components/form';
import { PrivacyFields } from '@/components/privacy-fields';
import { me } from '@/lib/db';

export const metadata = { title: 'Privacy and visibility' };
export default async function Privacy() {
  const { db, user, profile } = await me();
  const [consent, prefs, blocks] = await Promise.all([
    db.from('user_consents').select('granted').eq('user_id', user.id).eq('purpose', 'analytics').maybeSingle<{ granted: boolean }>(),
    db.from('notification_preferences').select('reminders').eq('user_id', user.id).maybeSingle<{ reminders: boolean }>(),
    db.from('blocks').select('target_id', { count: 'exact', head: true }).eq('actor_id', user.id),
  ]);
  return (
    <div className="stack">
      <p><Link href="/app/settings">← Settings</Link></p>
      <h1>Privacy and visibility</h1>
      <ActionForm op="privacy" submit="Save choices" className="card">
        <div className="field">
          <label htmlFor="status">Profile status</label>
          <select id="status" name="status" defaultValue={profile.status === 'paused' ? 'paused' : 'active'}>
            <option value="active">Active — I’m looking</option>
            <option value="paused">Paused — hide me and pause chats</option>
          </select>
          <span className="hint">While paused, nobody can find you and existing conversations are on hold.</span>
        </div>
        <PrivacyFields discoverable={profile.discoverable} analytics={consent.data?.granted ?? false} reminders={prefs.data?.reminders ?? false} />
      </ActionForm>
      <section className="card">
        <h2>Blocked accounts</h2>
        <p className="muted">You’ve blocked {blocks.count ?? 0} account{blocks.count === 1 ? '' : 's'}. Blocks can’t be undone from the app yet; ask through <Link href="/app/settings/data">Data and support</Link> if you blocked someone by mistake.</p>
      </section>
      <section className="card prose">
        <h2>What others can and can’t see</h2>
        <ul>
          <li><strong>Never shown:</strong> your email, phone number, exact address, and anything you didn’t type into your profile or listing.</li>
          <li><strong>Shown to members who could match with you:</strong> display name, localities, budget range, move-in window and lifestyle answers.</li>
          <li><strong>Shown only to one person:</strong> a visit address you choose to share for a confirmed visit.</li>
        </ul>
      </section>
    </div>
  );
}
