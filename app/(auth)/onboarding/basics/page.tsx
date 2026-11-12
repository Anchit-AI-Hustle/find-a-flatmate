import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AreaPicker } from '@/components/area-picker';
import { ActionForm } from '@/components/form';
import { intents, today } from '@/lib/catalog';
import { profile, requireSession } from '@/lib/db';

export const metadata = { title: 'Your basics', robots: { index: false } };
const plus = (iso: string, days: number) => new Date(Date.parse(iso) + days * 864e5).toISOString().slice(0, 10);
const rupee = (paise: number) => String(paise / 100);

export default async function Basics({ searchParams }: { searchParams: Promise<{ intent?: string }> }) {
  await requireSession();
  const p = await profile();
  if (p && (p.status === 'suspended' || p.status === 'closed')) redirect('/app/settings/data');
  // An explicit choice in the URL wins; the cookie only carries a choice made before signing in.
  const picked = (await searchParams).intent;
  const carried = !p || p.status === 'draft' ? (await cookies()).get('ff_intent')?.value : undefined;
  const chosen = picked && Object.hasOwn(intents, picked) ? picked : carried;
  const intent = chosen && Object.hasOwn(intents, chosen) ? chosen : p?.intent ?? 'looking_for_room';
  const editing = Boolean(p && p.status !== 'draft');
  const start = today();
  return (
    <div className="stack">
      {editing ? <p><Link href="/app/profile">← Back to profile</Link></p> : <ol className="stepper" aria-label="Step 2 of 4"><li className="done" /><li className="done" /><li /><li /></ol>}
      <h1>{editing ? 'Edit your basics' : 'The basics'}</h1>
      <p className="lede">Just what’s needed to find real matches. We never ask for salary, religion, caste or ID numbers.</p>
      <ActionForm op="basics" submit={editing ? 'Save changes' : 'Continue'} className="card">
        {editing ? <input type="hidden" name="editing" value="yes" /> : null}
        <div className="field">
          <label htmlFor="name">Display name</label>
          <input id="name" name="name" type="text" required minLength={2} maxLength={60} defaultValue={p?.display_name ?? ''} autoComplete="given-name" />
          <span className="hint">Shown to people you could match with. A first name is enough.</span>
        </div>
        <fieldset>
          <legend>I’m here because</legend>
          <div className="checks">
            {Object.entries(intents).map(([id, label]) => (
              <label key={id} className="check"><input type="radio" name="intent" value={id} defaultChecked={id === intent} required />{label}</label>
            ))}
          </div>
        </fieldset>
        <AreaPicker city={p?.city_id ?? 'gurugram'} areas={p?.localities ?? []} />
        <div className="cols">
          <div className="field">
            <label htmlFor="min">Monthly budget from</label>
            <div className="money"><input id="min" name="min" type="text" inputMode="decimal" required pattern="\d{1,6}(\.\d{1,2})?" defaultValue={p ? rupee(p.budget_min) : ''} placeholder="12000" /></div>
          </div>
          <div className="field">
            <label htmlFor="max">Monthly budget up to</label>
            <div className="money"><input id="max" name="max" type="text" inputMode="decimal" required pattern="\d{1,6}(\.\d{1,2})?" defaultValue={p ? rupee(p.budget_max) : ''} placeholder="20000" /></div>
            <span className="hint">Your all-in monthly share: rent, maintenance and bills.</span>
          </div>
          <div className="field">
            <label htmlFor="from">Earliest move-in</label>
            <input id="from" name="from" type="date" required defaultValue={p?.move_from ?? start} />
          </div>
          <div className="field">
            <label htmlFor="until">Latest move-in</label>
            <input id="until" name="until" type="date" required min={start} defaultValue={p?.move_until ?? plus(start, 30)} />
            <span className="hint">Within 180 days of your earliest date.</span>
          </div>
          <div className="field">
            <label htmlFor="months">How long do you plan to stay? (months)</label>
            <input id="months" name="months" type="number" inputMode="numeric" required min={1} max={36} defaultValue={p?.stay_months ?? 11} />
          </div>
        </div>
        <div className="checks" style={{ marginBottom: 16 }}>
          <label className="check"><input type="checkbox" name="adult" required defaultChecked={Boolean(p)} />I confirm I am 18 or older.</label>
          <label className="check"><input type="checkbox" name="terms" required defaultChecked={Boolean(p)} /><span>I agree to the <Link href="/terms" target="_blank">Terms</Link>, <Link href="/community-guidelines" target="_blank">Community guidelines</Link> and <Link href="/privacy" target="_blank">Privacy notice</Link>.</span></label>
        </div>
      </ActionForm>
    </div>
  );
}
