import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AUTH_CALLBACK_PARAMS } from '../lib/site-url.ts';
import { currentUser } from '../lib/session.ts';

export const dynamic = 'force-dynamic';

const steps = [
  { title: 'Brand', body: 'Your voice, audience, look and the brands you will and won\'t work with, in one profile your team shares.' },
  { title: 'Measure', body: 'Connect your accounts with each platform\'s own sign-in. Every number shows where it came from and when.' },
  { title: 'Get booked', body: 'A media kit at your own link, with verified numbers and a simple way for brands to reach you.' },
] as const;

export default async function Landing({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // If Supabase falls back to the Site URL, finish the sign-in instead of showing the landing page.
  const params = await searchParams;
  if (typeof params.code === 'string' || typeof params.token_hash === 'string' || typeof params.error_code === 'string') {
    const forward = new URLSearchParams({ next: '/home' });
    for (const key of AUTH_CALLBACK_PARAMS) {
      const v = params[key];
      if (typeof v === 'string') forward.set(key, v);
    }
    redirect(`/auth/confirm?${forward.toString()}`);
  }
  if (await currentUser()) redirect('/home');

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-5 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-10">
      <header className="flex items-center justify-between py-4">
        <span className="display text-xl font-semibold">
          GenCut <span className="font-normal text-ink-soft">for Creators</span>
        </span>
        <Link href="/sign-in" className="flex min-h-11 items-center rounded-lg px-3 font-medium text-bay-deep hover:bg-glass">
          Sign in
        </Link>
      </header>

      <section className="mt-10 sm:mt-20">
        <p className="eyebrow">For creators, influencers and public figures</p>
        <h1 className="display mt-4 max-w-[15ch] text-[clamp(2.6rem,9vw,5.75rem)] font-bold">Your marketing team, on call.</h1>
        <p className="mt-6 max-w-[56ch] text-lg text-ink-soft">
          GenCut keeps your brand in one place, reads your real numbers from your own accounts, and gives brands a media kit
          they can trust. You stay in control of everything that goes out.
        </p>
        <Link href="/sign-in" className="btn mt-8 h-14 px-8 text-lg">
          Get started
        </Link>
      </section>

      <ol className="mt-14 grid gap-px overflow-hidden rounded-panel bg-glass-deep sm:grid-cols-3">
        {steps.map((s) => (
          <li key={s.title} className="bg-glass p-6">
            <h2 className="display text-2xl font-semibold text-bay-deep">{s.title}</h2>
            <p className="mt-2 text-[0.95rem] text-ink-soft">{s.body}</p>
          </li>
        ))}
      </ol>

      <footer className="mt-auto flex flex-wrap gap-x-6 gap-y-2 pt-14 text-sm text-ink-soft">
        <span>GenCut AI</span>
        <Link href="/privacy" className="hover:text-ink">Privacy</Link>
        <Link href="/terms" className="hover:text-ink">Terms</Link>
        <Link href="/data-deletion" className="hover:text-ink">Data deletion</Link>
      </footer>
    </main>
  );
}
