import { AVAILABILITY_LABELS, type Availability, METRICS, type MetricKey, SOURCE_LABELS, type MetricSource } from '@gencut/core';

export const n = (v: number) => v.toLocaleString('en-US');

/** 12,450 → "12.5K" for headline numbers; exact figures stay in the caption. */
export function compact(v: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
}

export function when(d: Date): string {
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
}

export function day(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function metricLabel(m: MetricKey): string {
  return METRICS[m].label;
}

export function sourceLabel(s: MetricSource): string {
  return SOURCE_LABELS[s];
}

export function availabilityLabel(a: Availability): string {
  return AVAILABILITY_LABELS[a];
}

export function signed(v: number): string {
  return `${v > 0 ? '+' : v < 0 ? '−' : '±'}${n(Math.abs(v))}`;
}
