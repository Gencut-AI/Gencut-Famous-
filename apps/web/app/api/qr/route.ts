import { normalizeHandle, normalizeReferral } from '@gencut/core';
import QRCode from 'qrcode';
import type { NextRequest } from 'next/server';
import { publicBase } from '../../../lib/connectors.ts';

/**
 * A QR code (SVG) for a media kit (/@handle) or a join link (/join/code, with kind=join),
 * optionally tagged with ?src=. Generated here; no outside service.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const handle = normalizeHandle(q.get('handle') ?? '');
  if (!/^[a-z0-9._]{3,30}$/.test(handle)) return new Response('Bad handle', { status: 400 });
  const join = q.get('kind') === 'join';
  const src = normalizeReferral(q.get('src'));
  const url = `${await publicBase()}/${join ? 'join/' : '@'}${handle}${src ? `?src=${src}` : ''}`;
  const svg = await QRCode.toString(url, { type: 'svg', margin: 2, color: { dark: '#1b1035', light: '#ffffff' }, errorCorrectionLevel: 'M' });
  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml',
      'content-disposition': `inline; filename="gencut-${join ? 'join-' : ''}${handle}${src ? `-${src}` : ''}.svg"`,
      'cache-control': 'public, max-age=3600',
      'x-content-type-options': 'nosniff',
    },
  });
}
