import { INQUIRY_KIND_LABELS, METRICS, PLATFORM_LABELS } from '@gencut/core';
import type { PublicProfile } from '@gencut/services';
import { compact, day, n, sourceLabel, when } from '../../../lib/format.ts';
import { InquiryForm } from './inquiry-form.tsx';

/** The media kit. Shared by the public page and the team's preview; shows only what the creator chose. */
export function ProfileView({ p, preview }: { p: PublicProfile; preview?: boolean }) {
  const accent = p.accent ?? 'var(--color-bay)';
  return (
    <div className="mx-auto max-w-3xl px-5 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8">
      <div aria-hidden className="h-1.5 w-24 rounded-full" style={{ background: accent }} />
      <header className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center">
        {p.photoId ? (
          <img src={`${preview ? '/media' : '/public-media'}/${p.photoId}`} alt={p.publicName} className="size-28 shrink-0 rounded-full object-cover ring-4 ring-glass sm:size-36" />
        ) : (
          <div aria-hidden className="display grid size-28 shrink-0 place-items-center rounded-full bg-glass text-4xl font-bold text-bay-deep sm:size-36">{p.publicName.slice(0, 1)}</div>
        )}
        <div className="min-w-0">
          <h1 className="display text-[clamp(2.2rem,8vw,3.75rem)] font-bold">{p.publicName}</h1>
          <p className="mt-1 text-ink-soft">@{p.handle}</p>
          {p.headline && <p className="mt-3 text-lg">{p.headline}</p>}
          {p.niches.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Categories">
              {p.niches.map((x) => <li key={x} className="rounded-full bg-glass px-2.5 py-1 text-xs font-medium text-bay-deep">{x}</li>)}
            </ul>
          )}
        </div>
      </header>

      {(p.bio || p.brandMessage) && (
        <section className="mt-10 flex flex-col gap-3 text-lg">
          {p.bio && <p>{p.bio}</p>}
          {p.brandMessage && <p className="text-ink-soft">{p.brandMessage}</p>}
        </section>
      )}

      {p.metrics.length > 0 && (
        <section aria-labelledby="numbers" className="mt-12">
          <h2 id="numbers" className="display text-2xl font-semibold">By the numbers</h2>
          <p className="mt-1 text-sm text-ink-soft">Read by GenCut from the creator's connected accounts through each platform's official API.</p>
          <ul className={`mt-5 grid gap-3 ${p.metrics.length % 3 === 0 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            {p.metrics.map((f) => (
              <li key={`${f.source}-${f.metric}`} className="flex flex-col gap-1 rounded-panel border border-glass-deep bg-paper p-5">
                <span className="eyebrow">{PLATFORM_LABELS[f.source as keyof typeof PLATFORM_LABELS]} · {METRICS[f.metric].label}</span>
                <span className="display text-4xl font-semibold" title={f.value === null ? '' : n(f.value)}>{f.value === null ? '—' : compact(f.value)}</span>
                <span className="text-xs text-ink-soft">{f.periodLabel} · verified from {sourceLabel(f.source)} · read {when(f.retrievedAt)}</span>
              </li>
            ))}
          </ul>
          {new Set(p.metrics.map((m) => m.source)).size > 1 && <p className="mt-2 text-xs text-ink-soft">Figures are per platform and are not added together: someone who follows on two platforms is counted on each.</p>}
        </section>
      )}

      {p.links.length > 0 && (
        <section aria-labelledby="follow" className="mt-12">
          <h2 id="follow" className="display text-2xl font-semibold">Follow me everywhere</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {p.links.map((l) => (
              <li key={`${l.platform}-${l.username}`}>
                {l.url ? (
                  <a href={l.url} target="_blank" rel="noopener noreferrer me" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-4 font-medium ring-1 ring-glass-deep hover:ring-bay">
                    {PLATFORM_LABELS[l.platform]} <span className="text-ink-soft">@{l.username}</span>
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {p.content.length > 0 && (
        <section aria-labelledby="work" className="mt-12">
          <h2 id="work" className="display text-2xl font-semibold">Featured content</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {p.content.map((c) => (
              <li key={c.id}>
                <a href={c.permalink} target="_blank" rel="noopener noreferrer" className="panel flex h-full flex-col gap-2 hover:border-ink-soft/40">
                  <span className="eyebrow">{PLATFORM_LABELS[c.platform]}{c.publishedAt ? ` · ${day(c.publishedAt)}` : ''}</span>
                  <span className="line-clamp-4 text-[0.95rem]">{c.caption ?? 'View post'}</span>
                  <span className="mt-auto text-sm font-medium text-bay-deep">View on {PLATFORM_LABELS[c.platform]} ↗</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {p.examples.length > 0 && (
        <section aria-labelledby="style" className="mt-12">
          <h2 id="style" className="display text-2xl font-semibold">Style</h2>
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {p.examples.map((e) => (
              <li key={e.id}>
                <img src={`${preview ? '/media' : '/public-media'}/${e.id}`} alt={e.caption ?? `Example of ${p.publicName}'s work`} loading="lazy" className="aspect-square w-full rounded-xl object-cover" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {(p.workWithMe || p.partnerships.length > 0 || p.showInquiryForm) && (
        <section aria-labelledby="hire" className="mt-12 rounded-panel bg-glass p-6 sm:p-8">
          <h2 id="hire" className="display text-3xl font-semibold">Work with me</h2>
          {p.workWithMe && <p className="mt-3 whitespace-pre-line text-lg">{p.workWithMe}</p>}
          {p.partnerships.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold">Past partnerships <span className="ml-1 rounded-full bg-paper px-2 py-0.5 text-xs font-medium text-ink-soft ring-1 ring-glass-deep">Self-reported</span></h3>
              <ul className="mt-3 flex flex-col gap-2">
                {p.partnerships.map((x) => (
                  <li key={x.id} className="text-[0.95rem]">
                    <span className="font-medium">{x.url ? <a href={x.url} target="_blank" rel="noopener noreferrer nofollow" className="underline-offset-4 hover:underline">{x.brandName}</a> : x.brandName}</span>
                    {x.period ? <span className="text-ink-soft"> · {x.period}</span> : null}
                    {x.description ? <span className="text-ink-soft"> — {x.description}</span> : null}
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

      <footer className="mt-14 flex flex-wrap justify-between gap-3 border-t border-glass pt-6 text-sm text-ink-soft">
        <span>Updated {day(p.updatedAt)}</span>
        <a href="/" className="hover:text-ink">Media kit by GenCut for Creators</a>
      </footer>
    </div>
  );
}
