'use client';

import { REFERRAL_LEAD_ROLES, REFERRAL_LEAD_ROLE_LABELS, referralConsentText } from '@gencut/core';
import { useActionState, useEffect, useState } from 'react';
import { type LeadState, sendLead } from './actions.ts';

/** Counts the visit once the page loads in a real browser and remembers the invite for sign-up. */
export function JoinBeacon({ code }: { code: string }) {
  useEffect(() => {
    const body = JSON.stringify({ code, src: new URLSearchParams(window.location.search).get('src') });
    if (!navigator.sendBeacon?.('/api/join/visit', new Blob([body], { type: 'application/json' }))) {
      fetch('/api/join/visit', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => undefined);
    }
  }, [code]);
  return null;
}

export function LeadForm({ code, referrerName }: { code: string; referrerName: string }) {
  const [state, action, pending] = useActionState<LeadState, FormData>(sendLead, { status: 'idle' });
  const [src, setSrc] = useState('');
  useEffect(() => setSrc(new URLSearchParams(window.location.search).get('src') ?? ''), []);
  if (state.status === 'sent') {
    return <p role="status" className="tile text-[0.95rem]">Thanks. GenCut will email you with next steps.</p>;
  }
  const e = state.status === 'error' ? state.fields : {};
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2" noValidate>
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="src" value={src} />
      <div className="absolute -left-[9999px]" aria-hidden><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <label className="flex flex-col gap-1.5 text-sm font-medium">Your name<input name="name" className="field" autoComplete="name" maxLength={120} aria-invalid={Boolean(e.name)} />{e.name && <span className="error-text">{e.name}</span>}</label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">Email<input name="email" type="email" className="field" autoComplete="email" aria-invalid={Boolean(e.email)} />{e.email && <span className="error-text">{e.email}</span>}</label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">Your main handle (optional)<input name="socialHandle" className="field" placeholder="@yourhandle" maxLength={60} autoCapitalize="none" /></label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        I am a
        <select name="role" className="field" defaultValue="" aria-invalid={Boolean(e.role)}>
          <option value="" disabled>Choose one</option>
          {REFERRAL_LEAD_ROLES.map((r) => <option key={r} value={r}>{REFERRAL_LEAD_ROLE_LABELS[r]}</option>)}
        </select>
        {e.role && <span className="error-text">{e.role}</span>}
      </label>
      <label className="flex items-start gap-3 text-sm sm:col-span-2">
        <input type="checkbox" name="consent" className="mt-0.5 size-5 shrink-0 accent-royal" aria-invalid={Boolean(e.consent)} />
        <span>{referralConsentText(referrerName)} <a href="/privacy" className="underline">Privacy</a></span>
      </label>
      {e.consent && <p className="error-text sm:col-span-2">{e.consent}</p>}
      {state.status === 'error' && !Object.keys(e).length && <p role="alert" className="error-text sm:col-span-2">{state.message}</p>}
      <button type="submit" disabled={pending} className="btn-quiet sm:col-span-2">{pending ? 'Sending…' : 'Keep me posted'}</button>
    </form>
  );
}
