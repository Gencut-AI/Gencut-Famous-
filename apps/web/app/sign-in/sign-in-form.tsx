'use client';

import { useActionState } from 'react';
import { type SignInState, sendSignInLink } from './actions.ts';

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(sendSignInLink, { status: 'idle' });

  if (state.status === 'sent') {
    return (
      <div className="rounded-panel bg-lilac/70 p-6" role="status">
        <h2 className="display text-2xl font-semibold">Check your inbox</h2>
        <p className="mt-2 text-ink-soft">
          We sent a sign-in link to <strong className="text-ink">{state.email}</strong>. Open it in this same browser to continue.
          It expires in one hour.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email" className="text-sm font-medium">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.status === 'error' ? state.email : ''}
        aria-invalid={state.status === 'error'}
        aria-describedby={state.status === 'error' ? 'email-error' : undefined}
        className="field h-14 text-lg"
      />
      {state.status === 'error' && (
        <p id="email-error" className="text-sm text-[#c0264f]">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="btn h-14 text-lg"
      >
        {pending ? 'Sending…' : 'Email me a sign-in link'}
      </button>
      <p className="text-sm text-ink-soft">New to GenCut? The same link creates your account.</p>
    </form>
  );
}
