'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function NavLink({ href, children, bottom }: { href: string; children: ReactNode; bottom?: boolean }) {
  const path = usePathname();
  const active = path === href || path.startsWith(`${href}/`);
  return bottom ? (
    <Link href={href} aria-current={active ? 'page' : undefined} className={`flex h-16 flex-col items-center justify-center gap-1 text-[0.75rem] font-medium ${active ? 'text-bay-deep' : 'text-ink-soft'}`}>
      <span aria-hidden className={`h-1 w-6 rounded-full ${active ? 'bg-bay' : 'bg-transparent'}`} />
      {children}
    </Link>
  ) : (
    <Link href={href} aria-current={active ? 'page' : undefined} className={`rounded-lg px-2.5 py-1.5 ${active ? 'bg-glass text-ink' : 'text-ink-soft hover:text-ink'}`}>
      {children}
    </Link>
  );
}
