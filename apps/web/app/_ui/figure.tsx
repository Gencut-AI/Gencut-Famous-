import { METRICS } from '@gencut/core';
import type { Figure } from '@gencut/services';
import { availabilityLabel, compact, n, sourceLabel, when } from '../../lib/format.ts';

/** A metric with everything the reader needs to trust it: source, period, read time, definition. */
export function FigureTile({ f, big }: { f: Figure; big?: boolean }) {
  const def = METRICS[f.metric];
  return (
    <div className="flex flex-col gap-1">
      <span className="eyebrow" title={def.definition}>{def.label}</span>
      {f.value === null ? (
        <span className="text-[0.95rem] text-ink-soft">{availabilityLabel(f.availability)}</span>
      ) : (
        <span className={`display font-semibold ${big ? 'text-4xl' : 'text-2xl'}`} title={n(f.value)}>
          {big ? compact(f.value) : n(f.value)}
        </span>
      )}
      <span className="text-xs text-ink-soft">
        {sourceLabel(f.source)} · {f.periodLabel} · read {when(f.retrievedAt)}
      </span>
    </div>
  );
}

/** Follower readings as a small line; drawn only from stored readings, never interpolated past them. */
export function Sparkline({ points, label }: { points: ReadonlyArray<{ date: string; value: number }>; label: string }) {
  if (points.length < 2) return null;
  const w = 240;
  const h = 48;
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const t0 = Date.parse(points[0]?.date ?? '');
  const t1 = Date.parse(points.at(-1)?.date ?? '');
  const tspan = t1 - t0 || 1;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${(((Date.parse(p.date) - t0) / tspan) * (w - 4) + 2).toFixed(1)} ${(h - 4 - ((p.value - lo) / span) * (h - 8)).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-full" role="img" aria-label={label} preserveAspectRatio="none">
      <path d={d} fill="none" stroke="var(--color-bay)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
