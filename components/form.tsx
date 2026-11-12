'use client';
import { startTransition, useActionState, useEffect, useRef } from 'react';
import { action, type Op, type State } from '@/lib/actions';

type Props = {
  op: Op; submit: React.ReactNode; children?: React.ReactNode; className?: string;
  variant?: 'primary' | 'plain' | 'danger' | 'ink'; small?: boolean; block?: boolean;
  /** Ask before running a destructive action. */
  confirm?: string;
  /** Hide the generic success line for one-tap buttons whose result is visible on the page. */
  quiet?: boolean;
  /** Clear the fields after success and attach an idempotency key (chat composer). */
  compose?: boolean;
  pendingLabel?: string;
};

/** Every write goes through the validated `action` server handler; this adds pending, error and success states. */
export function ActionForm({ op, submit, children, className, variant = 'primary', small, block, confirm, quiet, compose, pendingLabel = 'Saving…' }: Props) {
  const [state, run, pending] = useActionState<State, FormData>(action.bind(null, op), {});
  const ref = useRef<HTMLFormElement>(null);
  // One idempotency key per message: reused if a send fails and is retried, replaced after success.
  const key = useRef('');
  useEffect(() => {
    if (compose && state.success) { ref.current?.reset(); key.current = ''; }
  }, [compose, state]);
  const cls = ['btn', variant === 'plain' ? '' : variant, small ? 'small' : '', block ? 'block' : ''].filter(Boolean).join(' ');
  return (
    <form
      ref={ref} action={run} className={className}
      onSubmit={event => {
        // Submit through a transition so a validation error does not wipe what the person typed.
        event.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
        if (compose) { key.current ||= crypto.randomUUID(); data.set('request_key', key.current); }
        startTransition(() => run(data));
      }}
    >
      {children}
      <button className={cls} disabled={pending} aria-disabled={pending}>{pending ? pendingLabel : submit}</button>
      <div className="form-msg" aria-live="polite">
        {state.error ? <p className="note error" role="alert">{state.error}</p> : null}
        {state.success && !quiet ? <p className="note">{state.success}</p> : null}
        {state.evidence ? <blockquote className="note warn">{state.evidence}</blockquote> : null}
      </div>
    </form>
  );
}
