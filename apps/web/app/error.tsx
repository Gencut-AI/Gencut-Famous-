'use client';

import Link from 'next/link';
import { Wordmark } from './_ui/icons.tsx';

/**
 * Shown when a page fails to load. The error itself is logged on the server
 * (Netlify function logs); the digest lets staff find that log line.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="py-4">
        <Link href="/" aria-label="GenCut Famous home">
          <Wordmark />
        </Link>
      </header>
      <section className="panel mt-8" role="alert">
        <h1 className="display text-4xl font-bold">This page didn't load</h1>
        <p className="mt-3 text-ink-soft">
          Something went wrong on our side. Your data is safe. Try again, and if it keeps happening, email
          hello@gencut.ai{error.digest ? ` with this reference: ${error.digest}` : ''}.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <button type="button" onClick={reset} className="btn h-14 text-lg">
            Try again
          </button>
          <Link href="/home" className="btn-quiet h-14 text-lg">
            Go to Home
          </Link>
        </div>
      </section>
    </main>
  );
}
