import { INQUIRY_KIND_LABELS, type InquiryKind } from './inquiry.ts';

/**
 * The email that tells a creator's team a new inquiry arrived. Pure: built
 * from the stored inquiry, sent by the services layer. The sender agreed that
 * the creator and their team may reply by email, so their address is included
 * and set as reply-to.
 */
export interface InquiryNotice {
  readonly publicName: string;
  readonly kind: InquiryKind;
  readonly name: string;
  readonly email: string;
  readonly organization: string | null;
  readonly message: string;
  /** Absolute link to the Inquiries page. */
  readonly inboxUrl: string;
}

export interface EmailContent {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
/** One line, no control characters: subjects and headers must not break. */
const oneLine = (s: string, max: number) => s.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export function inquiryNotificationEmail(n: InquiryNotice): EmailContent {
  const kind = INQUIRY_KIND_LABELS[n.kind];
  const from = n.organization ? `${oneLine(n.name, 80)} (${oneLine(n.organization, 80)})` : oneLine(n.name, 80);
  const subject = `New inquiry: ${kind} from ${from}`.slice(0, 160);
  const text = [
    `${oneLine(n.publicName, 80)}, you have a new inquiry on your GenCut Famous media kit.`,
    '',
    `Type: ${kind}`,
    `From: ${from}`,
    `Email: ${oneLine(n.email, 254)}`,
    '',
    n.message.trim(),
    '',
    `Reply to this email to answer ${oneLine(n.name, 80)} directly, or see all inquiries: ${n.inboxUrl}`,
  ].join('\n');
  const html = `<!doctype html><html><body style="margin:0;background:#f3efff;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1b1035">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
<p style="margin:0 0 4px;color:#5b2be0;font-weight:700">GenCut Famous</p>
<h1 style="margin:0 0 20px;font-size:24px">New inquiry: ${escape(kind)}</h1>
<div style="background:#fff;border-radius:16px;padding:20px">
<p style="margin:0 0 4px"><strong>${escape(from)}</strong></p>
<p style="margin:0 0 16px"><a href="mailto:${escape(oneLine(n.email, 254))}" style="color:#5b2be0">${escape(oneLine(n.email, 254))}</a></p>
<p style="margin:0;white-space:pre-wrap;line-height:1.5">${escape(n.message.trim())}</p>
</div>
<p style="margin:20px 0"><a href="${escape(n.inboxUrl)}" style="display:inline-block;background:#5b2be0;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px">Open inquiries</a></p>
<p style="margin:0;color:#5d5279;font-size:14px">Reply to this email to answer ${escape(oneLine(n.name, 80))} directly. You get this because you are on ${escape(oneLine(n.publicName, 80))}'s team on GenCut Famous.</p>
</div></body></html>`;
  return { subject, text, html };
}
