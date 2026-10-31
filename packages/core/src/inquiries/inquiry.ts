/**
 * Inquiries sent from a creator's public profile ("Work with me"). The sender
 * asks to be contacted; the exact consent text they agreed to is stored with
 * the message. Pure rules only.
 */
export const INQUIRY_KINDS = ['brand_partnership', 'press', 'collaboration', 'speaking', 'other'] as const;
export type InquiryKind = (typeof INQUIRY_KINDS)[number];

export const INQUIRY_KIND_LABELS: Readonly<Record<InquiryKind, string>> = {
  brand_partnership: 'Brand partnership',
  press: 'Press or media',
  collaboration: 'Creator collaboration',
  speaking: 'Speaking or events',
  other: 'Something else',
};

export const INQUIRY_CONSENT_VERSION = 'inquiry-consent-v1';

/** The consent sentence shown beside the checkbox and stored with every inquiry. */
export function inquiryConsentText(publicName: string): string {
  return `I agree that ${publicName} and their team may reply to me by email about this inquiry, and that GenCut stores this message and my contact details for them. I can ask for it to be deleted at any time.`;
}

/** Abuse limits: per sender per day, and per profile per day. */
export const INQUIRY_LIMIT_PER_SENDER_PER_DAY = 5;
export const INQUIRY_LIMIT_PER_PROFILE_PER_DAY = 200;

/** Referral source from a `?src=` value: lowercase word, or null. Never a URL or free text. */
export function normalizeReferral(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim().toLowerCase();
  return /^[a-z0-9_-]{2,24}$/.test(v) ? v : null;
}

/** Host of a referring page, without path or query, so no personal URL details are stored. */
export function referrerHost(raw: string | null | undefined, ownHost: string | null): string | null {
  if (!raw) return null;
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
    if (!host || (ownHost && host === ownHost.toLowerCase().replace(/^www\./, ''))) return null;
    return host.slice(0, 120);
  } catch {
    return null;
  }
}
