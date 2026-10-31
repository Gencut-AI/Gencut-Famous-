'use client';

import { type ReactNode, useActionState } from 'react';
import { FormStatus } from '../../_ui/field.tsx';
import { type FormState, idle } from '../../_ui/form.ts';
import { saveSection } from './actions.ts';

/** One section of the brand profile, saved on its own. Field errors come back keyed by field name. */
export function SectionForm({ section, children }: { section: string; children: (errors: Record<string, string>) => ReactNode }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSection, idle);
  const errors = state.status === 'error' ? state.fields : {};
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="section" value={section} />
      {children(errors)}
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className="btn">{pending ? 'Saving…' : 'Save'}</button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}
