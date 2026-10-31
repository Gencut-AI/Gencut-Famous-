import Link from 'next/link';
import type { ReactNode } from 'react';
import { requireSession } from '../../lib/session.ts';
import { switchCreator } from './actions.ts';
import { NavLink } from './nav-link.tsx';

// Every signed-in screen depends on the request's session; never prerender.
export const dynamic = 'force-dynamic';

// Only screens that exist are linked. Film Crew, Calendar, Deal Radar and Deals join in their milestones.
const NAV = [
  { href: '/home', label: 'Home' },
  { href: '/brand', label: 'Brand' },
  { href: '/channels', label: 'Channels' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/page', label: 'Media kit' },
  { href: '/inquiries', label: 'Inquiries' },
  { href: '/team', label: 'Team' },
] as const;

const BOTTOM = [
  { href: '/home', label: 'Home' },
  { href: '/channels', label: 'Channels' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/page', label: 'Media kit' },
  { href: '/more', label: 'More' },
] as const;

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { workspace, memberships } = await requireSession();
  return (
    <div className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
      <header className="sticky top-0 z-10 border-b border-glass-deep bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-10">
          <Link href="/home" className="display shrink-0 text-xl font-semibold">
            GenCut <span className="hidden font-normal text-ink-soft sm:inline">for Creators</span>
          </Link>
          <nav aria-label="Main" className="hidden gap-1 text-[0.95rem] lg:flex">
            {NAV.map((n) => (
              <NavLink key={n.href} href={n.href}>{n.label}</NavLink>
            ))}
          </nav>
          <div className="flex min-w-0 items-center gap-2 text-sm text-ink-soft">
            {memberships.length > 1 ? (
              <form action={switchCreator} className="min-w-0">
                <label htmlFor="ws" className="sr-only">Creator</label>
                <select id="ws" name="workspaceId" defaultValue={workspace.workspaceId} className="h-10 max-w-[12rem] truncate rounded-lg border border-glass-deep bg-white px-2 text-sm text-ink">
                  {memberships.map((m) => (
                    <option key={m.workspaceId} value={m.workspaceId}>{m.name}{m.role === 'manager' ? ' (managing)' : ''}</option>
                  ))}
                </select>
                <button type="submit" className="ml-1 min-h-10 rounded-lg px-2 font-medium text-bay-deep hover:bg-glass">Open</button>
              </form>
            ) : (
              <span className="hidden max-w-[16ch] truncate sm:inline">{workspace.handle ? `@${workspace.handle}` : workspace.name}</span>
            )}
            <form action="/auth/sign-out" method="post" className="hidden lg:block">
              <button type="submit" className="min-h-11 rounded-lg px-2 hover:text-ink">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-10">{children}</main>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-glass-deep bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {BOTTOM.map((n) => (
          <NavLink key={n.href} href={n.href} bottom>{n.label}</NavLink>
        ))}
      </nav>
    </div>
  );
}
