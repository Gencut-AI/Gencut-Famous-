'use client';

import { MEDIA_MAX_BYTES } from '@gencut/core';
import { useActionState, useState } from 'react';
import { FormStatus } from '../../_ui/field.tsx';
import { type FormState, idle } from '../../_ui/form.ts';
import { addBrandPartnership, upload } from './actions.ts';
import { shrinkImage } from './shrink-image.ts';

export function UploadForm({ kind, label, withCaption }: { kind: string; label: string; withCaption?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(upload, idle);
  const [preparing, setPreparing] = useState(false);
  const [tooBig, setTooBig] = useState(false);
  return (
    <form
      action={action}
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        if (tooBig) e.preventDefault();
      }}
    >
      <input type="hidden" name="kind" value={kind} />
      <label className="text-sm font-medium" htmlFor={`file-${kind}`}>{label}</label>
      <input
        id={`file-${kind}`}
        name="file"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="text-sm file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-lilac file:px-3 file:font-medium file:text-royal-deep"
        onChange={async (e) => {
          const input = e.currentTarget;
          const picked = input.files?.[0];
          setTooBig(false);
          if (!picked) return;
          setPreparing(true);
          try {
            const small = await shrinkImage(picked, kind === 'logo');
            if (small !== picked && typeof DataTransfer !== 'undefined') {
              const dt = new DataTransfer();
              dt.items.add(small);
              input.files = dt.files;
            }
            setTooBig((input.files?.[0]?.size ?? 0) > MEDIA_MAX_BYTES);
          } finally {
            setPreparing(false);
          }
        }}
      />
      {tooBig && <p className="error-text">That image is over 5 MB. Choose a smaller one.</p>}
      {withCaption && <input name="caption" placeholder="Caption (optional)" className="field" maxLength={200} aria-label="Caption" />}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || preparing || tooBig} className="btn-quiet">{preparing ? 'Preparing…' : pending ? 'Uploading…' : 'Upload'}</button>
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
