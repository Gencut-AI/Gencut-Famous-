'use server';

import { createInvitation, removeManager, revokeInvitation } from '@gencut/services';
import { revalidatePath } from 'next/cache';
import { siteOrigin } from '../../../lib/connectors.ts';
import { db } from '../../../lib/db.ts';
import { requireSession } from '../../../lib/session.ts';
import { toFormError } from '../../_ui/form-server.ts';

export type InviteState = { status: 'idle' } | { status: 'created'; email: string; link: string } | { status: 'error'; message: string; fields: Record<string, string> };

export async function invite(_prev: InviteState, form: FormData): Promise<InviteState> {
  const { ctx, workspace } = await requireSession();
  try {
    const { invitation, token } = await createInvitation(db(), ctx, workspace.workspaceId, form.get('email'));
    revalidatePath('/team');
    return { status: 'created', email: invitation.email, link: `${await siteOrigin()}/invite/${token}` };
  } catch (e) {
    const s = toFormError(e);
    return s.status === 'error' ? s : { status: 'idle' };
  }
}

export async function withdraw(form: FormData): Promise<void> {
  const { ctx, workspace } = await requireSession();
  await revokeInvitation(db(), ctx, workspace.workspaceId, String(form.get('id') ?? ''));
  revalidatePath('/team');
}

export async function remove(form: FormData): Promise<void> {
  const { ctx, workspace } = await requireSession();
  await removeManager(db(), ctx, workspace.workspaceId, String(form.get('userId') ?? ''));
  revalidatePath('/team');
}
