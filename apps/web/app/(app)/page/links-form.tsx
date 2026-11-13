'use client';

import { useActionState } from 'react';
import { Field, FormStatus } from '../../_ui/field.tsx';
import { type FormState, idle } from '../../_ui/form.ts';
import { saveLinks } from './actions.ts';

/** Paste profile links, one per line; the platform is worked out from each link. */
export function LinksForm({ links }: { links: readonly string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveLinks, idle);
  const error = state.status === 'error' ? (state.fields.socialLinks ?? state.message) : undefined;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field id="socialLinks" label="Paste your profile links, one per line" hint="Instagram, TikTok, YouTube, X, Threads, Facebook, LinkedIn or your website. Up to 10." error={error}>
        <textarea
          id="socialLinks"
          name="socialLinks"
          defaultValue={links.join('\n')}
          className="field-area min-h-36"
          placeholder={'https://www.instagram.com/yourname\nhttps://www.tiktok.com/@yourname'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="url"
          aria-invalid={Boolean(error)}
        />
      </Field>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className="btn">{pending ? 'Saving…' : 'Save links'}</button>
        {state.status === 'saved' && <FormStatus state={state} />}
      </div>
    </form>
  );
}
