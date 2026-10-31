import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AUTH_CALLBACK_PARAMS } from '../lib/site-url.ts';
import { currentUser } from '../lib/session.ts';
import { Icons, Wordmark } from './_ui/icons.tsx';

export const dynamic = 'force-dynamic';

const STEPS = [
  { icon: 'brand', title: 'Your brand, in one place', body: "Your voice, audience, look and the brands you will and won't work with. Your team works from the same profile." },
  { icon: 'analytics', title: 'Real numbers only', body: "Connect with each platform's own sign-in. Every number shows where it came from and when GenCut read it." },
  { icon: 'kit', title: 'A link brands trust', body: 'A media kit at your own link, with verified numbers, your best posts and a simple way to reach you.' },
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
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 pb-10 pt-[max(1rem,env(safe-area-inset-top))] sm:px-10">
      <header className="flex items-center justify-between py-4">
        <Wordmark />
        <Link href="/sign-in" className="btn-quiet">Sign in</Link>
      </header>

      <section className="mt-10 grid items-center gap-12 lg:mt-20 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <h1 className="display text-[clamp(3rem,10vw,6.5rem)]">Get booked for being you.</h1>
          <p className="mt-6 max-w-[48ch] text-lg text-ink-soft">
            GenCut Famous is the AI helper for influencers and creators: your brand, your real numbers and a media kit brands can
            trust. Nothing goes out without your yes.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/sign-in" className="btn h-14 px-8 text-lg">Get started free</Link>
          </div>
        </div>

        <figure className="panel relative mx-auto w-full max-w-sm rotate-[-2deg]">
          <figcaption className="chip absolute -top-3 right-5 bg-white text-xs">Example media kit</figcaption>
          <div className="flex items-center gap-4">
            <span className="grid size-20 shrink-0 place-items-center rounded-full bg-royal p-[3px]"><span className="display grid size-full place-items-center rounded-full bg-lilac text-3xl text-royal-deep">Y</span></span>
            <div>
              <p className="display text-2xl">Your name</p>
              <p className="text-ink-soft">@yourhandle</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            {['Followers', 'Reach', 'Views'].map((m) => (
              <div key={m} className="tile p-3">
                <p className="display text-lg text-royal">Verified</p>
                <p className="text-xs text-ink-soft">{m}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="aspect-square rounded-xl bg-gradient-to-br from-lilac to-[#d8c9ff]" />)}
          </div>
          <span className="btn mt-4 w-full">Work with me</span>
        </figure>
      </section>

      <ul className="mt-20 grid gap-3 sm:grid-cols-3">
        {STEPS.map((s) => {
          const I = Icons[s.icon];
          return (
            <li key={s.title} className="panel">
              <span className="grid size-11 place-items-center rounded-full bg-lilac text-royal"><I /></span>
              <h2 className="display mt-4 text-[1.6rem]">{s.title}</h2>
              <p className="mt-2 text-[0.95rem] text-ink-soft">{s.body}</p>
            </li>
          );
        })}
      </ul>

      <footer className="mt-auto flex flex-wrap gap-x-6 gap-y-2 pt-16 text-sm text-ink-soft">
        <span>GenCut AI</span>
        <Link href="/privacy" className="hover:text-ink">Privacy</Link>
        <Link href="/terms" className="hover:text-ink">Terms</Link>
        <Link href="/data-deletion" className="hover:text-ink">Data deletion</Link>
      </footer>
    </main>
  );
}
