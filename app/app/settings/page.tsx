import Link from 'next/link';
import { requireSession } from '@/lib/db';
import { logout } from '@/lib/actions';

export const metadata = { title: 'Settings' };
export default async function Settings() {
  const { user } = await requireSession();
  return (
    <div className="stack">
      <div className="page-title"><h1>Settings</h1></div>
      <p className="muted">Signed in as {user.email}.</p>
      <nav className="stack" aria-label="Settings">
        <Link className="list-link" href="/app/settings/privacy"><span className="grow"><strong>Privacy and visibility</strong><br /><span className="small muted">Pause your profile, hide from Discover, analytics and reminders</span></span><span aria-hidden="true">→</span></Link>
        <Link className="list-link" href="/app/settings/data"><span className="grow"><strong>Data and support</strong><br /><span className="small muted">Download your data, contact support, appeal, close your account</span></span><span aria-hidden="true">→</span></Link>
        <Link className="list-link" href="/safety"><span className="grow"><strong>Safety checklist</strong></span><span aria-hidden="true">→</span></Link>
        <Link className="list-link" href="/help"><span className="grow"><strong>Help</strong></span><span aria-hidden="true">→</span></Link>
      </nav>
      <form action={logout}><button className="btn">Sign out</button></form>
    </div>
  );
}
