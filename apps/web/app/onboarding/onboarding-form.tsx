'use client';

import { useActionState, useState } from 'react';
import { Field } from '../_ui/field.tsx';
import { type FormState, idle } from '../_ui/form.ts';
import { startCreator } from './actions.ts';

export function OnboardingForm({ publicBase }: { publicBase: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(startCreator, idle);
  const [handle, setHandle] = useState('');
  const err = state.status === 'error' ? state.fields : {};
  const shown = handle.trim().replace(/^@+/, '').toLowerCase() || 'yourname';
  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <Field id="publicName" label="Name you publish under" hint="Your creator name, exactly as your audience knows it." error={err.publicName}>
        <input id="publicName" name="publicName" className="field" autoComplete="nickname" required maxLength={80} aria-invalid={Boolean(err.publicName)} />
      </Field>
      <Field id="handle" label="Your GenCut handle" hint={`Your media kit will live at ${publicBase.replace(/^https?:\/\//, '')}/@${shown}`} error={err.handle}>
        <div className="flex items-center rounded-xl border border-line bg-white focus-within:border-royal">
          <span className="pl-4 text-ink-soft">@</span>
          <input
            id="handle"
            name="handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            className="h-12 w-full bg-transparent pr-4 pl-1 text-base outline-none"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            maxLength={31}
            aria-invalid={Boolean(err.handle)}
          />
        </div>
      </Field>
      <div className="flex flex-col gap-1.5">
        <label className="flex items-start gap-3 text-[0.95rem]">
          <input type="checkbox" name="adult" className="mt-1 size-5 accent-royal" aria-invalid={Boolean(err.adult)} />
          <span>I am 18 or older, or I manage this creator and they are 18 or older.</span>
        </label>
        {err.adult && <p className="error-text">{err.adult}</p>}
      </div>
      {state.status === 'error' && !Object.keys(err).length && <p role="alert" className="error-text">{state.message}</p>}
      <button type="submit" disabled={pending} className="btn h-14 text-lg">
        {pending ? 'Setting up…' : 'Create my workspace'}
      </button>
      <p className="text-sm text-ink-soft">Everything else — bio, audience, look, rates — is optional and can wait.</p>
    </form>
  );
}
