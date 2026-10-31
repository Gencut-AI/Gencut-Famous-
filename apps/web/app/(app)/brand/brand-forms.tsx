'use client';

import { type CreatorProfile, NICHES, NICHE_LABELS, PARTNERSHIP_KINDS, TONES } from '@gencut/core';
import { Field } from '../../_ui/field.tsx';
import { SectionForm } from './section-form.tsx';

const KIND_LABELS: Record<(typeof PARTNERSHIP_KINDS)[number], string> = {
  sponsored_posts: 'Sponsored posts', ambassadorships: 'Ambassadorships', affiliate: 'Affiliate', events: 'Events and appearances',
  product_seeding: 'Product seeding', licensing: 'Content licensing',
};
const TONE_LABELS: Record<(typeof TONES)[number], string> = {
  warm: 'Warm', playful: 'Playful', bold: 'Bold', expert: 'Expert', calm: 'Calm', luxurious: 'Luxurious', raw: 'Raw and unfiltered',
};

const chip = 'flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-white px-3 text-sm ring-1 ring-glass-deep has-[:checked]:bg-glass has-[:checked]:text-bay-deep has-[:checked]:ring-bay';

export function IdentityForm({ p }: { p: CreatorProfile }) {
  return (
    <SectionForm section="identity">
      {(e) => (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="publicName" label="Public name" error={e.publicName}>
              <input id="publicName" name="publicName" defaultValue={p.publicName} className="field" maxLength={80} aria-invalid={Boolean(e.publicName)} />
            </Field>
            <Field id="handle" label="Handle" hint="Changing it changes your media kit link." error={e.handle}>
              <input id="handle" name="handle" defaultValue={p.handle} className="field" autoCapitalize="none" spellCheck={false} maxLength={31} aria-invalid={Boolean(e.handle)} />
            </Field>
          </div>
          <Field id="legalName" label="Legal name (private)" hint="For contracts later. Never shown publicly." error={e.legalName}>
            <input id="legalName" name="legalName" defaultValue={p.legalName ?? ''} className="field" maxLength={120} />
          </Field>
          <Field id="bio" label="Bio" hint="Shown on your media kit. Up to 600 characters." error={e.bio}>
            <textarea id="bio" name="bio" defaultValue={p.bio ?? ''} className="field-area" maxLength={600} />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Niches (up to 5)</legend>
            <div className="flex flex-wrap gap-2">
              {NICHES.map((n) => (
                <label key={n} className={chip}>
                  <input type="checkbox" name="niches" value={n} defaultChecked={p.niches.includes(n)} className="sr-only" />
                  {NICHE_LABELS[n]}
                </label>
              ))}
            </div>
            {e.niches && <p className="error-text">{e.niches}</p>}
          </fieldset>
        </>
      )}
    </SectionForm>
  );
}

export function AudienceForm({ p }: { p: CreatorProfile }) {
  return (
    <SectionForm section="audience">
      {(e) => (
        <>
          <Field id="targetAudience" label="Who you make content for" hint="In your words, e.g. “Busy parents in their 30s who want 20-minute dinners.”" error={e.targetAudience}>
            <textarea id="targetAudience" name="targetAudience" defaultValue={p.targetAudience ?? ''} className="field-area" maxLength={400} />
          </Field>
          <Field id="audienceNotes" label="What you know about your audience" hint="Where they live, ages, interests. Verified demographics arrive with platform insights; this is your own view." error={e.audienceNotes}>
            <textarea id="audienceNotes" name="audienceNotes" defaultValue={p.audienceNotes ?? ''} className="field-area" maxLength={600} />
          </Field>
        </>
      )}
    </SectionForm>
  );
}

export function VoiceForm({ p }: { p: CreatorProfile }) {
  return (
    <SectionForm section="voice">
      {(e) => (
        <>
          <Field id="brandMessage" label="Brand message" hint="One or two sentences on what you stand for." error={e.brandMessage}>
            <textarea id="brandMessage" name="brandMessage" defaultValue={p.brandMessage ?? ''} className="field-area" maxLength={400} />
          </Field>
          <Field id="values" label="Values" hint="Comma-separated, up to 8." error={e.values}>
            <input id="values" name="values" defaultValue={p.values.join(', ')} className="field" />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Tone of voice</legend>
            <div className="flex flex-wrap gap-2">
              <label className={chip}><input type="radio" name="tone" value="" defaultChecked={p.tone === null} className="sr-only" />Not set</label>
              {TONES.map((t) => (
                <label key={t} className={chip}>
                  <input type="radio" name="tone" value={t} defaultChecked={p.tone === t} className="sr-only" />
                  {TONE_LABELS[t]}
                </label>
              ))}
            </div>
          </fieldset>
          <Field id="toneNotes" label="How you sound" hint="Words you use, words you never use." error={e.toneNotes}>
            <textarea id="toneNotes" name="toneNotes" defaultValue={p.toneNotes ?? ''} className="field-area" maxLength={400} />
          </Field>
        </>
      )}
    </SectionForm>
  );
}

