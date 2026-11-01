import type { Metadata } from 'next';
import Link from 'next/link';
import { Wordmark } from '../_ui/icons.tsx';
import { redirect } from 'next/navigation';
import { safeNextPath } from '../../lib/safe-redirect.ts';
import { currentUser } from '../../lib/session.ts';
import { SignInForm } from './sign-in-form.tsx';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  if (await currentUser()) redirect(safeNextPath(next));

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="py-4">
        <Link href="/" aria-label="GenCut Famous home">
          <Wordmark />
        </Link>
      </header>
      <section className="panel mt-8">
        <h1 className="display text-4xl font-bold">Sign in</h1>
        <p className="mt-3 text-ink-soft">We'll email you a link and a code. No password to remember.</p>
        {error === 'link' && (
          <p className="mt-4 rounded-xl bg-[#ffe3ee] p-4 text-sm text-[#9c1747]" role="alert">
            That sign-in link didn't work. It may have expired or been used already. Request a new email below, then tap its link or type its code here.
          </p>
        )}
        <div className="mt-8">
          <SignInForm next={safeNextPath(next)} />
        </div>
      </section>
    </main>
  );
}
