'use client';

import { inquiryConsentText } from '@gencut/core';
import { useActionState, useEffect, useState } from 'react';
import { type InquiryState, sendInquiry } from './actions.ts';

export function InquiryForm({ handle, publicName, kinds }: { handle: string; publicName: string; kinds: Array<[string, string]> }) {
  const [state, action, pending] = useActionState<InquiryState, FormData>(sendInquiry, { status: 'idle' });
  const [src, setSrc] = useState('');
  useEffect(() => setSrc(new URLSearchParams(window.location.search).get('src') ?? ''), []);
  if (state.status === 'sent') {
    return <p role="status" className="mt-3 rounded-xl bg-paper p-4">Sent. {publicName} or their team will reply by email.</p>;
  }
  const e = state.status === 'error' ? state.fields : {};
  return (
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2" noValidate>
      <input type="hidden" name="handle" value={handle} />
      <input type="hidden" name="src" value={src} />
      <div className="absolute -left-[9999px]" aria-hidden><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
        About
        <select name="kind" className="field" defaultValue="" aria-invalid={Boolean(e.kind)}>
          <option value="" disabled>Choose one</option>
          {kinds.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        {e.kind && <span className="error-text">{e.kind}</span>}
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">Your name<input name="name" className="field" autoComplete="name" maxLength={120} aria-invalid={Boolean(e.name)} />{e.name && <span className="error-text">{e.name}</span>}</label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">Email<input name="email" type="email" className="field" autoComplete="email" aria-invalid={Boolean(e.email)} />{e.email && <span className="error-text">{e.email}</span>}</label>
      <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">Company or publication (optional)<input name="organization" className="field" autoComplete="organization" maxLength={120} /></label>
      <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">Message<textarea name="message" className="field-area" maxLength={2000} aria-invalid={Boolean(e.message)} />{e.message && <span className="error-text">{e.message}</span>}</label>
      <label className="flex items-start gap-3 text-sm sm:col-span-2">
        <input type="checkbox" name="consent" className="mt-0.5 size-5 shrink-0 accent-bay" aria-invalid={Boolean(e.consent)} />
        <span>{inquiryConsentText(publicName)} <a href="/privacy" className="underline">Privacy</a></span>
      </label>
      {e.consent && <p className="error-text sm:col-span-2">{e.consent}</p>}
      {state.status === 'error' && !Object.keys(e).length && <p role="alert" className="error-text sm:col-span-2">{state.message}</p>}
      <button type="submit" disabled={pending} className="btn sm:col-span-2">{pending ? 'Sending…' : 'Send inquiry'}</button>
    </form>
  );
}
