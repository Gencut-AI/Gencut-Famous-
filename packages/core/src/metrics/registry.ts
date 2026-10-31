import type { MetricSource } from '../platforms.ts';

/**
 * Every figure GenCut shows is defined here: what it counts, over what period,
 * and whether figures from different platforms may be added together. A figure
 * without a definition cannot be stored or shown.
 */
export const METRIC_KEYS = [
  'followers',
  'following',
  'posts',
  'reach',
  'views',
  'accounts_engaged',
  'interactions',
  'likes',
  'comments',
  'shares',
  'saves',
  'profile_visits',
  'inquiries',
] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

/**
 * How figures combine across platforms:
 * - `labelled_sum`: may be added, shown as a "platform-reported total" (one person following on two platforms counts twice);
 * - `never`: different platforms count different people; adding them would claim a number nobody measured.
 */
export type CrossPlatform = 'labelled_sum' | 'never';

export interface MetricDefinition {
  readonly key: MetricKey;
  readonly label: string;
  /** Plain-language definition, shown with the figure. */
  readonly definition: string;
  /** A count at a moment (followers) or a total over a period (views). */
  readonly kind: 'point_in_time' | 'period_total';
  readonly crossPlatform: CrossPlatform;
}

export const METRICS: Readonly<Record<MetricKey, MetricDefinition>> = {
  followers: { key: 'followers', label: 'Followers', definition: 'Accounts following this account, as the platform reports it when GenCut checked.', kind: 'point_in_time', crossPlatform: 'labelled_sum' },
  following: { key: 'following', label: 'Following', definition: 'Accounts this account follows.', kind: 'point_in_time', crossPlatform: 'never' },
  posts: { key: 'posts', label: 'Posts', definition: 'Published posts, reels and videos on the account.', kind: 'point_in_time', crossPlatform: 'labelled_sum' },
  reach: { key: 'reach', label: 'Reach', definition: 'Unique accounts that saw the content at least once in the period, estimated by the platform. Never added across platforms.', kind: 'period_total', crossPlatform: 'never' },
  views: { key: 'views', label: 'Views', definition: 'Times the content was played or displayed in the period, as the platform counts views.', kind: 'period_total', crossPlatform: 'labelled_sum' },
  accounts_engaged: { key: 'accounts_engaged', label: 'Accounts engaged', definition: 'Unique accounts that interacted with the content in the period. Never added across platforms.', kind: 'period_total', crossPlatform: 'never' },
  interactions: { key: 'interactions', label: 'Interactions', definition: 'Likes, comments, shares, saves and replies in the period.', kind: 'period_total', crossPlatform: 'labelled_sum' },
  likes: { key: 'likes', label: 'Likes', definition: 'Likes in the period (on a post: since it was published).', kind: 'period_total', crossPlatform: 'labelled_sum' },
  comments: { key: 'comments', label: 'Comments', definition: 'Comments in the period (on a post: since it was published).', kind: 'period_total', crossPlatform: 'labelled_sum' },
  shares: { key: 'shares', label: 'Shares', definition: 'Times the content was shared.', kind: 'period_total', crossPlatform: 'labelled_sum' },
  saves: { key: 'saves', label: 'Saves', definition: 'Times the content was saved.', kind: 'period_total', crossPlatform: 'labelled_sum' },
  profile_visits: { key: 'profile_visits', label: 'Media kit visits', definition: 'Visits to your GenCut public profile, counted once per visitor per day. Browsers that block scripts are not counted.', kind: 'period_total', crossPlatform: 'never' },
  inquiries: { key: 'inquiries', label: 'Inquiries', definition: 'Messages sent through the inquiry form on your GenCut public profile.', kind: 'period_total', crossPlatform: 'never' },
};

/** Why a figure is or is not shown. Missing data is never stored or shown as zero. */
export const AVAILABILITY = ['available', 'unavailable', 'below_threshold', 'not_supported', 'error'] as const;
export type Availability = (typeof AVAILABILITY)[number];

export const AVAILABILITY_LABELS: Readonly<Record<Availability, string>> = {
  available: 'Available',
  unavailable: 'Not reported by the platform',
  below_threshold: 'Hidden by the platform for smaller accounts',
  not_supported: 'Not offered for this account or post type',
  error: 'Could not be read',
};

/** One stored reading of one metric. */
export interface MetricPoint {
  readonly source: MetricSource;
  readonly metric: MetricKey;
  readonly value: number | null;
  readonly availability: Availability;
  readonly periodStart: Date | null;
  readonly periodEnd: Date | null;
  readonly retrievedAt: Date;
}

export interface CombinedFigure {
  readonly metric: MetricKey;
  readonly value: number;
  readonly sources: readonly MetricSource[];
  /** Sources asked for but without a reading; the total leaves them out. */
  readonly missing: readonly MetricSource[];
  readonly label: string;
}

/**
 * Add one metric across platforms, only where the registry allows it, only
 * from available readings, and always with a label that says what it is.
 * Returns null when the metric may not be combined or nothing is available.
 */
export function combineAcrossPlatforms(metric: MetricKey, points: readonly MetricPoint[]): CombinedFigure | null {
  if (METRICS[metric].crossPlatform === 'never') return null;
  const own = points.filter((p) => p.metric === metric);
  const usable = own.filter((p) => p.availability === 'available' && p.value !== null);
  if (usable.length === 0) return null;
  const value = usable.reduce((sum, p) => sum + (p.value ?? 0), 0);
  const sources = [...new Set(usable.map((p) => p.source))];
  const missing = [...new Set(own.filter((p) => !usable.includes(p)).map((p) => p.source))].filter((s) => !sources.includes(s));
  return {
    metric,
    value,
    sources,
    missing,
    label: `Platform-reported total of ${METRICS[metric].label.toLowerCase()} across ${sources.length} platform${sources.length === 1 ? '' : 's'}; someone on several platforms is counted on each`,
  };
}

export interface Growth {
  readonly from: number;
  readonly to: number;
  readonly change: number;
  readonly fromAt: Date;
  readonly toAt: Date;
}

/**
 * Change of a point-in-time metric over roughly `days`, from stored readings.
 * Uses the latest reading and the earliest reading at least `days` before it
 * (within a day's tolerance). Null when the history does not reach back that far:
 * growth is never estimated.
 */
export function growthOver(readings: readonly { value: number | null; at: Date }[], days: number): Growth | null {
  const usable = readings.filter((r): r is { value: number; at: Date } => r.value !== null).sort((a, b) => a.at.getTime() - b.at.getTime());
  const last = usable.at(-1);
  if (!last) return null;
  const target = last.at.getTime() - days * 86_400_000;
  const tolerance = 86_400_000;
  const candidates = usable.filter((r) => r.at.getTime() <= target + tolerance);
  const first = candidates.at(-1);
  if (!first || first === last) return null;
  return { from: first.value, to: last.value, change: last.value - first.value, fromAt: first.at, toAt: last.at };
}
