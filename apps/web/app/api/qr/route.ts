import { normalizeHandle, normalizeReferral } from '@gencut/core';
import QRCode from 'qrcode';
import type { NextRequest } from 'next/server';
import { publicBase } from '../../../lib/connectors.ts';

/** A QR code (SVG) for a media kit link, optionally tagged with ?src=. Generated here; no outside service. */
export async function GET(request: NextRequest) {
  const handle = normalizeHandle(request.nextUrl.searchParams.get('handle') ?? '');
  if (!/^[a-z0-9._]{3,30}$/.test(handle)) return new Response('Bad handle', { status: 400 });
  const src = normalizeReferral(request.nextUrl.searchParams.get('src'));
  const url = `${await publicBase()}/@${handle}${src ? `?src=${src}` : ''}`;
  const svg = await QRCode.toString(url, { type: 'svg', margin: 2, color: { dark: '#1b1035', light: '#ffffff' }, errorCorrectionLevel: 'M' });
  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml',
      'content-disposition': `inline; filename="gencut-${handle}${src ? `-${src}` : ''}.svg"`,
      'cache-control': 'public, max-age=3600',
      'x-content-type-options': 'nosniff',
    },
  });
}
