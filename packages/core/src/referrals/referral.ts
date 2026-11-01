/**
 * Referral links. A creator posts gencut.ai/join/<code> on social media; visits,
 * leads (people who leave their details) and sign-ups through it are credited
 * to them. The code starts as the creator's handle and never changes, so links
 * already posted keep working if the handle does. Pure rules only.
 */
import { HANDLE_PATTERN, normalizeHandle } from '../creators/handle.ts';

/** Cookie that carries the code from the join page to account creation. */
export const REFERRAL_COOKIE = 'gc_ref';
export const REFERRAL_COOKIE_DAYS = 30;

/** A code looks like a handle; anything else is ignored rather than stored. */
export function normalizeReferralCode(raw: string | null | undefined): string | null {
  const v = normalizeHandle(raw ?? '');
  return HANDLE_PATTERN.test(v) && !/[._]{2}/.test(v) ? v : null;
}

export const REFERRAL_LEAD_ROLES = ['influencer', 'content_creator', 'public_figure', 'business', 'other'] as const;
export type ReferralLeadRole = (typeof REFERRAL_LEAD_ROLES)[number];

export const REFERRAL_LEAD_ROLE_LABELS: Readonly<Record<ReferralLeadRole, string>> = {
  influencer: 'Influencer',
  content_creator: 'Content creator',
  public_figure: 'Public figure',
  business: 'Brand or business',
  other: 'Something else',
};

export const REFERRAL_CONSENT_VERSION = 'referral-consent-v1';

/** Shown beside the checkbox on the join page and stored with every lead. */
export function referralConsentText(referrerName: string): string {
  return `I agree that GenCut AI may email me about GenCut Famous. ${referrerName} will see my name, the handle I enter and whether I join, but not my email address. I can ask for my details to be deleted at any time.`;
}

/** Abuse limits on the join page's form: per sender per day, and per link per day. */
export const REFERRAL_LEADS_PER_SENDER_PER_DAY = 3;
export const REFERRAL_LEADS_PER_LINK_PER_DAY = 500;

/** Join rate as a whole percent of visitors who joined, or null when there are no visits yet. */
export function joinRate(visitors: number, joined: number): number | null {
  if (visitors <= 0) return null;
  return Math.round((Math.min(joined, visitors) / visitors) * 100);
}
