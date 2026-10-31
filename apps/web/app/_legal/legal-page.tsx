import Link from 'next/link';
import { Wordmark } from '../_ui/icons.tsx';
import type { ReactNode } from 'react';

/** Legal pages. Drafted by engineering from what the code does; marked until counsel reviews them (docs/decisions.md D-007). */
export const LEGAL_REVIEWED = false;
export const LEGAL_UPDATED = 'October 31, 2026';

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8">
      <header className="py-4">
        <Link href="/" aria-label="GenCut Famous home">
          <Wordmark />
        </Link>
      </header>
      <h1 className="display mt-8 text-4xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-ink-soft">Last updated {LEGAL_UPDATED}.</p>
      {!LEGAL_REVIEWED && <p className="mt-4 rounded-xl bg-[#fff1d6] p-4 text-sm text-[#7a4b00]">Draft under legal review. It describes how GenCut Famous actually handles data today.</p>}
      <div className="mt-8 flex flex-col gap-5 text-[0.98rem] leading-relaxed [&_h2]:display [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
        {children}
      </div>
      <footer className="mt-12 flex gap-6 border-t border-lilac pt-6 text-sm text-ink-soft">
        <Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/data-deletion">Data deletion</Link>
      </footer>
    </main>
  );
}
