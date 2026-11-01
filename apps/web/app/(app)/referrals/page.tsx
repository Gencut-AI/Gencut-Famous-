import { REFERRAL_LEAD_ROLE_LABELS, joinRate } from '@gencut/core';
import { getReferralOverview } from '@gencut/services';
import type { Metadata } from 'next';
import { publicBase } from '../../../lib/connectors.ts';
import { db } from '../../../lib/db.ts';
import { day, n } from '../../../lib/format.ts';
import { requireSession } from '../../../lib/session.ts';
import { CopyButton } from '../page/copy-button.tsx';

export const metadata: Metadata = { title: 'Referrals' };

const PLACES = [
  { src: 'instagram', label: 'Instagram bio or story' },
  { src: 'tiktok', label: 'TikTok bio' },
  { src: 'youtube', label: 'YouTube description' },
  { src: 'x', label: 'X post' },
  { src: 'email', label: 'Email or DM' },
] as const;

export default async function ReferralsPage() {
  const { ctx, workspace } = await requireSession();
  const r = await getReferralOverview(db(), ctx, workspace.workspaceId);
  const link = `${await publicBase()}/join/${r.code}`;
  const rate = joinRate(r.visitsAll, r.signups.length);
  const stats = [
    { label: 'Visits, last 7 days', value: n(r.visits7), note: `${n(r.visits30)} in 30 days` },
    { label: 'Leads', value: n(r.leads.length), note: 'Left their details' },
    { label: 'Joined', value: n(r.signups.length), note: 'Created an account' },
    { label: 'Join rate', value: rate === null ? '—' : `${rate}%`, note: rate === null ? 'No visits yet' : 'Of all visitors' },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="display text-[clamp(2.25rem,6vw,3.5rem)]">Invite creators</h1>
        <p className="mt-2 max-w-[56ch] text-ink-soft">Post your link. Everyone who visits, leaves their details or joins through it is counted here as yours.</p>
      </header>

      <section aria-labelledby="link" className="panel flex flex-col gap-4">
        <h2 id="link" className="display text-2xl">Your link</h2>
        <div className="flex gap-2">
          <input readOnly value={link} className="field text-base font-semibold text-royal-deep" aria-label="Your invite link" />
          <CopyButton text={link} />
        </div>
        <div className="grid gap-6 md:grid-cols-[1fr_11rem]">
          <div>
            <p className="text-sm text-ink-soft">Use a tagged link in each place so you can see which one works best.</p>
            <ul className="mt-3 flex flex-col gap-2">
              {PLACES.map((p) => {
                const tagged = `${link}?src=${p.src}`;
                return (
                  <li key={p.src} className="flex items-center gap-2">
                    <span className="flex-1 text-sm font-medium sm:w-40 sm:flex-none">{p.label}</span>
                    <input readOnly value={tagged} className="field hidden h-11 flex-1 text-sm sm:block" aria-label={`Link for ${p.label}`} />
                    <CopyButton text={tagged} />
                  </li>
                );
              })}
            </ul>
          </div>
          <figure className="flex flex-col items-center gap-2">
            <img src={`/api/qr?kind=join&handle=${encodeURIComponent(r.code)}&src=qr`} alt={`QR code for ${link}`} className="size-40 rounded-tile ring-1 ring-line" />
            <figcaption className="text-center text-xs text-ink-soft">QR code for stories, flyers and events</figcaption>
            <a href={`/api/qr?kind=join&handle=${encodeURIComponent(r.code)}&src=qr`} download={`gencut-join-${r.code}.svg`} className="text-sm font-semibold text-royal-deep">Download</a>
          </figure>
        </div>
        <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-royal-deep underline-offset-4 hover:underline">See what people see</a>
      </section>

      <section aria-label="Results" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="panel">
            <p className="eyebrow">{s.label}</p>
            <p className="display mt-1 text-[2.5rem]">{s.value}</p>
            <p className="text-xs text-ink-soft">{s.note}</p>
          </div>
        ))}
      </section>

      {r.bySource.length > 0 && (
        <section aria-labelledby="where" className="panel">
          <h2 id="where" className="display text-xl">Where visits came from</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {r.bySource.map((s) => <li key={s.source} className="chip">{s.source} {n(s.visits)}</li>)}
          </ul>
        </section>
      )}

      <section aria-labelledby="joined" className="panel">
        <h2 id="joined" className="display text-xl">Joined through you</h2>
        {r.signups.length === 0 ? (
          <p className="mt-2 text-ink-soft">No one yet. Share your link to get started.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-lilac">
            {r.signups.map((s) => (
              <li key={s.handle} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0 truncate"><span className="font-semibold">{s.publicName}</span> <span className="text-ink-soft">@{s.handle}</span></span>
                <span className="shrink-0 text-sm text-ink-soft">{day(s.joinedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="leads" className="panel">
        <h2 id="leads" className="display text-xl">Leads</h2>
        <p className="mt-1 text-sm text-ink-soft">People who left their details on your join page. GenCut follows up with them; you see names and handles, not email addresses.</p>
        {r.leads.length === 0 ? (
          <p className="mt-3 text-ink-soft">No leads yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-lilac">
            {r.leads.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0 truncate">
                  <span className="font-semibold">{l.name}</span>
                  {l.socialHandle ? <span className="text-ink-soft"> @{l.socialHandle}</span> : null}
                  <span className="block text-xs text-ink-soft">{REFERRAL_LEAD_ROLE_LABELS[l.role]}, {day(l.createdAt)}</span>
                </span>
                <span className={`chip shrink-0 ${l.joined ? '' : 'bg-white/80 text-ink-soft'}`}>{l.joined ? 'Joined' : 'Lead'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
