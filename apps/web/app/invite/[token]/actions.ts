'use server';

import { acceptInvitation, isServiceError } from '@gencut/services';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '../../../lib/db.ts';
import { WORKSPACE_COOKIE, currentUser } from '../../../lib/session.ts';

export async function acceptAndOpen(form: FormData): Promise<void> {
  const ctx = await currentUser();
  const token = String(form.get('token') ?? '');
  if (!ctx) redirect(`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`);
  let workspaceId: string;
  try {
    workspaceId = await acceptInvitation(db(), ctx, token);
  } catch (e) {
    if (isServiceError(e)) redirect(`/invite/${encodeURIComponent(token)}?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  (await cookies()).set(WORKSPACE_COOKIE, workspaceId, { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * 365 });
  redirect('/home');
}
