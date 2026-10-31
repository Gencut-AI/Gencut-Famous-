'use server';

import { deleteChannelData, disconnectChannel } from '@gencut/services';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../../../lib/db.ts';
import { requireSession } from '../../../lib/session.ts';

export async function disconnect(form: FormData): Promise<void> {
  const { ctx, workspace } = await requireSession();
  await disconnectChannel(db(), ctx, workspace.workspaceId, String(form.get('id') ?? ''));
  revalidatePath('/', 'layout');
  redirect('/channels?disconnected=1');
}

export async function eraseData(form: FormData): Promise<void> {
  const { ctx, workspace } = await requireSession();
  if (form.get('confirm') !== 'on') redirect('/channels?error=confirm');
  await deleteChannelData(db(), ctx, workspace.workspaceId, String(form.get('id') ?? ''));
  revalidatePath('/', 'layout');
  redirect('/channels?deleted=1');
}
