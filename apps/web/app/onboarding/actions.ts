'use server';

import { REFERRAL_COOKIE } from '@gencut/core';
import { createCreator } from '@gencut/services';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '../../lib/db.ts';
import { WORKSPACE_COOKIE, currentUser } from '../../lib/session.ts';
import type { FormState } from '../_ui/form.ts';
import { toFormError } from '../_ui/form-server.ts';

export async function startCreator(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await currentUser();
  if (!ctx) redirect('/sign-in');
  let workspaceId: string;
  try {
    workspaceId = await createCreator(
      db(),
      ctx,
      { publicName: String(form.get('publicName') ?? ''), handle: String(form.get('handle') ?? ''), adult: form.get('adult') === 'on' },
      { referralCode: (await cookies()).get(REFERRAL_COOKIE)?.value ?? null },
    );
  } catch (e) {
    return toFormError(e);
  }
  (await cookies()).delete(REFERRAL_COOKIE);
  (await cookies()).set(WORKSPACE_COOKIE, workspaceId, { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * 365 });
  redirect('/home?welcome=1');
}
