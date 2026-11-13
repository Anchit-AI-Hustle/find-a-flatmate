import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { session } from '@/lib/db';
import { authReady, useNeon } from '@/lib/env';

export const metadata = { title: 'Sign in', robots: { index: false } };
export default async function Login({ searchParams }: { searchParams: Promise<{ expired?: string; returnTo?: string }> }) {
  const { expired, returnTo } = await searchParams;
  if (await session()) {
    redirect(returnTo && /^\/mobile\/authorize\?challenge=[A-Za-z0-9_-]{43}$/.test(returnTo) ? returnTo : '/app');
  }
  return (
    <div className="card stack">
      <div>
        <h1>Sign in or create your account</h1>
        <p className="muted">One step for both. For adults 18 and over.</p>
      </div>
      {expired ? <p className="note warn" role="alert">That sign-in link has expired or was opened in a different browser. Request a new one below.</p> : null}
      {authReady ? <LoginForm google={useNeon} returnTo={returnTo} /> : <p className="note warn">Sign-in is not switched on for this site yet. Nothing you enter here would be saved, so the form is hidden for now.</p>}
      <p className="small muted">By continuing you agree to the <Link href="/terms">Terms</Link>, <Link href="/community-guidelines">Community guidelines</Link> and <Link href="/privacy">Privacy notice</Link>. We verify your email address only.</p>
    </div>
  );
}
