'use server';

import type { MediaKind } from '@gencut/core';
import { addPartnership, deleteMedia, removePartnership, updateProfile, uploadMedia } from '@gencut/services';
import { revalidatePath } from 'next/cache';
import { db } from '../../../lib/db.ts';
import { requireSession } from '../../../lib/session.ts';
import type { FormState } from '../../_ui/form.ts';
import { toFormError } from '../../_ui/form-server.ts';

const text = (f: FormData, k: string) => String(f.get(k) ?? '');

/** Each section posts only its own fields; the service validates and saves just those. */
function patchFor(section: string, f: FormData): Record<string, unknown> {
  switch (section) {
    case 'identity':
      return { publicName: text(f, 'publicName'), handle: text(f, 'handle'), legalName: text(f, 'legalName'), bio: text(f, 'bio'), niches: f.getAll('niches').map(String) };
    case 'audience':
      return { targetAudience: text(f, 'targetAudience'), audienceNotes: text(f, 'audienceNotes') };
    case 'voice':
      return { brandMessage: text(f, 'brandMessage'), values: text(f, 'values'), tone: text(f, 'tone') || null, toneNotes: text(f, 'toneNotes') };
    case 'visual':
      return { colors: text(f, 'colors'), fonts: text(f, 'fonts') };
    case 'goals':
      return { goals: text(f, 'goals'), growthTarget: text(f, 'growthTarget') };
    case 'partnerships': {
      const names = f.getAll('rateDeliverable').map(String);
      const prices = f.getAll('ratePrice').map(String);
      // Rows left blank are dropped; a row with a deliverable but no valid price is sent as is and rejected by validation.
      const rateCard = names.flatMap((d, i) => {
        const price = String(prices[i] ?? '').replace(/[$,\s]/g, '');
        if (!d.trim() && !price) return [];
        return [{ deliverable: d.trim(), priceUsd: price === '' ? Number.NaN : Number(price) }];
      });
      return { partnershipKinds: f.getAll('partnershipKinds').map(String), brandsWanted: text(f, 'brandsWanted'), brandsAvoided: text(f, 'brandsAvoided'), rateCard };
    }
    default:
      return {};
  }
}

export async function saveSection(_prev: FormState, form: FormData): Promise<FormState> {
  const { ctx, workspace } = await requireSession();
  try {
    await updateProfile(db(), ctx, workspace.workspaceId, patchFor(text(form, 'section'), form));
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath('/', 'layout');
  return { status: 'saved', message: 'Saved.', at: Date.now() };
}

export async function upload(_prev: FormState, form: FormData): Promise<FormState> {
  const { ctx, workspace } = await requireSession();
  const kind = text(form, 'kind') as MediaKind;
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return { status: 'error', message: 'Choose an image to upload.', fields: {} };
  if (!['logo', 'profile_photo', 'content_example'].includes(kind)) return { status: 'error', message: 'Unknown image type.', fields: {} };
  try {
    await uploadMedia(db(), ctx, workspace.workspaceId, kind, new Uint8Array(await file.arrayBuffer()), text(form, 'caption'));
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath('/brand');
  return { status: 'saved', message: 'Uploaded.', at: Date.now() };
}

export async function removeImage(form: FormData): Promise<void> {
  const { ctx, workspace } = await requireSession();
  await deleteMedia(db(), ctx, workspace.workspaceId, text(form, 'id'));
  revalidatePath('/brand');
}

export async function addBrandPartnership(_prev: FormState, form: FormData): Promise<FormState> {
  const { ctx, workspace } = await requireSession();
  try {
    await addPartnership(db(), ctx, workspace.workspaceId, { brandName: text(form, 'brandName'), description: text(form, 'description'), period: text(form, 'period'), url: text(form, 'url') });
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath('/brand');
  return { status: 'saved', message: 'Added.', at: Date.now() };
}

export async function deletePartnership(form: FormData): Promise<void> {
  const { ctx, workspace } = await requireSession();
  await removePartnership(db(), ctx, workspace.workspaceId, text(form, 'id'));
  revalidatePath('/brand');
}
