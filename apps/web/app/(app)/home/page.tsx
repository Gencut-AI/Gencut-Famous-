import { type ConnectionState, PLATFORM_LABELS, type Platform, PROFILE_SECTIONS, sectionStatus } from '@gencut/core';
import { getCreatorProfile, getDashboard, getPageSettings, getReferralOverview, listMedia, syncWorkspace } from '@gencut/services';
import type { Metadata } from 'next';
import Link from 'next/link';
import { after } from 'next/server';
import { connectorDeps, publicBase } from '../../../lib/connectors.ts';
import { db } from '../../../lib/db.ts';
import { day, n, signed, when } from '../../../lib/format.ts';
import { requireSession } from '../../../lib/session.ts';
import { Avatar } from '../../_ui/avatar.tsx';
import { FigureTile, Sparkline } from '../../_ui/figure.tsx';
import { Icons } from '../../_ui/icons.tsx';
import { StateBadge } from '../../_ui/state-badge.tsx';
import { CopyButton } from '../page/copy-button.tsx';
import { refreshNow } from './actions.ts';
import { AskBox } from './ask-box.tsx';

export const metadata: Metadata = { title: 'Home' };

function greeting(now: Date): string {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/New_York' }).format(now));
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

const SHORT: Record<Platform, string> = { instagram: 'IG', youtube: 'YT', tiktok: 'TT', facebook: 'FB', threads: 'TH', linkedin: 'LI', x: 'X' };

const RING: Record<ConnectionState, string> = {
  connected: 'bg-royal',
  partially_connected: 'bg-[#f0a92e]',
  pending_approval: 'bg-[#f0a92e]',
  expired: 'bg-[#e0386f]',
  revoked: 'bg-line',
  unsupported: 'bg-[#e0386f]',
  error: 'bg-[#e0386f]',
};

export default async function HomePage() {
  const { ctx, workspace } = await requireSession();
  const ws = workspace.workspaceId;
  const [profile, d, page, media, ref] = await Promise.all([getCreatorProfile(db(), ctx, ws), getDashboard(db(), ctx, ws), getPageSettings(db(), ctx, ws), listMedia(db(), ctx, ws), getReferralOverview(db(), ctx, ws)]);
  const joinLink = `${await publicBase()}/join/${ref.code}`;
  const photo = media.find((m) => m.kind === 'profile_photo');

  // Read connected accounts after the page is sent if they are due (at most every 15 minutes); never holds the page.
  const deps = connectorDeps();
  if (deps && d.channels.length) after(() => syncWorkspace(db(), ctx, ws, deps).then(() => undefined, () => undefined));

  const sections = sectionStatus(profile);
  const done = PROFILE_SECTIONS.filter((s) => sections[s]).length;
  const setup = [
    { done: done >= 3, label: 'Fill in your brand', detail: `${done} of ${PROFILE_SECTIONS.length} sections done`, href: '/brand' },
    { done: profile.socialLinks.length > 0 || d.channels.length > 0, label: 'Add your social links', detail: profile.socialLinks.length ? `${profile.socialLinks.length} on your media kit` : 'So brands can find you everywhere', href: '/page#links' },
    { done: page.published, label: 'Publish your media kit', detail: page.published ? 'Live' : 'Your link for brands', href: '/page' },
  ];

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar src={photo ? `/media/${photo.id}` : null} name={profile.publicName} size={72} live={page.published} />
          <div>
            <h1 className="display text-[clamp(2rem,6vw,3.25rem)]">{greeting(new Date())}, {profile.publicName.split(' ')[0]}</h1>
            <p className="mt-1 text-ink-soft">@{profile.handle}{workspace.role === 'manager' ? ', you are managing this account' : ''}</p>
          </div>
        </div>
        {d.channels.length > 0 && (
          <form action={refreshNow}>
            <button type="submit" className="btn-quiet">Refresh numbers</button>
          </form>
        )}
      </section>

      <nav aria-label="Your channels" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-5 pb-1">
          {d.channels.map((c) => (
            <li key={c.channel.id}>
              <Link href="/channels" className="flex w-20 flex-col items-center gap-1.5 text-center">
                <span className={`grid size-[4.25rem] place-items-center rounded-full p-[3px] ${RING[c.channel.state]}`}>
                  <span className="display grid size-full place-items-center rounded-full bg-white text-lg text-royal-deep">{SHORT[c.channel.platform]}</span>
                </span>
                <span className="w-full truncate text-xs">@{c.channel.username}</span>
              </Link>
            </li>
          ))}
          <li>
            <Link href="/page" className="flex w-20 flex-col items-center gap-1.5 text-center">
              <span className={`grid size-[4.25rem] place-items-center rounded-full p-[3px] ${page.published ? 'bg-spark' : 'bg-line'}`}>
                <span className="grid size-full place-items-center rounded-full bg-white text-royal-deep"><Icons.kit /></span>
              </span>
              <span className="text-xs">{page.published ? 'Kit is live' : 'Media kit'}</span>
            </Link>
          </li>
          <li>
            <Link href="/channels" className="flex w-20 flex-col items-center gap-1.5 text-center">
              <span className="grid size-[4.25rem] place-items-center rounded-full border-2 border-dashed border-royal/50 text-royal"><Icons.plus /></span>
              <span className="text-xs">Add channel</span>
            </Link>
          </li>
        </ul>
      </nav>

      <section aria-labelledby="invite" className="panel flex flex-col gap-4 bg-gradient-to-br from-white/75 to-lilac/80">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="invite" className="display text-2xl">Invite creators</h2>
          <Link href="/referrals" className="text-sm font-semibold text-royal-deep underline-offset-4 hover:underline">See your results</Link>
        </div>
        <div className="flex gap-2">
          <input readOnly value={joinLink} className="field font-semibold text-royal-deep" aria-label="Your invite link" />
          <CopyButton text={joinLink} />
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[{ k: 'Visits', v: ref.visits30 }, { k: 'Leads', v: ref.leads.length }, { k: 'Joined', v: ref.signups.length }].map((x) => (
            <div key={x.k} className="tile p-3"><dd className="display text-2xl">{n(x.v)}</dd><dt className="text-xs text-ink-soft">{x.k}{x.k === 'Visits' ? ', 30 days' : ''}</dt></div>
          ))}
        </dl>
      </section>

      {setup.some((s) => !s.done) && (
        <section aria-labelledby="setup" className="panel">
          <h2 id="setup" className="display text-2xl">Get set up</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            {setup.map((s, i) => (
              <li key={s.href}>
                <Link href={s.href} className={`flex h-full items-center gap-3 rounded-tile p-4 ring-1 transition-colors ${s.done ? 'bg-lilac/70 ring-transparent' : 'bg-white/80 ring-line hover:ring-royal'}`}>
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold ${s.done ? 'bg-royal text-white' : 'bg-lilac text-royal-deep'}`}>{s.done ? '✓' : i + 1}</span>
                  <span className="flex flex-col">
                    <span className="font-semibold">{s.label}</span>
                    <span className="text-sm text-ink-soft">{s.detail}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {d.channels.length === 0 ? (
        <section className="panel flex flex-col items-start gap-3">
          <h2 className="display text-2xl">No numbers yet</h2>
          {deps ? (
            <>
              <p className="max-w-[52ch] text-ink-soft">Connect Instagram and your followers, reach and top posts appear here. GenCut never estimates a number it has not read.</p>
              <Link href="/channels" className="btn">Connect Instagram</Link>
            </>
          ) : (
            <>
              <p className="max-w-[52ch] text-ink-soft">Connecting Instagram for verified numbers is coming soon. GenCut never estimates a number it has not read. Meanwhile, add your social links so brands can find you.</p>
              <Link href="/page#links" className="btn">Add your social links</Link>
            </>
          )}
        </section>
      ) : (
        d.channels.map((c) => (
          <section key={c.channel.id} aria-label={`${PLATFORM_LABELS[c.channel.platform]} @${c.channel.username}`} className="settle grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="panel flex flex-col gap-4 sm:col-span-2 lg:row-span-2">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{PLATFORM_LABELS[c.channel.platform]} <span className="font-normal text-ink-soft">@{c.channel.username}</span></p>
                <StateBadge state={c.channel.state} />
              </div>
              {c.followers ? <FigureTile f={c.followers} big /> : <p className="text-sm text-ink-soft">Not read yet. The first reading arrives within a minute of connecting.</p>}
              <Sparkline points={c.followerSeries} label={`Followers on ${PLATFORM_LABELS[c.channel.platform]}, one reading per day`} />
              <div className="mt-auto grid grid-cols-2 gap-3">
                {[{ label: 'Last 7 days', g: c.growth7 }, { label: 'Last 30 days', g: c.growth30 }].map(({ label, g }) => (
                  <div key={label} className="tile">
                    <span className="eyebrow">{label}</span>
                    {g ? (
                      <>
                        <p className={`display mt-1 text-[1.75rem] ${g.change < 0 ? 'text-[#c0264f]' : 'text-royal'}`}>{signed(g.change)}</p>
                        <p className="text-xs text-ink-soft">From {n(g.from)} on {day(g.fromAt)}</p>
                      </>
                    ) : (
                      <p className="mt-1 text-sm text-ink-soft">{c.historyStarts ? `Needs more history; readings start ${day(c.historyStarts)}` : 'No readings yet'}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {c.week.map((f) => (
              <div key={f.metric} className="panel">
                <FigureTile f={f} />
              </div>
            ))}
            {c.channel.lastSyncError && <p className="text-xs text-ink-soft sm:col-span-2 lg:col-span-4">Last check: {c.channel.lastSyncError}</p>}
          </section>
        ))
      )}

      {d.combinedFollowers && d.combinedFollowers.sources.length > 1 && (
        <p className="tile text-sm">{n(d.combinedFollowers.value)} followers in total. {d.combinedFollowers.label}.</p>
      )}

      <AskBox />

      <section aria-labelledby="top" className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="top" className="display text-[1.75rem]">Top posts</h2>
          <Link href="/analytics" className="min-h-11 content-center text-sm font-semibold text-royal-deep underline-offset-4 hover:underline">All posts</Link>
        </div>
        {d.topContent.length === 0 ? (
          <p className="text-ink-soft">No post readings yet.</p>
        ) : (
          <ol className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {d.topContent.slice(0, 4).map((c, i) => {
              const f = c.figures.find((x) => x.metric === c.rankedBy);
              const tile = (
                <>
                  <span className="text-xs font-semibold text-royal-deep">#{i + 1}{c.publishedAt ? `, ${day(c.publishedAt)}` : ''}</span>
                  <span className="line-clamp-4 text-[0.95rem] leading-snug">{c.caption ?? 'No caption'}</span>
                  {f && f.value !== null && (
                    <span className="mt-auto">
                      <span className="display block text-2xl">{n(f.value)}</span>
                      <span className="text-xs text-ink-soft">{f.metric === 'views' ? 'views' : f.metric === 'interactions' ? 'interactions' : 'likes'} since posted</span>
                    </span>
                  )}
                </>
              );
              return (
                <li key={c.id}>
                  {c.permalink ? (
                    <a href={c.permalink} target="_blank" rel="noopener noreferrer" className="tile flex aspect-square flex-col gap-2 bg-gradient-to-br from-white/80 to-lilac/80 transition-transform hover:-translate-y-0.5" aria-label={`Post ${i + 1}, open on ${PLATFORM_LABELS[c.platform]}`}>{tile}</a>
                  ) : (
                    <div className="tile flex aspect-square flex-col gap-2">{tile}</div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {d.topContent.length > 0 && <p className="text-xs text-ink-soft">Ranked by views where Instagram reports them, then interactions, then likes.</p>}
      </section>

      <section aria-label="Media kit and business" className="grid gap-3 md:grid-cols-3">
        <div className="panel flex flex-col gap-2">
          <span className="eyebrow">Media kit visits, last 7 days</span>
          <span className="display text-[2.5rem]">{n(d.visits.last7)}</span>
          <span className="text-xs text-ink-soft">{n(d.visits.last30)} in the last 30 days, counted by GenCut</span>
          {d.visits.bySource.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {d.visits.bySource.map((s) => <li key={s.source} className="chip">{s.source} {n(s.visits)}</li>)}
            </ul>
          )}
          {!page.published && <Link href="/page" className="mt-auto pt-2 text-sm font-semibold text-royal-deep">Publish your media kit</Link>}
        </div>
        <Link href="/inquiries" className="panel flex flex-col gap-2 transition-colors hover:bg-white/80">
          <span className="eyebrow">Inquiries</span>
          <span className="display text-[2.5rem]">{n(d.inquiries.unread)} <span className="font-sans text-base font-normal tracking-normal text-ink-soft">unread</span></span>
          <span className="text-xs text-ink-soft">{n(d.inquiries.last30)} in the last 30 days</span>
        </Link>
        <div className="panel flex flex-col gap-2">
          <span className="eyebrow">Partnerships and earnings</span>
          <span className="text-[0.95rem] text-ink-soft">Not set up yet. The deal pipeline arrives in a later release, and nothing here is estimated.</span>
        </div>
      </section>

      <p className="text-xs text-ink-soft">Numbers come from each platform's official API, with their period and the time GenCut read them. Page loaded {when(new Date())}.</p>
    </div>
  );
}
