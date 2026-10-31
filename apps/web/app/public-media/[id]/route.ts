import { getPublicMedia } from '@gencut/services';
import { db } from '../../../lib/db.ts';
import { imageResponse } from '../../../lib/media.ts';

/** Logo, photo and style images of published media kits only. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const file = await getPublicMedia(db(), (await params).id);
  return file ? imageResponse(file, 'public, max-age=300, s-maxage=3600') : new Response('Not found', { status: 404 });
}
