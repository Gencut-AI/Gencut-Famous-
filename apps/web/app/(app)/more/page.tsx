import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '../../../lib/session.ts';

export const metadata: Metadata = { title: 'More' };

const LINKS = [
  { href: '/channels', label: 'Channels', body: 'Connect Instagram and see what each connection can do.' },
  { href: '/brand', label: 'Brand profile', body: 'Identity, audience, voice, look, goals, partnerships.' },
  { href: '/inquiries', label: 'Inquiries', body: 'Messages from your media kit.' },
  { href: '/team', label: 'Team', body: 'Managers who work on your account.' },
  { href: '/privacy', label: 'Privacy', body: 'What GenCut stores and why.' },
] as const;

export default async function MorePage() {
  const { ctx } = await requireSession();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="display text-4xl font-bold">More</h1>
      <ul className="flex flex-col gap-3">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="panel block hover:border-ink-soft/40">
              <span className="display text-lg font-semibold">{l.label}</span>
              <span className="mt-1 block text-sm text-ink-soft">{l.body}</span>
            </Link>
          </li>
        ))}
      </ul>
      <form action="/auth/sign-out" method="post">
        <button type="submit" className="btn-quiet w-full">Sign out ({ctx.email})</button>
      </form>
    </div>
  );
}
