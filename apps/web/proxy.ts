import type { NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/proxy.ts';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Signed-in pages only. Static assets, public media kits and their images, the visit beacon,
  // QR codes, Meta's callbacks and Netlify functions carry no session.
  matcher: ['/((?!_next/static|_next/image|\\.netlify/|api/health|api/visit|api/qr|api/meta|public-media|p/|@|manifest.webmanifest|robots.txt|sitemap.xml|icon|apple-touch-icon|.*\\.(?:svg|png|jpg|webp|ico)$).*)'],
};
