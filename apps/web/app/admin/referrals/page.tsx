import { REFERRAL_LEAD_ROLE_LABELS } from '@gencut/core';
import { isAdmin, listAllReferralLeads } from '@gencut/services';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { db } from '../../../lib/db.ts';
import { when } from '../../../lib/format.ts';
import { currentUser } from '../../../lib/session.ts';
import { Wordmark } from '../../_ui/icons.tsx';

export const metadata: Metadata = { title: 'Referral leads', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** GenCut staff only (GENCUT_ADMIN_EMAILS): every referral lead with its email, to follow up. */
export default async function AdminReferralsPage() {
  const ctx = await currentUser();
  if (!ctx) redirect('/sign-in?next=/admin/referrals');
  if (!isAdmin(ctx.email, process.env.GENCUT_ADMIN_EMAILS)) notFound();
  const leads = await listAllReferralLeads(db(), ctx, process.env.GENCUT_ADMIN_EMAILS);
  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-10">
      <Wordmark size={28} />
      <h1 className="display mt-8 text-4xl">Referral leads</h1>
      <p className="mt-2 text-ink-soft">{leads.length} lead{leads.length === 1 ? '' : 's'}. Each person agreed to be emailed by GenCut about GenCut Famous.</p>
      <div className="panel mt-6 overflow-x-auto p-0 sm:p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-lilac/70 text-ink-soft">
            <tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Handle</th><th className="p-3">Role</th><th className="p-3">Referred by</th><th className="p-3">From</th><th className="p-3">When</th><th className="p-3">Joined</th></tr>
          </thead>
          <tbody className="divide-y divide-lilac">
            {leads.map((l, i) => (
              <tr key={`${l.email}-${i}`}>
                <td className="p-3 font-semibold">{l.name}</td>
                <td className="p-3"><a href={`mailto:${l.email}`} className="text-royal-deep underline-offset-4 hover:underline">{l.email}</a></td>
                <td className="p-3">{l.socialHandle ? `@${l.socialHandle}` : '—'}</td>
                <td className="p-3">{REFERRAL_LEAD_ROLE_LABELS[l.role]}</td>
                <td className="p-3">@{l.referrerHandle}</td>
                <td className="p-3">{l.src ?? 'direct'}</td>
                <td className="whitespace-nowrap p-3">{when(l.createdAt)}</td>
                <td className="p-3">{l.joined ? 'Yes' : 'Not yet'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
