import { METRICS, type MetricKey, PLATFORM_LABELS } from '@gencut/core';
import { listContent } from '@gencut/services';
import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '../../../lib/db.ts';
import { availabilityLabel, day, n, when } from '../../../lib/format.ts';
import { requireSession } from '../../../lib/session.ts';

export const metadata: Metadata = { title: 'Analytics' };

const COLUMNS: readonly MetricKey[] = ['views', 'reach', 'likes', 'comments', 'shares', 'saves'];

export default async function AnalyticsPage() {
  const { ctx, workspace } = await requireSession();
  const content = await listContent(db(), ctx, workspace.workspaceId);
  const latestRead = content.flatMap((c) => c.figures.map((f) => f.retrievedAt)).sort((a, b) => b.getTime() - a.getTime())[0];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="display text-4xl font-bold">Analytics</h1>
        <p className="mt-2 max-w-[62ch] text-ink-soft">
          Your recent posts with the numbers each platform reports for them since they were posted.
          {latestRead ? ` Last read ${when(latestRead)}.` : ''} A dash means the platform does not report that number for the post.
        </p>
      </header>

      {content.length === 0 ? (
        <div className="panel flex flex-col items-start gap-3">
          <p className="text-ink-soft">No posts read yet.</p>
          <Link href="/channels" className="btn">Connect Instagram</Link>
        </div>
      ) : (
        <>
          {/* Phones: one card per post. Wider screens: a table. */}
          <ul className="flex flex-col gap-3 md:hidden">
            {content.map((c) => (
              <li key={c.id} className="panel flex flex-col gap-3">
                <span className="eyebrow">{PLATFORM_LABELS[c.platform]}{c.publishedAt ? ` · ${day(c.publishedAt)}` : ''}</span>
                <p className="line-clamp-2">{c.caption ?? 'No caption'}</p>
                <dl className="grid grid-cols-3 gap-3">
                  {COLUMNS.map((m) => {
                    const f = c.figures.find((x) => x.metric === m);
                    return (
                      <div key={m}>
                        <dt className="eyebrow">{METRICS[m].label}</dt>
                        <dd className="font-semibold" title={f && f.value === null ? availabilityLabel(f.availability) : undefined}>{f?.value != null ? n(f.value) : '—'}</dd>
                      </div>
                    );
                  })}
                </dl>
                {c.permalink && <a href={c.permalink} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-bay-deep">Open ↗</a>}
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-panel ring-1 ring-glass-deep md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Recent posts and their platform-reported numbers since posting</caption>
              <thead className="bg-glass text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  <th scope="col" className="p-3">Post</th>
                  <th scope="col" className="p-3">Posted</th>
                  {COLUMNS.map((m) => <th key={m} scope="col" className="p-3 text-right" title={METRICS[m].definition}>{METRICS[m].label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-glass bg-paper">
                {content.map((c) => (
                  <tr key={c.id}>
                    <td className="max-w-[24rem] p-3">
                      {c.permalink ? <a href={c.permalink} target="_blank" rel="noopener noreferrer" className="line-clamp-2 hover:text-bay-deep">{c.caption ?? 'No caption'}</a> : <span className="line-clamp-2">{c.caption ?? 'No caption'}</span>}
                      <span className="text-xs text-ink-soft">{PLATFORM_LABELS[c.platform]}{c.mediaType === 'CAROUSEL_ALBUM' ? ' · carousel (no insights from Meta)' : ''}</span>
                    </td>
                    <td className="whitespace-nowrap p-3 text-ink-soft">{c.publishedAt ? day(c.publishedAt) : '—'}</td>
                    {COLUMNS.map((m) => {
                      const f = c.figures.find((x) => x.metric === m);
                      return <td key={m} className="p-3 text-right tabular-nums" title={f ? (f.value === null ? availabilityLabel(f.availability) : `read ${when(f.retrievedAt)}`) : 'Not reported'}>{f?.value != null ? n(f.value) : '—'}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
