import { listMemberships } from '@gencut/services';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Wordmark } from '../_ui/icons.tsx';
import { redirect } from 'next/navigation';
import { publicBase } from '../../lib/connectors.ts';
import { db } from '../../lib/db.ts';
import { currentUser } from '../../lib/session.ts';
import { OnboardingForm } from './onboarding-form.tsx';

export const metadata: Metadata = { title: 'Welcome' };
export const dynamic = 'force-dynamic';

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ another?: string }> }) {
  const ctx = await currentUser();
  if (!ctx) redirect('/sign-in?next=/onboarding');
  const { another } = await searchParams;
  if (!another && (await listMemberships(db(), ctx)).length) redirect('/home');
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="py-4">
        <Link href="/" aria-label="GenCut Famous home">
          <Wordmark />
        </Link>
      </header>
      <section className="panel mt-6">
        <h1 className="display mt-2 text-4xl font-bold">Let's set you up</h1>
        <p className="mt-3 text-ink-soft">Two things to start. Signed in as {ctx.email}.</p>
        <div className="mt-8">
          <OnboardingForm publicBase={await publicBase()} />
        </div>
        <p className="mt-8 text-sm text-ink-soft">
          Joining a creator's team? Open the invitation link they sent you instead.
        </p>
      </section>
    </main>
  );
}
