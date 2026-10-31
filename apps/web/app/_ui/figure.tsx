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
        <span className={`display ${big ? 'text-[3.25rem]' : 'text-[1.75rem]'}`} title={n(f.value)}>
          {big ? compact(f.value) : n(f.value)}
        </span>
      )}
      <span className="text-xs leading-snug text-ink-soft">
        {sourceLabel(f.source)}, {f.periodLabel}
        <br />
        Read {when(f.retrievedAt)}
      </span>
    </div>
  );
}

/** Follower readings as a small line with a soft fill; drawn only from stored readings. */
export function Sparkline({ points, label }: { points: ReadonlyArray<{ date: string; value: number }>; label: string }) {
  if (points.length < 2) return null;
  const w = 240;
  const h = 56;
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const t0 = Date.parse(points[0]?.date ?? '');
  const t1 = Date.parse(points.at(-1)?.date ?? '');
  const tspan = t1 - t0 || 1;
  const xy = points.map((p) => [((Date.parse(p.date) - t0) / tspan) * (w - 4) + 2, h - 6 - ((p.value - lo) / span) * (h - 14)] as const);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${xy.at(-1)?.[0].toFixed(1)} ${h} L${xy[0]?.[0].toFixed(1)} ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-14 w-full" role="img" aria-label={label} preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--color-royal)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--color-royal)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path d={line} fill="none" stroke="var(--color-royal)" strokeWidth="2.25" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
