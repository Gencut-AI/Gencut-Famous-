import { PLATFORM_LABELS, can } from '@gencut/core';
import { PROFILE_CONTENT_MAX, getCreatorProfile, getPageSettings, listContent } from '@gencut/services';
import type { Metadata } from 'next';
import Link from 'next/link';
import { publicBase } from '../../../lib/connectors.ts';
import { db } from '../../../lib/db.ts';
import { day, when } from '../../../lib/format.ts';
import { requireSession } from '../../../lib/session.ts';
import { publish, toggleContent } from './actions.ts';
import { CopyButton } from './copy-button.tsx';
import { SettingsForm } from './settings-form.tsx';

export const metadata: Metadata = { title: 'Media kit' };

const SOURCES = ['instagram', 'tiktok', 'youtube', 'linkedin', 'email'] as const;

export default async function MediaKitPage() {
  const { ctx, workspace } = await requireSession();
  const ws = workspace.workspaceId;
  const [profile, page, content] = await Promise.all([getCreatorProfile(db(), ctx, ws), getPageSettings(db(), ctx, ws), listContent(db(), ctx, ws)]);
  const url = `${await publicBase()}/@${profile.handle}`;
  const shown = content.filter((c) => c.shownOnProfile).length;
  const canPublish = can(workspace.role, 'publish_profile');

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl font-bold">Media kit</h1>
          <p className="mt-2 max-w-[60ch] text-ink-soft">Your public page for brands, press and fans. It shows only what you choose here.</p>
        </div>
        <Link href="/page/preview" className="btn-quiet">Preview</Link>
      </header>

      <section aria-labelledby="status" className={`panel flex flex-col gap-4 ${page.published ? 'border-bay' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="status" className="display text-xl font-semibold">
              {page.published ? (<><span className="rec-dot mr-2 inline-block size-2.5 rounded-full bg-flamingo align-middle" aria-hidden />Live</>) : 'Not published'}
            </h2>
            <p className="text-sm text-ink-soft">{page.published && page.publishedAt ? `Published ${when(page.publishedAt)}` : 'Only your team can see the preview.'}</p>
          </div>
          {canPublish && (
            <form action={publish}>
              <input type="hidden" name="publish" value={page.published ? 'no' : 'yes'} />
              <button type="submit" className={page.published ? 'btn-quiet' : 'btn'}>{page.published ? 'Unpublish' : 'Publish'}</button>
            </form>
          )}
        </div>
        {!page.published && (
          <p className="text-sm text-ink-soft">Publishing makes public: your name, handle, photo, bio, brand message, categories, the numbers and posts you pick below, your style images, self-reported partnerships and links to your connected accounts. Never public: your legal name, rate card, brands you avoid, goals or audience notes.</p>
        )}
        <div className="flex gap-2">
          <input readOnly value={url} className="field font-medium" aria-label="Your media kit link" />
          <CopyButton text={url} />
        </div>
      </section>

      <section aria-labelledby="settings" className="panel">
        <h2 id="settings" className="display mb-5 text-xl font-semibold">What it shows</h2>
        <SettingsForm headline={page.headline ?? ''} workWithMe={page.workWithMe ?? ''} showInquiryForm={page.showInquiryForm} shownMetrics={page.shownMetrics} />
      </section>

      <section aria-labelledby="posts" className="panel">
        <h2 id="posts" className="display text-xl font-semibold">Featured posts</h2>
        <p className="mt-1 text-sm text-ink-soft">Pick up to {PROFILE_CONTENT_MAX}. {shown} chosen. Each links to the post on its platform.</p>
        {content.length === 0 ? (
          <p className="mt-4 text-ink-soft">Connect an account to choose posts. <Link href="/channels" className="font-medium text-bay-deep">Channels →</Link></p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-glass">
            {content.slice(0, 30).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate">{c.caption ?? 'No caption'}</p>
                  <p className="text-xs text-ink-soft">{PLATFORM_LABELS[c.platform]}{c.publishedAt ? ` · ${day(c.publishedAt)}` : ''}</p>
                </div>
                <form action={toggleContent}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="shown" value={c.shownOnProfile ? 'no' : 'yes'} />
                  <button type="submit" className={c.shownOnProfile ? 'btn' : 'btn-quiet'} aria-pressed={c.shownOnProfile}>{c.shownOnProfile ? 'Featured' : 'Feature'}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="share" className="panel">
        <h2 id="share" className="display text-xl font-semibold">Share and track</h2>
        <p className="mt-1 text-sm text-ink-soft">Use a tagged link in each place so the dashboard shows where visits come from. Visits are counted once per visitor per day; no personal data is kept.</p>
        <div className="mt-5 grid gap-6 md:grid-cols-[1fr_12rem]">
          <ul className="flex flex-col gap-2">
            {SOURCES.map((s) => {
              const tagged = `${url}?src=${s}`;
              return (
                <li key={s} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-sm font-medium capitalize">{s === 'email' ? 'Email' : PLATFORM_LABELS[s]}</span>
                  <input readOnly value={tagged} className="field text-sm" aria-label={`Link for ${s}`} />
                  <CopyButton text={tagged} />
                </li>
              );
            })}
          </ul>
          <figure className="flex flex-col items-center gap-2">
            <img src={`/api/qr?handle=${encodeURIComponent(profile.handle)}&src=qr`} alt={`QR code for ${url}`} className="size-44 rounded-xl ring-1 ring-glass-deep" />
            <figcaption className="text-center text-xs text-ink-soft">QR code (tagged “qr”)</figcaption>
            <a href={`/api/qr?handle=${encodeURIComponent(profile.handle)}&src=qr`} download={`gencut-${profile.handle}-qr.svg`} className="text-sm font-medium text-bay-deep">Download SVG</a>
          </figure>
        </div>
      </section>
    </div>
  );
}
