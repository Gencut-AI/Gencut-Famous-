'use server';

import { ResendEmailSender, isServiceError, notifyInquiry, submitInquiry } from '@gencut/services';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { clientAddress, visitSecret } from '../../../lib/client-ip.ts';
import { siteOrigin } from '../../../lib/connectors.ts';
import { db } from '../../../lib/db.ts';

export type InquiryState =
  | { status: 'idle' }
  | { status: 'sent' }
  | { status: 'error'; message: string; fields: Record<string, string> };

export async function sendInquiry(_prev: InquiryState, form: FormData): Promise<InquiryState> {
  // A field people never see; bots fill it. Answer as if sent, store nothing.
  if (String(form.get('website') ?? '')) return { status: 'sent' };
  const h = await headers();
  try {
    const r = await submitInquiry(db(), String(form.get('handle') ?? ''), {
      kind: String(form.get('kind') ?? ''),
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? '').trim(),
      organization: String(form.get('organization') ?? ''),
      message: String(form.get('message') ?? ''),
      consent: form.get('consent') === 'on',
      src: String(form.get('src') ?? '') || null,
    }, { address: clientAddress(h), userAgent: h.get('user-agent') ?? '' }, visitSecret());
    if (r.status === 'sent') {
      // Tell the creator's team by email after the sender has their answer; the inquiry is already saved.
      const sender = ResendEmailSender.fromEnv(process.env);
      if (sender) {
        const inbox = `${await siteOrigin()}/inquiries`;
        after(() => notifyInquiry(db(), r.inquiryId, sender, inbox).then(() => undefined, () => undefined));
      }
      return { status: 'sent' };
    }
    return { status: 'error', message: r.status === 'limited' ? 'Too many messages from here today. Please try again tomorrow.' : 'This creator is not taking inquiries here right now.', fields: {} };
  } catch (e) {
    if (isServiceError(e)) return { status: 'error', message: e.message, fields: { ...e.fields } };
    throw e;
  }
}
