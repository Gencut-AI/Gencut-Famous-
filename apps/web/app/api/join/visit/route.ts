import { normalizeReferralCode } from '@gencut/core';
import { recordReferralVisit } from '@gencut/services';
import { type NextRequest, NextResponse } from 'next/server';
import { clientAddress, visitSecret } from '../../../../lib/client-ip.ts';
import { db } from '../../../../lib/db.ts';
import { setReferralCookie } from '../../../../lib/referral-cookie.ts';

/** Join-page beacon: count the visit (one-way daily hash) and remember the code. Always 204. */
export async function POST(request: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  try {
    const body = (await request.json().catch(() => null)) as { code?: unknown; src?: unknown } | null;
    const code = typeof body?.code === 'string' ? normalizeReferralCode(body.code) : null;
    if (code) {
      await recordReferralVisit(db(), code, {
        address: clientAddress(request.headers),
        userAgent: request.headers.get('user-agent') ?? '',
        src: typeof body?.src === 'string' ? body.src : null,
      }, visitSecret());
      setReferralCookie(res, code);
    }
  } catch {
    // A failed count must never break the visitor's page.
  }
  return res;
}
