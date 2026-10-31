import {
  type Availability,
  type CombinedFigure,
  type Growth,
  type MetricKey,
  type MetricPoint,
  type Platform,
  combineAcrossPlatforms,
  growthOver,
} from '@gencut/core';
import { type ChannelView, loadChannels } from '../connectors/channels.ts';
import type { RequestContext } from '../context.ts';
import type { Db } from '../db.ts';
import { requireCapability } from '../membership.ts';

/** One figure as shown: always with its source, period and when it was read. */
export interface Figure {
  readonly metric: MetricKey;
  readonly source: Platform | 'gencut';
  readonly value: number | null;
  readonly availability: Availability;
  readonly periodLabel: string;
  readonly retrievedAt: Date;
}

export interface ChannelSummary {
  readonly channel: ChannelView;
  readonly followers: Figure | null;
  readonly posts: Figure | null;
  readonly growth7: Growth | null;
  readonly growth30: Growth | null;
  /** First day GenCut has a follower reading for: growth can only be shown from here. */
  readonly historyStarts: Date | null;
  readonly followerSeries: ReadonlyArray<{ date: string; value: number }>;
  readonly week: readonly Figure[];
}

export interface ContentSummary {
  readonly id: string;
  readonly platform: Platform;
  readonly permalink: string | null;
  readonly caption: string | null;
  readonly mediaType: string | null;
  readonly publishedAt: Date | null;
  readonly shownOnProfile: boolean;
  readonly figures: readonly Figure[];
  readonly rankedBy: MetricKey | null;
}

export interface Dashboard {
  readonly channels: readonly ChannelSummary[];
  readonly combinedFollowers: CombinedFigure | null;
  readonly topContent: readonly ContentSummary[];
  readonly visits: { readonly last7: number; readonly last30: number; readonly bySource: ReadonlyArray<{ source: string; visits: number }>; readonly since: Date | null };
  readonly inquiries: { readonly unread: number; readonly last30: number };
}

const fmtDay = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export function periodLabel(kind: string, start: Date | null, end: Date | null, asOf: Date): string {
  if (kind === 'instant') return `as of ${fmtDay(asOf)}`;
  if (kind === 'lifetime') return 'since posted';
  if (start && end) {
    const last = new Date(end.getTime() - 86_400_000);
    return start.getTime() === last.getTime() ? fmtDay(start) : `${fmtDay(start)}–${fmtDay(last)}`;
  }
  return '';
}

interface SnapRow {
  channel_id: string;
  content_id: string | null;
  metric: MetricKey;
  period_kind: string;
  period_start: Date | null;
  period_end: Date | null;
  as_of: Date;
  value: string | null;
  availability: Availability;
  retrieved_at: Date;
}

const toFigure = (r: SnapRow, source: Platform): Figure => ({
  metric: r.metric, source, value: r.value === null ? null : Number(r.value), availability: r.availability,
  periodLabel: periodLabel(r.period_kind, r.period_start, r.period_end, r.as_of), retrievedAt: r.retrieved_at,
});

const RANK_ORDER: readonly MetricKey[] = ['views', 'interactions', 'likes'];

