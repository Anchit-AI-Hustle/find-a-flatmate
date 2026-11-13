'use client';
import { useActionState, useState } from 'react';
import { login, type State } from '@/lib/actions';

export function LoginForm() {
  const [mode, setMode] = useState<'magic' | 'signup' | 'signin'>('magic');
  const [state, run, pending] = useActionState<State, FormData>(login, {});

  if (state.success) return <p className="note" role="status">{state.success}</p>;

  return (
    <form action={run} className="stack">
      <input type="hidden" name="mode" value={mode} />
      <div className="row" style={{ gap: '0.5rem' }}>
        <button type="button" className={mode === 'magic' ? 'btn primary' : 'btn'} onClick={() => setMode('magic')}>Magic link</button>
        <button type="button" className={mode === 'signup' ? 'btn primary' : 'btn'} onClick={() => setMode('signup')}>Sign up</button>
        <button type="button" className={mode === 'signin' ? 'btn primary' : 'btn'} onClick={() => setMode('signin')}>Sign in</button>
      </div>

      {mode === 'signup' ? (
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input id="name" name="name" type="text" autoComplete="name" required placeholder="Your name" />
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required placeholder="you@example.com" />
        {mode === 'magic' ? <span className="hint">We’ll email you a one-time sign-in link. No password needed.</span> : null}
      </div>

      {mode !== 'magic' ? (
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required placeholder="At least 8 characters" />
        </div>
      ) : null}

      <button className="btn primary block" disabled={pending}>
        {pending
          ? mode === 'magic'
            ? 'Sending link…'
            : 'Please wait…'
          : mode === 'magic'
          ? 'Email me a sign-in link'
          : mode === 'signup'
          ? 'Create account'
          : 'Sign in'}
      </button>
      <div aria-live="polite">{state.error ? <p className="note error" role="alert">{state.error}</p> : null}</div>
    </form>
  );
}
