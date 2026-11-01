import { countUnreadInquiries } from '@gencut/services';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { db } from '../../lib/db.ts';
import { requireSession } from '../../lib/session.ts';
import { Wordmark } from '../_ui/icons.tsx';
import { switchCreator } from './actions.ts';
import { type IconName, RailLink, TabLink } from './nav-link.tsx';

// Every signed-in screen depends on the request's session; never prerender.
export const dynamic = 'force-dynamic';

// Only screens that exist are linked. Film Crew, Calendar, Deal Radar and Deals join in their milestones.
const RAIL: ReadonlyArray<{ href: string; label: string; icon: IconName }> = [
  { href: '/home', label: 'Home', icon: 'home' },
  { href: '/referrals', label: 'Referrals', icon: 'invite' },
  { href: '/channels', label: 'Channels', icon: 'channels' },
  { href: '/analytics', label: 'Analytics', icon: 'analytics' },
  { href: '/page', label: 'Media kit', icon: 'kit' },
  { href: '/inquiries', label: 'Inquiries', icon: 'inbox' },
  { href: '/brand', label: 'Brand', icon: 'brand' },
  { href: '/team', label: 'Team', icon: 'team' },
];

const TABS: ReadonlyArray<{ href: string; label: string; icon: IconName }> = [
  { href: '/home', label: 'Home', icon: 'home' },
  { href: '/referrals', label: 'Invite', icon: 'invite' },
  { href: '/analytics', label: 'Analytics', icon: 'analytics' },
  { href: '/page', label: 'Kit', icon: 'kit' },
  { href: '/more', label: 'More', icon: 'more' },
];

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { ctx, workspace, memberships } = await requireSession();
  const unread = await countUnreadInquiries(db(), ctx, workspace.workspaceId);
  const switcher = memberships.length > 1 && (
    <form action={switchCreator} className="flex items-center gap-2">
      <label htmlFor="ws" className="sr-only">Creator</label>
      <select id="ws" name="workspaceId" defaultValue={workspace.workspaceId} className="h-10 min-w-0 flex-1 truncate rounded-full border border-line bg-white/80 px-3 text-sm">
        {memberships.map((m) => (
          <option key={m.workspaceId} value={m.workspaceId}>{m.handle ? `@${m.handle}` : m.name}{m.role === 'manager' ? ' (managing)' : ''}</option>
        ))}
      </select>
      <button type="submit" className="min-h-10 rounded-full px-3 text-sm font-semibold text-royal-deep hover:bg-white/70">Switch</button>
    </form>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 border-r border-white/70 bg-white/40 px-4 py-6 backdrop-blur-xl lg:flex">
        <Link href="/home" className="px-3"><Wordmark /></Link>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {RAIL.map((n) => <RailLink key={n.href} {...n} badge={n.href === '/inquiries' ? unread : undefined} />)}
        </nav>
        <div className="mt-auto flex flex-col gap-3 px-1">
          {switcher || <p className="truncate px-3 text-sm text-ink-soft">{workspace.handle ? `@${workspace.handle}` : workspace.name}{workspace.role === 'manager' ? ', managing' : ''}</p>}
          <form action="/auth/sign-out" method="post">
            <button type="submit" className="min-h-10 w-full rounded-full px-3 text-left text-sm text-ink-soft hover:bg-white/70 hover:text-ink">Sign out</button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/70 bg-white/55 px-5 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl lg:hidden">
          <Link href="/home"><Wordmark size={28} /></Link>
          <Link href="/inquiries" className="relative grid size-11 place-items-center rounded-full text-ink hover:bg-white/70" aria-label={unread ? `Inquiries, ${unread} unread` : 'Inquiries'}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="m4 7 8 6 8-6" /></svg>
            {unread > 0 && <span className="absolute top-1.5 right-1.5 grid min-w-5 place-items-center rounded-full bg-spark px-1 text-[0.65rem] font-bold text-white">{unread}</span>}
          </Link>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
          {memberships.length > 1 && <div className="mb-6 lg:hidden">{switcher}</div>}
          {children}
        </main>
      </div>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-white/70 bg-white/70 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        {TABS.map((n) => <TabLink key={n.href} {...n} badge={n.href === '/more' ? unread : undefined} />)}
      </nav>
    </div>
  );
}
