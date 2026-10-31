'use server';

import { listMemberships } from '@gencut/services';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '../../lib/db.ts';
import { WORKSPACE_COOKIE, currentUser } from '../../lib/session.ts';

/** Switch which creator a manager is working on. The choice is re-checked against memberships on every request. */
export async function switchCreator(form: FormData): Promise<void> {
  const ctx = await currentUser();
  if (!ctx) redirect('/sign-in');
  const id = String(form.get('workspaceId') ?? '');
  if ((await listMemberships(db(), ctx)).some((m) => m.workspaceId === id)) {
    (await cookies()).set(WORKSPACE_COOKIE, id, { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * 365 });
  }
  redirect('/home');
}
