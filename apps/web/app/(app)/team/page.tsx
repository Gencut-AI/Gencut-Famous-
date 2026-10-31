import { can } from '@gencut/core';
import { listInvitations, listTeam } from '@gencut/services';
import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '../../../lib/db.ts';
import { day } from '../../../lib/format.ts';
import { requireSession } from '../../../lib/session.ts';
import { remove, withdraw } from './actions.ts';
import { InviteForm } from './invite-form.tsx';

export const metadata: Metadata = { title: 'Team' };

export default async function TeamPage() {
  const { ctx, workspace, memberships } = await requireSession();
  const owner = can(workspace.role, 'manage_team');
  const [team, invites] = await Promise.all([listTeam(db(), ctx, workspace.workspaceId), owner ? listInvitations(db(), ctx, workspace.workspaceId) : Promise.resolve([])]);
  const open = invites.filter((i) => !i.acceptedAt && !i.revokedAt && i.expiresAt.getTime() > Date.now());
  const ownsOne = memberships.some((m) => m.role === 'owner');

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="display text-4xl font-bold">Team</h1>
        <p className="mt-2 max-w-[62ch] text-ink-soft">Managers can edit the brand profile, connect accounts and publish the media kit. Only the creator can change who has access or delete data.</p>
      </header>
      <section className="panel flex flex-col gap-4">
        <ul className="flex flex-col divide-y divide-glass">
          {team.map((t) => (
            <li key={t.userId} className="flex items-center justify-between gap-3 py-3">
              <span className="min-w-0 truncate">{t.email}{t.userId === ctx.userId ? ' (you)' : ''}</span>
              <span className="flex items-center gap-3">
                <span className="text-sm text-ink-soft">{t.role === 'owner' ? 'Creator' : 'Manager'}</span>
                {owner && t.role === 'manager' && (
                  <form action={remove}><input type="hidden" name="userId" value={t.userId} /><button type="submit" className="min-h-10 text-sm text-[#b42345]">Remove</button></form>
                )}
              </span>
            </li>
          ))}
        </ul>
        {owner && <InviteForm />}
        {owner && open.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-glass pt-4">
            <h2 className="text-sm font-semibold">Open invitations</h2>
            {open.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3 text-sm">
                <span>{i.email} · expires {day(i.expiresAt)}</span>
                <form action={withdraw}><input type="hidden" name="id" value={i.id} /><button type="submit" className="min-h-10 text-ink-soft hover:text-[#b42345]">Withdraw</button></form>
              </div>
            ))}
          </div>
        )}
      </section>
      {!ownsOne && (
        <p className="text-sm text-ink-soft">Are you a creator yourself? <Link href="/onboarding?another=1" className="font-medium text-bay-deep">Set up your own workspace</Link>.</p>
      )}
    </div>
  );
}
