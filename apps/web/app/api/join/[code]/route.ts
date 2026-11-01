import { normalizeReferralCode } from '@gencut/core';
import { type NextRequest, NextResponse } from 'next/server';
import { siteOrigin } from '../../../../lib/connectors.ts';
import { setReferralCookie } from '../../../../lib/referral-cookie.ts';

/** "Create my free account" on a join page: remember the code, then go to sign-in and on to setup. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeReferralCode((await params).code);
  const res = NextResponse.redirect(new URL('/sign-in?next=/onboarding', await siteOrigin()), 303);
  if (code) setReferralCookie(res, code);
  return res;
}
