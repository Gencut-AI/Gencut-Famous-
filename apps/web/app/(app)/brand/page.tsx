import { PROFILE_SECTIONS, SECTION_LABELS, sectionStatus } from '@gencut/core';
import { getCreatorProfile, listMedia, listPartnerships } from '@gencut/services';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { db } from '../../../lib/db.ts';
import { requireSession } from '../../../lib/session.ts';
import { deletePartnership, removeImage } from './actions.ts';
import { AudienceForm, GoalsForm, IdentityForm, PartnershipPrefsForm, VisualForm, VoiceForm } from './brand-forms.tsx';
import { PartnershipForm, UploadForm } from './media-forms.tsx';

export const metadata: Metadata = { title: 'Brand profile' };

function Section({ id, title, done, children }: { id: string; title: string; done: boolean; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="panel scroll-mt-24">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id={`${id}-h`} className="display text-2xl font-semibold">{title}</h2>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${done ? 'bg-lilac text-royal-deep' : 'bg-paper text-ink-soft ring-1 ring-line'}`}>{done ? 'Done' : 'Optional'}</span>
      </div>
      {children}
    </section>
  );
}

export default async function BrandPage() {
  const { ctx, workspace } = await requireSession();
  const ws = workspace.workspaceId;
  const [p, media, partnerships] = await Promise.all([getCreatorProfile(db(), ctx, ws), listMedia(db(), ctx, ws), listPartnerships(db(), ws)]);
  const s = sectionStatus(p);
  const img = (kind: string) => media.filter((m) => m.kind === kind);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="display text-4xl font-bold">Brand profile</h1>
        <p className="mt-2 max-w-[60ch] text-ink-soft">Everything GenCut and your team need to sound like you. Fill in what you like, when you like; every section saves on its own.</p>
        <nav aria-label="Sections" className="mt-5 flex flex-wrap gap-2">
          {PROFILE_SECTIONS.map((k) => (
            <a key={k} href={`#${k}`} className={`min-h-10 content-center rounded-full px-3 text-sm ring-1 ${s[k] ? 'bg-lilac text-royal-deep ring-lilac' : 'ring-line text-ink-soft hover:text-ink'}`}>
              {SECTION_LABELS[k]}
            </a>
          ))}
        </nav>
      </header>

      <Section id="identity" title="Identity" done={s.identity}><IdentityForm p={p} /></Section>
      <Section id="audience" title="Audience" done={s.audience}><AudienceForm p={p} /></Section>
      <Section id="voice" title="Voice and values" done={s.voice}><VoiceForm p={p} /></Section>
      <Section id="visual" title="Visual identity" done={s.visual}>
        <div className="flex flex-col gap-8">
          <div className="grid gap-6 sm:grid-cols-2">
            {(['profile_photo', 'logo'] as const).map((kind) => (
              <div key={kind} className="flex flex-col gap-3">
                {img(kind)[0] ? (
                  <img src={`/media/${img(kind)[0]?.id}`} alt={kind === 'logo' ? 'Your logo' : 'Your profile photo'} className={`size-28 bg-lilac object-cover ${kind === 'logo' ? 'rounded-xl object-contain p-2' : 'rounded-full'}`} />
                ) : (
                  <div className={`grid size-28 place-items-center bg-lilac text-xs text-ink-soft ${kind === 'logo' ? 'rounded-xl' : 'rounded-full'}`}>None yet</div>
                )}
                <UploadForm kind={kind} label={kind === 'logo' ? 'Logo' : 'Profile photo'} />
              </div>
            ))}
          </div>
          <VisualForm p={p} />
          <div className="flex flex-col gap-3 border-t border-lilac pt-6">
            <h3 className="font-semibold">Content examples</h3>
            <p className="text-sm text-ink-soft">Images that show your style, shown on your media kit. Up to 12; images only in this version.</p>
            {img('content_example').length > 0 && (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {img('content_example').map((m) => (
                  <li key={m.id} className="flex flex-col gap-1">
                    <img src={`/media/${m.id}`} alt={m.caption ?? 'Content example'} className="aspect-square w-full rounded-lg object-cover" />
                    <form action={removeImage}><input type="hidden" name="id" value={m.id} /><button type="submit" className="min-h-9 text-xs text-ink-soft hover:text-[#c0264f]">Remove</button></form>
                  </li>
                ))}
              </ul>
            )}
            <UploadForm kind="content_example" label="Add an example" withCaption />
          </div>
        </div>
      </Section>
      <Section id="goals" title="Goals" done={s.goals}><GoalsForm p={p} /></Section>
      <Section id="partnerships" title="Partnerships" done={s.partnerships}>
        <div className="flex flex-col gap-8">
          <PartnershipPrefsForm p={p} />
          <div className="flex flex-col gap-3 border-t border-lilac pt-6">
            <h3 className="font-semibold">Past partnerships</h3>
            <p className="text-sm text-ink-soft">Shown on your media kit labelled “self-reported”. GenCut does not verify them.</p>
            {partnerships.length > 0 && (
              <ul className="flex flex-col divide-y divide-lilac rounded-xl ring-1 ring-line">
                {partnerships.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="font-medium">{x.brandName}{x.period ? <span className="font-normal text-ink-soft">, {x.period}</span> : null}</p>
                      {x.description && <p className="truncate text-sm text-ink-soft">{x.description}</p>}
                    </div>
                    <form action={deletePartnership}><input type="hidden" name="id" value={x.id} /><button type="submit" className="min-h-10 text-sm text-ink-soft hover:text-[#c0264f]">Remove</button></form>
                  </li>
                ))}
              </ul>
            )}
            <PartnershipForm />
          </div>
        </div>
      </Section>
    </div>
  );
}
