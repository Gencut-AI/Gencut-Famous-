import { PLATFORM_LABELS, PROFILE_SECTIONS, sectionStatus } from '@gencut/core';
import { getCreatorProfile, getDashboard, getPageSettings, syncWorkspace } from '@gencut/services';
import type { Metadata } from 'next';
import { after } from 'next/server';
import Link from 'next/link';
import { connectorDeps } from '../../../lib/connectors.ts';
import { db } from '../../../lib/db.ts';
import { compact, day, n, signed, when } from '../../../lib/format.ts';
import { requireSession } from '../../../lib/session.ts';
import { FigureTile, Sparkline } from '../../_ui/figure.tsx';
import { StateBadge } from '../../_ui/state-badge.tsx';
import { refreshNow } from './actions.ts';
import { AskBox } from './ask-box.tsx';

export const metadata: Metadata = { title: 'Home' };

function greeting(now: Date): string {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/New_York' }).format(now));
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

export default async function HomePage() {
  const { ctx, workspace } = await requireSession();
  const ws = workspace.workspaceId;
  const [profile, d, page] = await Promise.all([getCreatorProfile(db(), ctx, ws), getDashboard(db(), ctx, ws), getPageSettings(db(), ctx, ws)]);

  // Read connected accounts after the page is sent if they are due (at most every 15 minutes); never holds the page.
  const deps = connectorDeps();
  if (deps && d.channels.length) after(() => syncWorkspace(db(), ctx, ws, deps).then(() => undefined, () => undefined));

  const sections = sectionStatus(profile);
  const done = PROFILE_SECTIONS.filter((s) => sections[s]).length;
  const setup = [
    { done: done >= 3, label: 'Fill in your brand profile', detail: `${done} of ${PROFILE_SECTIONS.length} sections`, href: '/brand' },
    { done: d.channels.length > 0, label: 'Connect Instagram', detail: d.channels.length ? `${d.channels.length} connected` : 'Read your real numbers', href: '/channels' },
    { done: page.published, label: 'Publish your media kit', detail: page.published ? 'Live' : 'Not published', href: '/page' },
  ];

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl font-bold sm:text-5xl">{greeting(new Date())}, {profile.publicName.split(' ')[0]}</h1>
          <p className="mt-2 text-ink-soft">@{profile.handle}{workspace.role === 'manager' ? ' · you are managing this creator' : ''}</p>
        </div>
        {d.channels.length > 0 && (
          <form action={refreshNow}>
            <button type="submit" className="btn-quiet">Refresh numbers</button>
          </form>
        )}
      </section>

      {setup.some((s) => !s.done) && (
        <section aria-labelledby="setup" className="panel">
          <h2 id="setup" className="display text-xl font-semibold">Get set up</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            {setup.map((s, i) => (
              <li key={s.href}>
                <Link href={s.href} className={`flex h-full flex-col gap-1 rounded-xl p-4 ring-1 ${s.done ? 'bg-glass ring-glass' : 'bg-white ring-glass-deep hover:ring-bay'}`}>
                  <span className="text-xs font-semibold text-ink-soft">{s.done ? 'Done' : `Step ${i + 1}`}</span>
                  <span className="font-semibold">{s.label}</span>
                  <span className="text-sm text-ink-soft">{s.detail}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section aria-labelledby="audience" className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="audience" className="display text-2xl font-semibold">Audience</h2>
          <Link href="/channels" className="min-h-11 content-center text-sm font-medium text-bay-deep underline-offset-4 hover:underline">Channels</Link>
        </div>
        {d.channels.length === 0 ? (
          <div className="panel flex flex-col items-start gap-3">
            <p className="text-ink-soft">No accounts connected, so there are no numbers yet. GenCut never estimates them.</p>
            <Link href="/channels" className="btn">Connect Instagram</Link>
          </div>
        ) : (
          <>
            {d.combinedFollowers && d.combinedFollowers.sources.length > 1 && (
              <div className="panel">
                <span className="eyebrow">Followers, all platforms</span>
                <p className="display mt-1 text-4xl font-semibold">{compact(d.combinedFollowers.value)}</p>
                <p className="mt-1 text-xs text-ink-soft">{d.combinedFollowers.label}.</p>
              </div>
            )}
            <ul className="grid gap-4 md:grid-cols-2">
              {d.channels.map((c) => (
                <li key={c.channel.id} className="panel flex flex-col gap-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="eyebrow">{PLATFORM_LABELS[c.channel.platform]}</p>
                      <p className="truncate font-semibold">@{c.channel.username}</p>
                    </div>
                    <StateBadge state={c.channel.state} />
                  </div>
                  {c.followers ? <FigureTile f={c.followers} big /> : <p className="text-sm text-ink-soft">Not read yet. The first reading appears within a minute of connecting.</p>}
                  <Sparkline points={c.followerSeries} label={`Followers on ${PLATFORM_LABELS[c.channel.platform]}, one reading per day`} />
                  <div className="grid grid-cols-2 gap-4 border-t border-glass pt-4">
                    {[{ label: '7 days', g: c.growth7 }, { label: '30 days', g: c.growth30 }].map(({ label, g }) => (
                      <div key={label} className="flex flex-col gap-1">
                        <span className="eyebrow">Change, {label}</span>
                        {g ? (
                          <>
                            <span className={`display text-2xl font-semibold ${g.change < 0 ? 'text-[#b42345]' : ''}`}>{signed(g.change)}</span>
                            <span className="text-xs text-ink-soft">{n(g.from)} on {day(g.fromAt)} → {n(g.to)}</span>
                          </>
                        ) : (
                          <span className="text-sm text-ink-soft">{c.historyStarts ? `Needs more history (from ${day(c.historyStarts)})` : 'No readings yet'}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {c.week.length > 0 && (
                    <div className="grid grid-cols-2 gap-4 border-t border-glass pt-4">
                      {c.week.map((f) => <FigureTile key={f.metric} f={f} />)}
                    </div>
                  )}
                  {c.channel.lastSyncError && <p className="text-xs text-ink-soft">Last check: {c.channel.lastSyncError}</p>}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <AskBox />

      <section aria-labelledby="top" className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="top" className="display text-2xl font-semibold">Top content</h2>
          <Link href="/analytics" className="min-h-11 content-center text-sm font-medium text-bay-deep underline-offset-4 hover:underline">All posts</Link>
        </div>
        {d.topContent.length === 0 ? (
          <p className="text-ink-soft">No post readings yet.</p>
        ) : (
          <ol className="grid gap-3 md:grid-cols-3">
            {d.topContent.slice(0, 3).map((c, i) => {
              const f = c.figures.find((x) => x.metric === c.rankedBy);
              return (
                <li key={c.id} className="panel flex flex-col gap-3">
                  <span className="eyebrow">#{i + 1} · {PLATFORM_LABELS[c.platform]}{c.publishedAt ? ` · ${day(c.publishedAt)}` : ''}</span>
                  <p className="line-clamp-3 text-[0.95rem]">{c.caption ?? 'No caption'}</p>
                  {f && <FigureTile f={f} />}
                  {c.permalink && <a href={c.permalink} target="_blank" rel="noopener noreferrer" className="mt-auto text-sm font-medium text-bay-deep underline-offset-4 hover:underline">Open on {PLATFORM_LABELS[c.platform]} ↗</a>}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section aria-labelledby="kit" className="grid gap-4 md:grid-cols-3">
        <h2 id="kit" className="sr-only">Media kit and business</h2>
        <div className="panel flex flex-col gap-2">
          <span className="eyebrow">Media kit visits</span>
          <span className="display text-3xl font-semibold">{n(d.visits.last7)}</span>
          <span className="text-xs text-ink-soft">Last 7 days · GenCut · {n(d.visits.last30)} in 30 days</span>
          {d.visits.bySource.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {d.visits.bySource.map((s) => (
                <li key={s.source} className="flex justify-between gap-2"><span className="truncate">{s.source}</span><span className="font-medium">{n(s.visits)}</span></li>
              ))}
            </ul>
          )}
          {!page.published && <Link href="/page" className="mt-auto text-sm font-medium text-bay-deep">Publish your media kit →</Link>}
        </div>
        <Link href="/inquiries" className="panel flex flex-col gap-2 hover:border-ink-soft/40">
          <span className="eyebrow">Inquiries</span>
          <span className="display text-3xl font-semibold">{n(d.inquiries.unread)} <span className="text-base font-normal text-ink-soft">unread</span></span>
          <span className="text-xs text-ink-soft">{n(d.inquiries.last30)} in the last 30 days · GenCut</span>
        </Link>
        <div className="panel flex flex-col gap-2">
          <span className="eyebrow">Partnerships and earnings</span>
          <span className="text-[0.95rem] text-ink-soft">Not set up yet. The deal pipeline arrives in a later release; nothing here is estimated.</span>
        </div>
      </section>

      <p className="text-xs text-ink-soft">Numbers are read from each platform's official API and shown with their period and the time GenCut read them. Last page load {when(new Date())}.</p>
    </div>
  );
}
