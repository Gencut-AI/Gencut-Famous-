'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { type CodeState, type SignInState, sendSignInLink, signInWithGoogle, verifySignInCode } from './actions.ts';

export function SignInForm({ next, google }: { next: string; google: boolean }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(sendSignInLink, { status: 'idle' });

  if (state.status === 'sent') return <CodeForm email={state.email} next={next} />;

  return (
    <div className="flex flex-col gap-6">
      {google && (
        <>
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={next} />
            <GoogleButton />
          </form>
          <p className="flex items-center gap-3 text-sm text-ink-soft" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            or use your email
            <span className="h-px flex-1 bg-line" />
          </p>
        </>
      )}
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
        <button type="submit" disabled={pending} className="btn h-14 text-lg">
          {pending ? 'Sending…' : 'Email me a sign-in link'}
        </button>
        <p className="text-sm text-ink-soft">New to GenCut? Either way creates your account.</p>
      </form>
    </div>
  );
}

function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-quiet h-14 w-full text-lg">
      {pending ? 'Opening Google…' : 'Continue with Google'}
    </button>
  );
}

function CodeForm({ email, next }: { email: string; next: string }) {
  const [state, action, pending] = useActionState<CodeState, FormData>(verifySignInCode, { status: 'idle' });
  const [resent, resend, resending] = useActionState<SignInState, FormData>(sendSignInLink, { status: 'idle' });

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-panel bg-lilac/70 p-6" role="status">
        <h2 className="display text-2xl font-semibold">Check your inbox</h2>
        <p className="mt-2 text-ink-soft">
          We sent an email to <strong className="text-ink">{email}</strong>. Tap the link in it, or type the code from it
          here. Not there after a minute? Check your spam or promotions folder.
        </p>
      </div>
      <form action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        <label htmlFor="code" className="text-sm font-medium">
          Code from the email
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={14}
          required
          aria-invalid={state.status === 'error'}
          aria-describedby={state.status === 'error' ? 'code-error' : undefined}
          className="field h-14 text-center text-2xl tracking-[0.3em]"
        />
        {state.status === 'error' && (
          <p id="code-error" className="text-sm text-[#c0264f]">
            {state.message}
          </p>
        )}
        <button type="submit" disabled={pending} className="btn h-14 text-lg">
          {pending ? 'Checking…' : 'Sign in'}
        </button>
      </form>
      <form action={resend} className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        <button type="submit" disabled={resending} className="font-medium text-royal underline-offset-4 hover:underline">
          {resending ? 'Sending…' : 'Send a new email'}
        </button>
        <a href={`/sign-in?next=${encodeURIComponent(next)}`} className="text-ink-soft underline-offset-4 hover:underline">
          Use a different email
        </a>
        {resent.status === 'sent' && (
          <p className="w-full text-ink-soft" role="status">
            Sent. Use the newest email; earlier links and codes stop working.
          </p>
        )}
        {resent.status === 'error' && (
          <p className="w-full text-[#c0264f]" role="alert">
            {resent.message}
          </p>
        )}
      </form>
    </div>
  );
}
