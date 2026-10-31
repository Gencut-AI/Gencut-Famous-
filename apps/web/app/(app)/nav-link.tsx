'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icons } from '../_ui/icons.tsx';

export type IconName = keyof typeof Icons;

function useActive(href: string): boolean {
  const path = usePathname();
  return path === href || path.startsWith(`${href}/`);
}

/** Desktop rail item: icon and label, a filled pill when active. */
export function RailLink({ href, label, icon, badge }: { href: string; label: string; icon: IconName; badge?: number }) {
  const active = useActive(href);
  const I = Icons[icon];
  return (
    <Link href={href} aria-current={active ? 'page' : undefined} className={`flex min-h-12 items-center gap-3.5 rounded-full px-4 text-[1.02rem] transition-colors ${active ? 'bg-royal font-semibold text-white shadow-[0_10px_24px_-12px_rgb(91_43_224/0.8)]' : 'text-ink hover:bg-white/70'}`}>
      <I />
      <span className="flex-1">{label}</span>
      {badge ? <span className={`grid min-w-6 place-items-center rounded-full px-1.5 text-xs font-bold ${active ? 'bg-white text-royal' : 'bg-spark text-white'}`}>{badge}</span> : null}
    </Link>
  );
}

/** Phone tab: icon over a small label. */
export function TabLink({ href, label, icon, badge }: { href: string; label: string; icon: IconName; badge?: number }) {
  const active = useActive(href);
  const I = Icons[icon];
  return (
    <Link href={href} aria-current={active ? 'page' : undefined} className={`relative flex h-16 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-medium ${active ? 'text-royal' : 'text-ink-soft'}`}>
      <span className={`grid h-8 w-12 place-items-center rounded-full transition-colors ${active ? 'bg-lilac' : ''}`}>
        <I />
      </span>
      {label}
      {badge ? <span className="absolute top-1.5 right-[calc(50%-1.4rem)] size-2.5 rounded-full bg-spark ring-2 ring-white" aria-label={`${badge} new`} /> : null}
    </Link>
  );
}
