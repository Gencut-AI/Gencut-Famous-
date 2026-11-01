import { getJoinPage } from '@gencut/services';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { db } from '../../../lib/db.ts';
import { currentUser } from '../../../lib/session.ts';
import { Avatar } from '../../_ui/avatar.tsx';
import { Icons, Wordmark } from '../../_ui/icons.tsx';
import { JoinBeacon, LeadForm } from './join-client.tsx';

export const dynamic = 'force-dynamic';

const load = cache((code: string) => getJoinPage(db(), decodeURIComponent(code)));

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const p = await load((await params).code);
  if (!p) return { title: 'Invite not found', robots: { index: false } };
  return {
    title: { absolute: `${p.publicName} invited you to GenCut Famous` },
    description: 'Your brand, your real numbers and a media kit brands trust. Free to start.',
    openGraph: { title: `${p.publicName} invited you to GenCut Famous`, description: 'Your brand, your real numbers and a media kit brands trust.', siteName: 'GenCut Famous' },
    robots: { index: false },
  };
}

const BENEFITS = [
  { icon: 'kit', title: 'A media kit at your own link', body: 'Your best posts and verified numbers on one page, with a simple way for brands to reach you.' },
  { icon: 'analytics', title: 'Your real numbers in one place', body: "Connect Instagram with its own sign-in. Every number shows where it came from and when it was read." },
  { icon: 'brand', title: 'Your brand, organised', body: 'Voice, audience, rates and the brands you want, ready for every pitch.' },
] as const;

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const p = await load(code);
  if (!p) notFound();
  if (await currentUser()) redirect('/home');
  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
      <JoinBeacon code={p.code} />
      <header className="flex items-center justify-between py-3">
        <Wordmark size={26} />
        <a href="/sign-in" className="btn-quiet min-h-10 px-4 text-sm">Sign in</a>
      </header>

      <section className="panel mt-6 text-center">
        <div className="flex justify-center">
          <Avatar src={p.photoId ? `/public-media/${p.photoId}` : null} name={p.publicName} size={96} />
        </div>
        <p className="mt-4 text-ink-soft">{p.publicName} <span className="text-ink-soft">@{p.handle}</span></p>
        <h1 className="display mt-2 text-[clamp(2.2rem,8vw,3.5rem)]">invited you to GenCut Famous</h1>
        <p className="mx-auto mt-4 max-w-[44ch] text-lg text-ink-soft">The AI helper for creators: your brand, your real numbers and a media kit brands can trust. Free to start.</p>
        <a href={`/api/join/${encodeURIComponent(p.code)}`} className="btn mt-7 h-14 w-full px-8 text-lg sm:w-auto">Create my free account</a>
        <p className="mt-3 text-sm text-ink-soft">Takes about two minutes. We email you a sign-in link; no password.</p>
      </section>

      <ul className="mt-4 grid gap-3">
        {BENEFITS.map((b) => {
          const I = Icons[b.icon];
          return (
            <li key={b.title} className="tile flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-lilac text-royal"><I /></span>
              <span>
                <span className="block font-semibold">{b.title}</span>
                <span className="text-[0.95rem] text-ink-soft">{b.body}</span>
              </span>
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="later" className="panel mt-6">
        <h2 id="later" className="display text-2xl">Not ready yet?</h2>
        <p className="mt-1 mb-5 text-sm text-ink-soft">Leave your details and GenCut will be in touch.</p>
        <LeadForm code={p.code} referrerName={p.publicName} />
      </section>

      <footer className="mt-10 flex flex-wrap justify-between gap-3 text-sm text-ink-soft">
        <span>GenCut AI</span>
        <span className="flex gap-4"><a href="/privacy">Privacy</a><a href="/terms">Terms</a></span>
      </footer>
    </main>
  );
}
