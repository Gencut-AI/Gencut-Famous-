'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Icons } from '../../_ui/icons.tsx';
import { type AskState, ask } from './actions.ts';

const SUGGESTIONS = ['How did my week perform?', 'What content performed best?', 'Any new inquiries?'];

export function AskBox() {
  const [state, action, pending] = useActionState<AskState, FormData>(ask, { status: 'idle' });
  return (
    <section aria-labelledby="ask" className="panel">
      <h2 id="ask" className="display text-2xl">Ask Famous</h2>
      <p className="mt-1 text-sm text-ink-soft">Answers come only from your connected accounts and GenCut records, with sources.</p>
      <form action={action} className="mt-4 flex items-center gap-2 rounded-full bg-white/90 p-1.5 pl-5 ring-1 ring-line focus-within:ring-royal">
        <label htmlFor="q" className="sr-only">Question</label>
        <input id="q" name="q" className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none" placeholder="How did my week perform?" maxLength={500} autoComplete="off" />
        <button type="submit" disabled={pending} className="grid size-11 shrink-0 place-items-center rounded-full bg-royal text-white hover:bg-royal-deep disabled:opacity-60" aria-label="Ask">
          <Icons.send width={20} height={20} />
        </button>
      </form>
      {state.status === 'idle' ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <li key={s}>
              <form action={action}>
                <input type="hidden" name="q" value={s} />
                <button type="submit" className="chip min-h-9 hover:bg-white">{s}</button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <div className="tile mt-4" role="status">
          <p className="text-sm font-semibold text-royal-deep">{state.question}</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-[0.95rem]">
            {state.lines.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
          {state.link && (
            <Link href={state.link.href} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-royal-deep underline-offset-4 hover:underline">
              {state.link.label}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
