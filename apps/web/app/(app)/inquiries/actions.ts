'use server';

import { setInquiryStatus } from '@gencut/services';
import { revalidatePath } from 'next/cache';
import { db } from '../../../lib/db.ts';
import { requireSession } from '../../../lib/session.ts';

export async function markInquiry(form: FormData): Promise<void> {
  const { ctx, workspace } = await requireSession();
  const status = form.get('status') === 'archived' ? 'archived' : 'read';
  await setInquiryStatus(db(), ctx, workspace.workspaceId, String(form.get('id') ?? ''), status);
  revalidatePath('/inquiries');
  revalidatePath('/home');
}
