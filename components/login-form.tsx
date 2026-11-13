'use client';

import { useActionState } from 'react';
import { googleLogin, login, type State } from '@/lib/actions';

export function LoginForm({ google, returnTo }: { google: boolean; returnTo?: string }) {
  const [state, run, pending] = useActionState<State, FormData>(login, {});
  const [googleState, runGoogle, googlePending] = useActionState<State, FormData>(googleLogin, {});

  return (
    <div className="stack">
      {google && (
        <form action={runGoogle}>
          {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
          <button className="btn primary block" disabled={googlePending || pending}>
            {googlePending ? 'Opening Google…' : 'Continue with Google'}
          </button>
          {googleState.error && <p className="note error" role="alert">{googleState.error}</p>}
        </form>
      )}
      <form action={run} className="stack">
        {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
        <div className="field">
          <label htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} placeholder="you@example.com" />
          <span className="hint">Use a one-time email link to sign in or create an account.</span>
        </div>
        <button className={google ? 'btn block' : 'btn primary block'} disabled={pending || googlePending}>
          {pending ? 'Sending link…' : 'Email me a sign-in link'}
        </button>
        {state.error && <p className="note error" role="alert">{state.error}</p>}
        {state.success && <p className="note" role="status">{state.success}</p>}
      </form>
    </div>
  );
}
