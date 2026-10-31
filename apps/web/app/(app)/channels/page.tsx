import { CONNECTORS, METRICS, PLATFORM_LABELS, can } from '@gencut/core';
import { listChannels, listDisconnected } from '@gencut/services';
import type { Metadata } from 'next';
import { instagramAccess, missingConnectorSettings } from '../../../lib/connectors.ts';
import { db } from '../../../lib/db.ts';
import { day, when } from '../../../lib/format.ts';
import { requireSession } from '../../../lib/session.ts';
import { StateBadge } from '../../_ui/state-badge.tsx';
import { disconnect, eraseData } from './actions.ts';

export const metadata: Metadata = { title: 'Channels' };

const MESSAGES: Record<string, string> = {
  denied: 'You cancelled the Instagram sign-in. Nothing was connected.',
  instagram: 'Instagram did not complete the sign-in. Try again.',
  state: 'That sign-in link expired or was started in another browser. Start again from this page.',
  not_configured: 'Connecting is switched off on this deployment until its Instagram app settings are added.',
  confirm: 'Tick the box to confirm before deleting data.',
};

export default async function ChannelsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx, workspace } = await requireSession();
  const q = await searchParams;
  const [channels, gone] = await Promise.all([listChannels(db(), ctx, workspace.workspaceId), listDisconnected(db(), ctx, workspace.workspaceId)]);
  const missing = missingConnectorSettings();
  const testers = instagramAccess() === 'testers';
  const canManage = can(workspace.role, 'manage_channels');
  const canDelete = can(workspace.role, 'delete_data');
  const error = q.error ? (q.error === 'refused' ? q.message : MESSAGES[q.error]) : null;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="display text-4xl font-bold">Channels</h1>
        <p className="mt-2 max-w-[62ch] text-ink-soft">
          Connect accounts with each platform's own sign-in. GenCut reads only what you allow, never posts in this version, and shows exactly what each connection can and cannot do.
        </p>
      </header>

      {error && <p role="alert" className="rounded-xl bg-[#fde7ec] p-4 text-sm text-[#7d1830]">{error}</p>}
      {q.connected && <p role="status" className="rounded-xl bg-glass p-4 text-sm text-bay-deep">Instagram connected{q.state === 'partially_connected' ? ', but without insights permission — see below.' : '. The first reading arrives within a minute.'}</p>}
      {q.disconnected && <p role="status" className="rounded-xl bg-glass p-4 text-sm text-bay-deep">Disconnected. GenCut deleted its copy of the token. To remove GenCut on Instagram too: Settings → Website permissions → Apps and websites.</p>}
      {q.deleted && <p role="status" className="rounded-xl bg-glass p-4 text-sm text-bay-deep">Deleted: the account's posts and readings are gone from GenCut.</p>}

      <ul className="flex flex-col gap-4">
        {CONNECTORS.map((m) => {
          const mine = channels.filter((c) => c.platform === m.platform);
          const available = m.build === 'available';
          return (
            <li key={m.platform} className={`panel ${available ? '' : 'bg-glass/40'}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="display text-2xl font-semibold">{PLATFORM_LABELS[m.platform]}</h2>
                  <p className="mt-1 text-sm text-ink-soft">{available ? m.oauth : `Not built yet · ${m.approval}`}</p>
                </div>
                {available && mine.length === 0 && (
                  testers && missing.length === 0 ? (
                    <div className="flex flex-col items-end gap-2">
                      <StateBadge state="pending_approval" />
                      {canManage && <a href="/api/connect/instagram/start" className="btn">Connect as a tester</a>}
                    </div>
                  ) : missing.length ? (
                    <span className="rounded-full bg-paper px-2.5 py-1 text-xs font-semibold text-ink-soft ring-1 ring-glass-deep">Not configured</span>
                  ) : (
                    canManage && <a href="/api/connect/instagram/start" className="btn">Connect Instagram</a>
                  )
                )}
                {!available && <span className="rounded-full bg-paper px-2.5 py-1 text-xs font-semibold text-ink-soft ring-1 ring-glass-deep">Roadmap</span>}
              </div>

              {available && testers && mine.length === 0 && missing.length === 0 && (
                <p className="mt-3 text-sm text-ink-soft">{m.approval} Ask GenCut to add your Instagram account as a tester first.</p>
              )}

              {mine.map((c) => (
                <div key={c.id} className="mt-5 flex flex-col gap-3 rounded-xl bg-white p-4 ring-1 ring-glass-deep">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">@{c.username}</p>
                      <p className="text-xs text-ink-soft">
                        {c.accountType === 'MEDIA_CREATOR' ? 'Creator account' : c.accountType === 'BUSINESS' ? 'Business account' : c.accountType ?? 'Account type unknown'} · connected {day(c.connectedAt)}
                        {c.accessExpiresAt ? ` · access renews before ${day(c.accessExpiresAt)}` : ''}
                      </p>
                    </div>
                    <StateBadge state={c.state} />
                  </div>
                  {c.missingScopes.length > 0 && (
                    <p className="text-sm text-[#7a5300]">Missing permission: {c.missingScopes.join(', ')}. Reach, views and post insights stay unavailable until you reconnect and allow it.</p>
                  )}
                  {c.authError && <p className="text-sm text-[#7d1830]">Instagram refused GenCut's access: {c.authError}. Reconnect to continue.</p>}
                  <p className="text-xs text-ink-soft">
                    {c.lastSyncedAt ? `Last read ${when(c.lastSyncedAt)} (${c.lastSyncStatus})` : 'Not read yet'}{c.lastSyncError ? ` — ${c.lastSyncError}` : ''}
                  </p>
                  {canManage && (
                    <div className="flex flex-wrap gap-2">
                      {(c.state !== 'connected') && missing.length === 0 && <a href="/api/connect/instagram/start" className="btn-quiet">Reconnect</a>}
                      <form action={disconnect}>
                        <input type="hidden" name="id" value={c.id} />
                        <button type="submit" className="btn-quiet">Disconnect</button>
                      </form>
                    </div>
                  )}
                </div>
              ))}

              {available && (
                <details className="mt-5 text-sm">
                  <summary className="min-h-11 cursor-pointer content-center font-medium text-bay-deep">What this connection can and cannot do</summary>
                  <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-[12rem_1fr]">
                    <dt className="font-medium">Permissions asked</dt><dd className="text-ink-soft">{m.requiredScopes.join(', ')}</dd>
                    <dt className="font-medium">Account types</dt><dd className="text-ink-soft">Creator or Business accounts</dd>
                    <dt className="font-medium">Profile info</dt><dd className="text-ink-soft">{m.profileInfo.join(', ')}</dd>
                    <dt className="font-medium">Analytics</dt><dd className="text-ink-soft">{m.analytics.map((k) => METRICS[k].label).join(', ')}</dd>
                    <dt className="font-medium">Publishing</dt><dd className="text-ink-soft">{m.publishing}</dd>
                    <dt className="font-medium">Access tokens</dt><dd className="text-ink-soft">{m.tokens}</dd>
                    <dt className="font-medium">Disconnecting</dt><dd className="text-ink-soft">{m.revocation}</dd>
                    <dt className="font-medium">Rate limits</dt><dd className="text-ink-soft">{m.rateLimits}</dd>
                    <dt className="font-medium">Approval</dt><dd className="text-ink-soft">{m.approval}</dd>
                    <dt className="font-medium">Not supported</dt><dd className="text-ink-soft"><ul className="list-disc pl-5">{m.unsupported.map((u) => <li key={u}>{u}</li>)}</ul></dd>
                  </dl>
                </details>
              )}
            </li>
          );
        })}
      </ul>

      {gone.length > 0 && (
        <section aria-labelledby="history" className="panel">
          <h2 id="history" className="display text-xl font-semibold">Disconnected accounts</h2>
          <p className="mt-1 text-sm text-ink-soft">GenCut no longer holds a token for these. Their past posts and readings are kept for your history until you delete them.</p>
          <ul className="mt-4 flex flex-col gap-3">
            {gone.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 ring-1 ring-glass-deep">
                <span>{PLATFORM_LABELS[g.platform]} @{g.username} · disconnected {day(g.revokedAt)}</span>
                {canDelete && (
                  <form action={eraseData} className="flex items-center gap-3">
                    <input type="hidden" name="id" value={g.id} />
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" className="size-4 accent-[#b42345]" />I understand this cannot be undone</label>
                    <button type="submit" className="min-h-11 rounded-xl px-3 text-sm font-medium text-[#b42345] ring-1 ring-[#f3c2cd] hover:bg-[#fde7ec]">Delete data</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
