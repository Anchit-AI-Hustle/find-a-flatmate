'use client';
import { useActionState } from 'react';
import { login, type State } from '@/lib/actions';

export function LoginForm() {
  const [state, run, pending] = useActionState<State, FormData>(login, {});
  if (state.success) return <p className="note" role="status">{state.success}</p>;
  return (
    <form action={run}>
      <div className="field">
        <label htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required placeholder="you@example.com" />
        <span className="hint">We’ll email you a one-time sign-in link. No password needed.</span>
      </div>
      <button className="btn primary block" disabled={pending}>{pending ? 'Sending link…' : 'Email me a sign-in link'}</button>
      <div aria-live="polite">{state.error ? <p className="note error" role="alert">{state.error}</p> : null}</div>
    </form>
  );
}
