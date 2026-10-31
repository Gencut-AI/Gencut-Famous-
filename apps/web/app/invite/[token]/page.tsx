
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '../../../lib/db.ts';
import { currentUser } from '../../../lib/session.ts';
import { acceptAndOpen } from './actions.ts';

export const metadata: Metadata = { title: 'Invitation', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const { error } = await searchParams;
  const ctx = await currentUser();
  if (!ctx) redirect(`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="py-4">
        <Link href="/" className="display text-xl font-semibold">GenCut <span className="font-normal text-ink-soft">for Creators</span></Link>
      </header>
      <section className="mt-10">
        <h1 className="display text-4xl font-bold">Join a creator's team</h1>
        <p className="mt-3 text-ink-soft">You'll be able to edit their brand profile, connect their accounts and manage their media kit. Only the creator can change who has access.</p>
        {error && <p role="alert" className="mt-6 rounded-xl bg-[#fde7ec] p-4 text-sm text-[#7d1830]">{error}</p>}
        <form action={acceptAndOpen} className="mt-8">
          <input type="hidden" name="token" value={token} />
          <button type="submit" className="btn h-14 w-full text-lg">Accept as {ctx.email}</button>
        </form>
      </section>
    </main>
  );
}

