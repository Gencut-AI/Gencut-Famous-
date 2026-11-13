import { INQUIRY_KIND_LABELS, LINK_KIND_LABELS, METRICS, PLATFORM_LABELS } from '@gencut/core';
import type { PublicProfile } from '@gencut/services';
import { compact, day, n, sourceLabel, when } from '../../../lib/format.ts';
import { Avatar } from '../../_ui/avatar.tsx';
import { Icons, Wordmark } from '../../_ui/icons.tsx';
import { InquiryForm } from './inquiry-form.tsx';

/** The media kit, laid out like a social profile. Shared by the public page and the team's preview. */
export function ProfileView({ p, preview }: { p: PublicProfile; preview?: boolean }) {
  const img = (id: string) => `${preview ? '/media' : '/public-media'}/${id}`;
  const stats = p.metrics.slice(0, 3);
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
      <header className="flex items-center justify-between py-3">
        <a href="/" aria-label="GenCut Famous"><Wordmark size={26} /></a>
        {p.showInquiryForm && !preview && <a href="#contact" className="btn min-h-10 px-5 text-sm">Work with me</a>}
      </header>

      <section className="panel mt-4">
        <div className="flex items-center gap-5 sm:gap-8">
          <Avatar src={p.photoId ? img(p.photoId) : null} name={p.publicName} size={104} />
          <div className="min-w-0 flex-1">
            <h1 className="display truncate text-[clamp(1.9rem,6vw,3rem)]">{p.publicName}</h1>
            <p className="text-ink-soft">@{p.handle}</p>
            {stats.length > 0 && (
              <dl className="mt-3 hidden gap-6 sm:flex">
                {stats.map((f) => (
                  <div key={`${f.source}-${f.metric}`}>
                    <dt className="sr-only">{METRICS[f.metric].label} on {sourceLabel(f.source)}</dt>
                    <dd><span className="display text-xl">{f.value === null ? '—' : compact(f.value)}</span> <span className="text-sm text-ink-soft">{METRICS[f.metric].label.toLowerCase()}</span></dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
        {stats.length > 0 && (
          <a href="#numbers" className="mt-5 block sm:hidden" aria-label="See verified numbers with sources"><dl className="grid grid-cols-3 rounded-tile bg-white/60 py-3 text-center">
            {stats.map((f) => (
              <div key={`${f.source}-${f.metric}`}>
                <dd className="display text-xl">{f.value === null ? '—' : compact(f.value)}</dd>
                <dt className="text-xs text-ink-soft">{METRICS[f.metric].label}</dt>
              </div>
            ))}
          </dl></a>
        )}
        <div className="mt-5 flex flex-col gap-2">
          {p.headline && <p className="font-semibold">{p.headline}</p>}
          {p.bio && <p>{p.bio}</p>}
          {p.brandMessage && <p className="text-ink-soft">{p.brandMessage}</p>}
        </div>
        {p.niches.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Categories">
            {p.niches.map((x) => <li key={x} className="chip">{x}</li>)}
          </ul>
        )}
        {p.links.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-2" aria-label="Follow me everywhere">
            {p.links.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noopener noreferrer me" className="btn-quiet min-h-10 px-4 text-sm">
                  {l.kind === 'website' ? l.label : `${LINK_KIND_LABELS[l.kind]} ${l.label}`} <Icons.external />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {p.metrics.length > 0 && (
        <section aria-labelledby="numbers" className="mt-6">
          <h2 id="numbers" className="display text-2xl">Verified numbers</h2>
          <p className="mt-1 text-sm text-ink-soft">Read by GenCut from the creator's connected accounts through each platform's official API.</p>
          <ul className={`mt-4 grid gap-3 ${p.metrics.length % 3 === 0 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            {p.metrics.map((f) => (
              <li key={`${f.source}-${f.metric}`} className="tile flex flex-col gap-1">
                <span className="eyebrow">{METRICS[f.metric].label} on {PLATFORM_LABELS[f.source as keyof typeof PLATFORM_LABELS]}</span>
                <span className="display text-[2.5rem]" title={f.value === null ? '' : n(f.value)}>{f.value === null ? '—' : compact(f.value)}</span>
                <span className="text-xs text-ink-soft">{f.periodLabel.replace(/^as of/, 'As of')}<br />Read {when(f.retrievedAt)}</span>
              </li>
            ))}
          </ul>
          {new Set(p.metrics.map((m) => m.source)).size > 1 && <p className="mt-2 text-xs text-ink-soft">Figures are per platform and are not added together: someone who follows on two platforms is counted on each.</p>}
        </section>
      )}

      {(p.content.length > 0 || p.examples.length > 0) && (
        <section aria-labelledby="posts" className="mt-8">
          <h2 id="posts" className="display text-2xl">Posts</h2>
          <ul className="mt-4 grid grid-cols-3 gap-1.5 sm:gap-3">
            {p.content.map((c) => (
              <li key={c.id}>
                <a href={c.permalink} target="_blank" rel="noopener noreferrer" className="tile flex aspect-square flex-col gap-1 overflow-hidden bg-gradient-to-br from-white/85 to-lilac/90 p-2.5 transition-transform hover:-translate-y-0.5 sm:p-4" aria-label={`${c.caption ?? 'Post'}, open on ${PLATFORM_LABELS[c.platform]}`}>
                  <span className="line-clamp-4 text-[0.8rem] leading-snug sm:text-[0.95rem]">{c.caption ?? 'View post'}</span>
                  <span className="mt-auto flex items-center justify-between text-[0.7rem] text-royal-deep sm:text-xs">
                    <span>{c.publishedAt ? day(c.publishedAt) : PLATFORM_LABELS[c.platform]}</span>
                    <Icons.external width={14} height={14} />
                  </span>
                </a>
              </li>
            ))}
            {p.examples.map((e) => (
              <li key={e.id}>
                <img src={img(e.id)} alt={e.caption ?? `Example of ${p.publicName}'s work`} loading="lazy" className="aspect-square w-full rounded-tile object-cover" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {(p.workWithMe || p.partnerships.length > 0 || p.showInquiryForm) && (
        <section id="contact" aria-labelledby="hire" className="panel mt-8 scroll-mt-6">
          <h2 id="hire" className="display text-[2rem]">Work with me</h2>
          {p.workWithMe && <p className="mt-3 whitespace-pre-line text-lg">{p.workWithMe}</p>}
          {p.partnerships.length > 0 && (
            <div className="mt-6">
              <h3 className="flex items-center gap-2 font-semibold">Past partnerships <span className="chip min-h-6 bg-white/80 text-xs text-ink-soft">Self-reported</span></h3>
              <ul className="mt-3 flex flex-col gap-2">
                {p.partnerships.map((x) => (
                  <li key={x.id} className="tile py-3">
                    <span className="font-semibold">{x.url ? <a href={x.url} target="_blank" rel="noopener noreferrer nofollow" className="underline-offset-4 hover:underline">{x.brandName}</a> : x.brandName}</span>
                    {x.period ? <span className="text-ink-soft">, {x.period}</span> : null}
                    {x.description ? <span className="block text-sm text-ink-soft">{x.description}</span> : null}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-soft">Listed by the creator. GenCut has not verified these with the brands.</p>
            </div>
          )}
          {p.showInquiryForm && (
            <div className="mt-8">
              <h3 className="font-semibold">Send an inquiry</h3>
              {preview ? <p className="mt-2 text-sm text-ink-soft">The inquiry form appears here on the live page.</p> : <InquiryForm handle={p.handle} publicName={p.publicName} kinds={Object.entries(INQUIRY_KIND_LABELS)} />}
            </div>
          )}
        </section>
      )}

      <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft">
        <span>Updated {day(p.updatedAt)}</span>
        <a href="/" className="hover:text-ink">Made with GenCut Famous</a>
      </footer>
    </div>
  );
}
