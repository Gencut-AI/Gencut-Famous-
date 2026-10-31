'use client';

import { useActionState } from 'react';
import { Field, FormStatus } from '../../_ui/field.tsx';
import { type FormState, idle } from '../../_ui/form.ts';
import { saveSettings } from './actions.ts';

const METRIC_CHOICES: Array<[string, string]> = [
  ['followers', 'Followers'],
  ['posts', 'Posts'],
  ['views', 'Views, last 7 days'],
  ['reach', 'Reach, last 7 days'],
  ['interactions', 'Interactions, last 7 days'],
];

export function SettingsForm(props: { headline: string; workWithMe: string; showInquiryForm: boolean; shownMetrics: readonly string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSettings, idle);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <Field id="headline" label="Headline" hint="One line under your name, e.g. “Weeknight recipes for busy families.”">
        <input id="headline" name="headline" defaultValue={props.headline} className="field" maxLength={120} />
      </Field>
      <Field id="workWithMe" label="Work with me" hint="What you offer brands and how you like to work.">
        <textarea id="workWithMe" name="workWithMe" defaultValue={props.workWithMe} className="field-area" maxLength={600} />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Numbers to show</legend>
        <p className="text-sm text-ink-soft">Only figures read from your connected accounts appear, each with its source and date. Nothing is shown for a platform until it has been read.</p>
        <div className="flex flex-wrap gap-2">
          {METRIC_CHOICES.map(([k, label]) => (
            <label key={k} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-white px-3 text-sm ring-1 ring-line has-[:checked]:bg-lilac has-[:checked]:text-royal-deep has-[:checked]:ring-royal">
              <input type="checkbox" name="shownMetrics" value={k} defaultChecked={props.shownMetrics.includes(k)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-3 text-[0.95rem]">
        <input type="checkbox" name="showInquiryForm" defaultChecked={props.showInquiryForm} className="size-5 accent-royal" />
        Show an inquiry form so brands and press can contact you
      </label>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className="btn">{pending ? 'Saving…' : 'Save'}</button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}
