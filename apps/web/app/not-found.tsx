import type { Metadata } from 'next';
import Link from 'next/link';
import { Wordmark } from './_ui/icons.tsx';

export const metadata: Metadata = { title: 'Page not found', robots: { index: false } };

/** Shown for unknown addresses, media kits that are not published and invite links that do not exist. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="py-4">
        <Link href="/" aria-label="GenCut Famous home">
          <Wordmark />
        </Link>
      </header>
      <section className="panel mt-8">
        <h1 className="display text-4xl font-bold">Nothing here</h1>
        <p className="mt-3 text-ink-soft">
          This link may have a typo, or the media kit or invite it points to isn't published. Ask the person who shared it
          for a fresh link.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link href="/" className="btn h-14 text-lg">
            Go to GenCut Famous
          </Link>
          <Link href="/sign-in" className="btn-quiet h-14 text-lg">
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
