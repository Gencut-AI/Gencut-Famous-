import { metaDeauthorized, parseSignedRequest } from '@gencut/services';
import { db } from '../../../../lib/db.ts';

/** Meta calls this when someone removes GenCut from their Instagram account. */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const parsed = parseSignedRequest(String(form?.get('signed_request') ?? ''), process.env.INSTAGRAM_APP_SECRET ?? '');
  if (!parsed) return new Response('Bad signature', { status: 400 });
  await metaDeauthorized(db(), parsed.userId);
  return new Response(null, { status: 200 });
}
