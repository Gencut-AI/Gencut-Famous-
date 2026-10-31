import { getMediaForMember } from '@gencut/services';
import { db } from '../../../lib/db.ts';
import { imageResponse } from '../../../lib/media.ts';
import { currentUser } from '../../../lib/session.ts';

/** Brand images for team members of the creator only. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await currentUser();
  if (!ctx) return new Response('Not found', { status: 404 });
  const file = await getMediaForMember(db(), ctx, (await params).id);
  return file ? imageResponse(file, 'private, max-age=300') : new Response('Not found', { status: 404 });
}
