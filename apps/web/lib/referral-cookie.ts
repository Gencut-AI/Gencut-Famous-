import { REFERRAL_COOKIE, REFERRAL_COOKIE_DAYS } from '@gencut/core';
import type { NextResponse } from 'next/server';

/** Remember which join link brought this browser, until the person creates an account. */
export function setReferralCookie(res: NextResponse, code: string): void {
  res.cookies.set(REFERRAL_COOKIE, code, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: REFERRAL_COOKIE_DAYS * 86_400 });
}
