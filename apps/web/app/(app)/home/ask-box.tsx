'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { type AskState, ask } from './actions.ts';

const SUGGESTIONS = ['How did my week perform?', 'What content performed best?', 'Any new inquiries?'];

export function AskBox() {
  const [state, action, pending] = useActionState<AskState, FormData>(ask, { status: 'idle' });
  return (
    <section aria-labelledby="ask" className="panel bg-glass/60">
      <h2 id="ask" className="display text-xl font-semibold">Ask GenCut</h2>
      <p className="mt-1 text-sm text-ink-soft">Answers come only from your connected accounts and GenCut records, with sources.</p>
      <form action={action} className="mt-4 flex gap-2">
        <label htmlFor="q" className="sr-only">Question</label>
        <input id="q" name="q" className="field" placeholder="How did my week perform?" maxLength={500} autoComplete="off" />
        <button type="submit" disabled={pending} className="btn shrink-0">{pending ? '…' : 'Ask'}</button>
      </form>
      {state.status === 'idle' ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <li key={s}>
              <form action={action}>
                <input type="hidden" name="q" value={s} />
                <button type="submit" className="min-h-9 rounded-full bg-paper px-3 text-sm text-bay-deep ring-1 ring-glass-deep hover:bg-glass">{s}</button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 rounded-xl bg-paper p-4" role="status">
          <p className="text-sm font-medium text-ink-soft">{state.question}</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-[0.95rem]">
            {state.lines.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
          {state.link && (
            <Link href={state.link.href} className="mt-3 inline-block min-h-11 content-center text-sm font-medium text-bay-deep underline-offset-4 hover:underline">
              {state.link.label} →
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