export function VisualForm({ p }: { p: CreatorProfile }) {
  return (
    <SectionForm section="visual">
      {(e) => (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="colors" label="Brand colors" hint="Hex codes, comma-separated. The first is your media kit accent." error={e.colors}>
            <input id="colors" name="colors" defaultValue={p.colors.join(', ')} className="field" placeholder="#0f6e73, #ef5f82" aria-invalid={Boolean(e.colors)} />
          </Field>
          <Field id="fonts" label="Fonts" hint="Names only, up to 3." error={e.fonts}>
            <input id="fonts" name="fonts" defaultValue={p.fonts.join(', ')} className="field" />
          </Field>
          {p.colors.length > 0 && (
            <ul className="flex gap-2 sm:col-span-2" aria-label="Your colors">
              {p.colors.map((c) => <li key={c} className="size-10 rounded-lg ring-1 ring-glass-deep" style={{ background: c }} title={c} />)}
            </ul>
          )}
        </div>
      )}
    </SectionForm>
  );
}

export function GoalsForm({ p }: { p: CreatorProfile }) {
  return (
    <SectionForm section="goals">
      {(e) => (
        <>
          <Field id="goals" label="What you want this year" hint="Audience, partnerships, a launch, press — whatever matters." error={e.goals}>
            <textarea id="goals" name="goals" defaultValue={p.goals ?? ''} className="field-area" maxLength={600} />
          </Field>
          <Field id="growthTarget" label="Audience growth target" hint="Your own target, e.g. “50K on Instagram by June.”" error={e.growthTarget}>
            <input id="growthTarget" name="growthTarget" defaultValue={p.growthTarget ?? ''} className="field" maxLength={200} />
          </Field>
        </>
      )}
    </SectionForm>
  );
}

export function PartnershipPrefsForm({ p }: { p: CreatorProfile }) {
  const rows = [...p.rateCard, ...Array.from({ length: Math.max(1, 3 - p.rateCard.length) }, () => ({ deliverable: '', priceUsd: Number.NaN }))];
  return (
    <SectionForm section="partnerships">
      {(e) => (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Partnerships you are open to</legend>
            <div className="flex flex-wrap gap-2">
              {PARTNERSHIP_KINDS.map((k) => (
                <label key={k} className={chip}>
                  <input type="checkbox" name="partnershipKinds" value={k} defaultChecked={p.partnershipKinds.includes(k)} className="sr-only" />
                  {KIND_LABELS[k]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="brandsWanted" label="Brands you want to work with" hint="Comma-separated." error={e.brandsWanted}>
              <textarea id="brandsWanted" name="brandsWanted" defaultValue={p.brandsWanted.join(', ')} className="field-area" />
            </Field>
            <Field id="brandsAvoided" label="Brands you will not work with (private)" hint="GenCut will never suggest these." error={e.brandsAvoided}>
              <textarea id="brandsAvoided" name="brandsAvoided" defaultValue={p.brandsAvoided.join(', ')} className="field-area" />
            </Field>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Rate card (private, US dollars)</legend>
            <p className="text-sm text-ink-soft">Your own asking prices. Never shown on your media kit.</p>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_8rem] gap-2">
                <input name="rateDeliverable" defaultValue={r.deliverable} placeholder="e.g. One Instagram Reel" aria-label={`Deliverable ${i + 1}`} className="field" maxLength={80} />
                <input name="ratePrice" defaultValue={Number.isNaN(r.priceUsd) ? '' : String(r.priceUsd)} placeholder="2500" inputMode="numeric" aria-label={`Price ${i + 1}`} className="field" />
              </div>
            ))}
            {e.rateCard && <p className="error-text">Check the rate card: each row needs a deliverable and a whole-dollar price.</p>}
          </fieldset>
        </>
      )}
    </SectionForm>
  );
}
