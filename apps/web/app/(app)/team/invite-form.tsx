'use client';

import { useActionState, useState } from 'react';
import { type InviteState, invite } from './actions.ts';

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(invite, { status: 'idle' });
  const [copied, setCopied] = useState(false);
  if (state.status === 'created') {
    return (
      <div className="flex flex-col gap-3 rounded-xl bg-lilac p-4" role="status">
        <p className="font-semibold">Invitation for {state.email}</p>
        <p className="text-sm text-ink-soft">Send this link yourself; GenCut does not email it. It works once, for 7 days, and only when signed in as {state.email}. It is shown only now.</p>
        <div className="flex gap-2">
          <input readOnly value={state.link} className="field font-mono text-xs" aria-label="Invitation link" onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="btn shrink-0" onClick={() => navigator.clipboard.writeText(state.link).then(() => setCopied(true))}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-2" noValidate>
      <label htmlFor="email" className="text-sm font-medium">Invite a manager</label>
      <div className="flex gap-2">
        <input id="email" name="email" type="email" className="field" placeholder="manager@agency.com" aria-invalid={state.status === 'error'} />
        <button type="submit" disabled={pending} className="btn shrink-0">{pending ? '…' : 'Create link'}</button>
      </div>
      {state.status === 'error' && <p className="error-text">{state.fields.email ?? state.message}</p>}
    </form>
  );
}