export async function getDashboard(db: Db, ctx: RequestContext, workspaceId: string, now = new Date()): Promise<Dashboard> {
  await requireCapability(db, ctx, workspaceId, 'view');
  const channels = await loadChannels(db, workspaceId, now);
  const ids = channels.map((c) => c.id);

  const accountRows = ids.length
    ? await db<SnapRow[]>`
        SELECT channel_id, content_id, metric, period_kind, period_start, period_end, as_of, value, availability, retrieved_at
        FROM creator_metric_snapshots
        WHERE channel_id = ANY(${ids}) AND content_id IS NULL AND as_of >= ${new Date(now.getTime() - 120 * 86_400_000)}
        ORDER BY as_of`
    : [];

  const summaries: ChannelSummary[] = channels.map((c) => {
    const own = accountRows.filter((r) => r.channel_id === c.id);
    const latest = (metric: MetricKey, kind: string) => own.filter((r) => r.metric === metric && r.period_kind === kind).at(-1) ?? null;
    const followerRows = own.filter((r) => r.metric === 'followers' && r.period_kind === 'instant');
    const series = followerRows.map((r) => ({ value: r.value === null ? null : Number(r.value), at: r.as_of }));
    const f = latest('followers', 'instant');
    const p = latest('posts', 'instant');
    const weekMetrics: MetricKey[] = ['reach', 'views', 'accounts_engaged', 'interactions'];
    return {
      channel: c,
      followers: f ? toFigure(f, c.platform) : null,
      posts: p ? toFigure(p, c.platform) : null,
      growth7: growthOver(series, 7),
      growth30: growthOver(series, 30),
      historyStarts: series.find((s) => s.value !== null)?.at ?? null,
      followerSeries: series.flatMap((s) => (s.value === null ? [] : [{ date: s.at.toISOString().slice(0, 10), value: s.value }])),
      week: weekMetrics.flatMap((m) => {
        const r = latest(m, 'week');
        return r ? [toFigure(r, c.platform)] : [];
      }),
    };
  });

  const points: MetricPoint[] = summaries.flatMap((s) =>
    s.followers ? [{ source: s.channel.platform, metric: 'followers' as const, value: s.followers.value, availability: s.followers.availability, periodStart: null, periodEnd: null, retrievedAt: s.followers.retrievedAt }] : [],
  );

  const content = await loadContent(db, channels);
  // Rank by the best measure each post has, in a fixed order; posts are compared only on the same measure.
  const rankKey = (c: ContentSummary) => (c.rankedBy ? RANK_ORDER.length - RANK_ORDER.indexOf(c.rankedBy) : 0);
  const valueOf = (c: ContentSummary) => c.figures.find((f) => f.metric === c.rankedBy)?.value ?? -1;
  const topContent = content.filter((c) => c.rankedBy).sort((a, b) => rankKey(b) - rankKey(a) || valueOf(b) - valueOf(a)).slice(0, 6);

  const [visits] = await db<{ last7: number; last30: number; since: Date | null }[]>`
    SELECT count(*) FILTER (WHERE visited_on > current_date - 7)::int AS last7,
           count(*) FILTER (WHERE visited_on > current_date - 30)::int AS last30,
           min(visited_on) AS since
    FROM profile_visits WHERE workspace_id = ${workspaceId}
  `;
  const bySource = await db<{ source: string; visits: number }[]>`
    SELECT coalesce(src, referrer_host, 'direct') AS source, count(*)::int AS visits FROM profile_visits
    WHERE workspace_id = ${workspaceId} AND visited_on > current_date - 30 GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 6
  `;
  const [inq] = await db<{ unread: number; last30: number }[]>`
    SELECT count(*) FILTER (WHERE status = 'new')::int AS unread, count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS last30
    FROM creator_inquiries WHERE workspace_id = ${workspaceId}
  `;

  return {
    channels: summaries,
    combinedFollowers: combineAcrossPlatforms('followers', points),
    topContent,
    visits: { last7: visits?.last7 ?? 0, last30: visits?.last30 ?? 0, bySource, since: visits?.since ?? null },
    inquiries: { unread: inq?.unread ?? 0, last30: inq?.last30 ?? 0 },
  };
}

/** All recent posts with their readings, for the Analytics page and the profile-content picker. */
export async function listContent(db: Db, ctx: RequestContext, workspaceId: string, now = new Date()): Promise<ContentSummary[]> {
  await requireCapability(db, ctx, workspaceId, 'view');
  return loadContent(db, await loadChannels(db, workspaceId, now));
}

async function loadContent(db: Db, channels: readonly ChannelView[]): Promise<ContentSummary[]> {
  const platformOf = new Map(channels.map((c) => [c.id, c.platform]));
  const ids = channels.map((c) => c.id);
  if (!ids.length) return [];
  const rows = await db<{ id: string; channel_id: string; permalink: string | null; caption_excerpt: string | null; media_type: string | null; published_at: Date | null; shown_on_profile: boolean }[]>`
    SELECT id, channel_id, permalink, caption_excerpt, media_type, published_at, shown_on_profile FROM creator_content
    WHERE channel_id = ANY(${ids}) ORDER BY published_at DESC NULLS LAST LIMIT 60
  `;
  const snaps = rows.length
    ? await db<SnapRow[]>`
        SELECT DISTINCT ON (content_id, metric) channel_id, content_id, metric, period_kind, period_start, period_end, as_of, value, availability, retrieved_at
        FROM creator_metric_snapshots WHERE content_id = ANY(${rows.map((r) => r.id)}) ORDER BY content_id, metric, as_of DESC`
    : [];
  return rows.map((r) => {
    const platform = platformOf.get(r.channel_id) as Platform;
    const figures = snaps.filter((s) => s.content_id === r.id).map((s) => toFigure(s, platform));
    const rankedBy = RANK_ORDER.find((m) => figures.some((f) => f.metric === m && f.value !== null)) ?? null;
    return { id: r.id, platform, permalink: r.permalink, caption: r.caption_excerpt, mediaType: r.media_type, publishedAt: r.published_at, shownOnProfile: r.shown_on_profile, figures, rankedBy };
  });
}
