import { type AdminSignup, type SignupStage, isAdmin, listSignups } from '@gencut/services';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { db } from '../../../lib/db.ts';
import { when } from '../../../lib/format.ts';
import { currentUser } from '../../../lib/session.ts';
import { Wordmark } from '../../_ui/icons.tsx';

export const metadata: Metadata = { title: 'Sign-ups', robots: { index: false } };
export const dynamic = 'force-dynamic';

const STAGE_LABELS: Record<SignupStage, string> = {
  onboarded: 'Set up',
  signed_in: 'Signed in, no profile yet',
  not_finished: 'Never finished sign-in',
};

const count = (people: readonly AdminSignup[], stage: SignupStage) => people.filter((p) => p.stage === stage).length;
const referrer = (p: AdminSignup) => p.creators.find((c) => c.referredByHandle)?.referredByHandle ?? null;
const time = (d: Date | null, known: boolean) => (d ? when(d) : known ? '—' : 'Unavailable');

/** GenCut staff only (GENCUT_ADMIN_EMAILS): who signed up, who signed in, and who got stuck. */
export default async function AdminSignupsPage() {
  const ctx = await currentUser();
  if (!ctx) redirect('/sign-in?next=/admin/signups');
  if (!isAdmin(ctx.email, process.env.GENCUT_ADMIN_EMAILS)) notFound();
  const { people, signInRecords } = await listSignups(db(), ctx, process.env.GENCUT_ADMIN_EMAILS);
  const known = signInRecords === 'available';
  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-10">
      <Wordmark size={28} />
      <h1 className="display mt-8 text-4xl">Sign-ups</h1>
      <p className="mt-2 text-ink-soft">
        {people.length} {people.length === 1 ? 'person' : 'people'}, newest first. Times are Eastern.{' '}
        <Link href="/admin/referrals" className="text-royal-deep underline-offset-4 hover:underline">Referral leads</Link>
      </p>
      <dl className="mt-6 grid grid-cols-3 gap-3">
        <div className="panel"><dt className="text-sm text-ink-soft">{STAGE_LABELS.onboarded}</dt><dd className="display text-3xl">{count(people, 'onboarded')}</dd></div>
        <div className="panel"><dt className="text-sm text-ink-soft">{STAGE_LABELS.signed_in}</dt><dd className="display text-3xl">{count(people, 'signed_in')}</dd></div>
        <div className="panel"><dt className="text-sm text-ink-soft">{STAGE_LABELS.not_finished}</dt><dd className="display text-3xl">{known ? count(people, 'not_finished') : '—'}</dd></div>
      </dl>
      {known ? null : (
        <p className="panel mt-3 text-sm text-ink-soft">
          Sign-in records could not be read, so people who never finished signing in are not listed and sign-in times are unavailable.
        </p>
      )}
      <div className="panel mt-6 overflow-x-auto p-0 sm:p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-lilac/70 text-ink-soft">
            <tr><th className="p-3">Email</th><th className="p-3">Status</th><th className="p-3">Creator</th><th className="p-3">Referred by</th><th className="p-3">First seen</th><th className="p-3">Last sign-in</th></tr>
          </thead>
          <tbody className="divide-y divide-lilac">
            {people.map((p) => (
              <tr key={p.email}>
                <td className="p-3"><a href={`mailto:${p.email}`} className="text-royal-deep underline-offset-4 hover:underline">{p.email}</a></td>
                <td className="p-3 font-semibold">{STAGE_LABELS[p.stage]}</td>
                <td className="p-3">{p.creators.length ? p.creators.map((c) => `@${c.handle}${c.role === 'manager' ? ' (manager)' : ''}`).join(', ') : '—'}</td>
                <td className="p-3">{referrer(p) ? `@${referrer(p)}` : '—'}</td>
                <td className="whitespace-nowrap p-3">{time(p.requestedAt ?? p.firstSeenAt, true)}</td>
                <td className="whitespace-nowrap p-3">{time(p.lastSignInAt, known)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
