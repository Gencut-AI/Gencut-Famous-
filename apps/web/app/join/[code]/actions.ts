'use server';

import { isServiceError, submitReferralLead } from '@gencut/services';
import { headers } from 'next/headers';
import { clientAddress, visitSecret } from '../../../lib/client-ip.ts';
import { db } from '../../../lib/db.ts';

export type LeadState = { status: 'idle' } | { status: 'sent' } | { status: 'error'; message: string; fields: Record<string, string> };

export async function sendLead(_prev: LeadState, form: FormData): Promise<LeadState> {
  // A field people never see; bots fill it. Answer as if sent, store nothing.
  if (String(form.get('website') ?? '')) return { status: 'sent' };
  const h = await headers();
  try {
    const r = await submitReferralLead(db(), String(form.get('code') ?? ''), {
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? '').trim(),
      socialHandle: String(form.get('socialHandle') ?? ''),
      role: String(form.get('role') ?? ''),
      consent: form.get('consent') === 'on',
      src: String(form.get('src') ?? '') || null,
    }, { address: clientAddress(h), userAgent: h.get('user-agent') ?? '' }, visitSecret());
    if (r.status === 'sent') return { status: 'sent' };
    return { status: 'error', message: r.status === 'limited' ? 'Too many sign-ups from here today. Please try again tomorrow.' : 'This invite link is no longer active.', fields: {} };
  } catch (e) {
    if (isServiceError(e)) return { status: 'error', message: e.message, fields: { ...e.fields } };
    throw e;
  }
}
