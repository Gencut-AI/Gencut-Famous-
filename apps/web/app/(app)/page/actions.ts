'use server';

import { savePageSettings, setContentShown, setPublished } from '@gencut/services';
import { revalidatePath } from 'next/cache';
import { db } from '../../../lib/db.ts';
import { requireSession } from '../../../lib/session.ts';
import type { FormState } from '../../_ui/form.ts';
import { toFormError } from '../../_ui/form-server.ts';

export async function saveSettings(_prev: FormState, form: FormData): Promise<FormState> {
  const { ctx, workspace } = await requireSession();
  try {
    await savePageSettings(db(), ctx, workspace.workspaceId, {
      headline: String(form.get('headline') ?? ''),
      workWithMe: String(form.get('workWithMe') ?? ''),
      showInquiryForm: form.get('showInquiryForm') === 'on',
      shownMetrics: form.getAll('shownMetrics').map(String),
    });
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath('/page');
  return { status: 'saved', message: 'Saved.', at: Date.now() };
}

export async function publish(form: FormData): Promise<void> {
  const { ctx, workspace } = await requireSession();
  await setPublished(db(), ctx, workspace.workspaceId, form.get('publish') === 'yes');
  revalidatePath('/page');
  revalidatePath('/home');
}

export async function toggleContent(form: FormData): Promise<void> {
  const { ctx, workspace } = await requireSession();
  await setContentShown(db(), ctx, workspace.workspaceId, String(form.get('id') ?? ''), form.get('shown') === 'yes');
  revalidatePath('/page');
}
