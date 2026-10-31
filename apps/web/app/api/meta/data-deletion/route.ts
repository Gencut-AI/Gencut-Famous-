import { metaDataDeletion, parseSignedRequest } from '@gencut/services';
import { NextResponse } from 'next/server';
import { publicBase } from '../../../../lib/connectors.ts';
import { db } from '../../../../lib/db.ts';

/**
 * Meta's data-deletion callback: erase everything GenCut read for that
 * Instagram account, and answer with a status link and confirmation code.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const parsed = parseSignedRequest(String(form?.get('signed_request') ?? ''), process.env.INSTAGRAM_APP_SECRET ?? '');
  if (!parsed) return new Response('Bad signature', { status: 400 });
  const { confirmationCode } = await metaDataDeletion(db(), parsed.userId);
  return NextResponse.json({ url: `${await publicBase()}/data-deletion?code=${confirmationCode}`, confirmation_code: confirmationCode });
}
