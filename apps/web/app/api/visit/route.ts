import { recordVisit } from '@gencut/services';
import { type NextRequest, NextResponse } from 'next/server';
import { clientAddress, visitSecret } from '../../../lib/client-ip.ts';
import { db } from '../../../lib/db.ts';

/** Visit beacon from a public media kit. Always answers 204; stores a one-way daily hash, never the address. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { handle?: unknown; src?: unknown; referrer?: unknown } | null;
    if (body && typeof body.handle === 'string' && body.handle.length <= 31) {
      await recordVisit(db(), body.handle, {
        address: clientAddress(request.headers),
        userAgent: request.headers.get('user-agent') ?? '',
        referrer: typeof body.referrer === 'string' ? body.referrer.slice(0, 500) : null,
        ownHost: request.nextUrl.hostname,
        src: typeof body.src === 'string' ? body.src : null,
      }, visitSecret());
    }
  } catch {
    // A failed count must never break the visitor's page.
  }
  return new NextResponse(null, { status: 204 });
}
