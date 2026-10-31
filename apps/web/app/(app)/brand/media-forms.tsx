'use client';

import { useActionState } from 'react';
import { FormStatus } from '../../_ui/field.tsx';
import { type FormState, idle } from '../../_ui/form.ts';
import { addBrandPartnership, upload } from './actions.ts';

export function UploadForm({ kind, label, withCaption }: { kind: string; label: string; withCaption?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(upload, idle);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="kind" value={kind} />
      <label className="text-sm font-medium" htmlFor={`file-${kind}`}>{label}</label>
      <input id={`file-${kind}`} name="file" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-glass file:px-3 file:font-medium file:text-bay-deep" />
      {withCaption && <input name="caption" placeholder="Caption (optional)" className="field" maxLength={200} aria-label="Caption" />}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-quiet">{pending ? 'Uploading…' : 'Upload'}</button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function PartnershipForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addBrandPartnership, idle);
  const e = state.status === 'error' ? state.fields : {};
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2" noValidate>
      <input name="brandName" placeholder="Brand" className="field" aria-label="Brand" aria-invalid={Boolean(e.brandName)} maxLength={80} />
      <input name="period" placeholder="When, e.g. Spring 2026" className="field" aria-label="When" maxLength={40} />
      <input name="description" placeholder="What you made together" className="field sm:col-span-2" aria-label="Description" maxLength={280} />
      <input name="url" placeholder="Link to the work (https://…)" className="field sm:col-span-2" aria-label="Link" aria-invalid={Boolean(e.url)} />
      {(e.brandName || e.url) && <p className="error-text sm:col-span-2">{e.brandName ?? e.url}</p>}
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className="btn-quiet">{pending ? 'Adding…' : 'Add partnership'}</button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}
