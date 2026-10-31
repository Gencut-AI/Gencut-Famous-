import { type Availability, IG_ACCOUNT_INSIGHTS, IG_MEDIA_INSIGHTS, type MetricKey, insightsKind, parseInsights } from '@gencut/core';
import { recordAudit } from '../audit.ts';
import { type ConnectorDeps, readCredential, storeCredential } from '../connectors/channels.ts';
import { INSTAGRAM_API_VERSION, type IgMedia, InstagramApiError } from '../connectors/instagram-api.ts';
import type { RequestContext } from '../context.ts';
import type { Db, Sql } from '../db.ts';
import { requireCapability } from '../membership.ts';

/** Reads per channel: at most every 15 minutes on demand, plus the daily snapshot. */
export const SYNC_MIN_MINUTES = 15;
/** Posts read per sync. */
export const SYNC_POSTS = 25;
/** Refresh the 60-day token once it is a week old (Meta allows it after 24 hours). */
export const TOKEN_REFRESH_AFTER_DAYS = 7;

export interface SyncResult {
  readonly channelId: string;
  readonly status: 'ok' | 'partial' | 'failed' | 'skipped';
  readonly readings: number;
  readonly posts: number;
  readonly problems: readonly string[];
}

interface Reading {
  metric: MetricKey;
  periodKind: 'instant' | 'day' | 'week' | 'lifetime';
  periodStart: Date | null;
  periodEnd: Date | null;
  asOf: string;
  value: number | null;
  availability: Availability;
  endpoint: string;
  contentId: string | null;
}

const dayStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

async function saveReadings(db: Db, workspaceId: string, channelId: string, retrievedAt: Date, readings: readonly Reading[]): Promise<void> {
  for (const r of readings) {
    await db`
      INSERT INTO creator_metric_snapshots (workspace_id, channel_id, content_id, metric, period_kind, period_start, period_end, as_of, value, availability, retrieved_at, source_endpoint, api_version)
      VALUES (${workspaceId}, ${channelId}, ${r.contentId}, ${r.metric}, ${r.periodKind}, ${r.periodStart}, ${r.periodEnd}, ${r.asOf}, ${r.value}, ${r.availability}, ${retrievedAt}, ${r.endpoint}, ${INSTAGRAM_API_VERSION})
      ON CONFLICT (channel_id, coalesce(content_id, '00000000-0000-0000-0000-000000000000'::uuid), metric, period_kind, as_of)
      DO UPDATE SET value = EXCLUDED.value, availability = EXCLUDED.availability, retrieved_at = EXCLUDED.retrieved_at,
        period_start = EXCLUDED.period_start, period_end = EXCLUDED.period_end, source_endpoint = EXCLUDED.source_endpoint, api_version = EXCLUDED.api_version
    `;
  }
}

/** A field that is absent is "not reported", never zero. */
const point = (value: number | null): Pick<Reading, 'value' | 'availability'> =>
  value === null ? { value: null, availability: 'unavailable' } : { value, availability: 'available' };

/**
 * Read one Instagram channel and store dated readings. Each part (account,
 * insights, posts) fails on its own; an auth failure marks the channel so
 * the creator sees what to fix. Nothing here writes a guessed number.
 */
export async function syncInstagramChannel(sql: Sql, channelId: string, deps: ConnectorDeps, reason: 'manual' | 'auto' | 'daily'): Promise<SyncResult> {
  const now = deps.now?.() ?? new Date();
  const [ch] = await sql<{ workspace_id: string; external_account_id: string; granted_scopes: string[]; revoked_at: Date | null }[]>`
    SELECT workspace_id, external_account_id, granted_scopes, revoked_at FROM creator_channels WHERE id = ${channelId} AND platform = 'instagram'
  `;
  if (!ch || ch.revoked_at) return { channelId, status: 'skipped', readings: 0, posts: 0, problems: ['Not connected'] };
  const cred = await readCredential(sql, deps.cipher, channelId);
  if (!cred) return { channelId, status: 'skipped', readings: 0, posts: 0, problems: ['No token held'] };
  if (cred.expiresAt && cred.expiresAt.getTime() <= now.getTime()) {
    await sql`UPDATE creator_channels SET last_sync_status = 'failed', last_sync_error = 'The Instagram connection expired. Reconnect to continue.', updated_at = now() WHERE id = ${channelId}`;
    return { channelId, status: 'failed', readings: 0, posts: 0, problems: ['Token expired'] };
  }

  const problems: string[] = [];
  let authError: string | null = null;
  const note = (part: string, e: unknown) => {
    if (e instanceof InstagramApiError) {
      if (e.isAuth) authError = e.message;
      problems.push(`${part}: ${e.isRateLimit ? 'Instagram asked GenCut to slow down; the next check will retry' : e.message}`);
    } else {
      problems.push(`${part}: ${e instanceof Error ? e.message.slice(0, 200) : 'unexpected error'}`);
    }
  };

  let token = cred.token;
  if (now.getTime() - cred.issuedAt.getTime() > TOKEN_REFRESH_AFTER_DAYS * 86_400_000) {
    try {
      const r = await deps.instagram.refresh(token);
      token = r.accessToken;
      await storeCredential(sql, deps.cipher, channelId, token, r.expiresInSeconds > 0 ? new Date(now.getTime() + r.expiresInSeconds * 1000) : null);
    } catch (e) {
      note('Token refresh', e);
    }
  }

  const readings: Reading[] = [];
  const today = isoDay(now);

  try {
    const a = await deps.instagram.account(token);
    readings.push(
      { metric: 'followers', periodKind: 'instant', periodStart: null, periodEnd: null, asOf: today, ...point(a.followers), endpoint: '/me followers_count', contentId: null },
      { metric: 'following', periodKind: 'instant', periodStart: null, periodEnd: null, asOf: today, ...point(a.follows), endpoint: '/me follows_count', contentId: null },
      { metric: 'posts', periodKind: 'instant', periodStart: null, periodEnd: null, asOf: today, ...point(a.mediaCount), endpoint: '/me media_count', contentId: null },
    );
    await sql`UPDATE creator_channels SET username = ${a.username}, display_name = ${a.name}, account_type = ${a.accountType}, profile_picture_url = ${a.profilePictureUrl} WHERE id = ${channelId}`;
  } catch (e) {
    note('Account', e);
  }

  if (ch.granted_scopes.includes('instagram_business_manage_insights') && !authError) {
    // Yesterday (a full UTC day) and the last 7 full days. Meta may delay data up to 48 hours.
    const end = dayStart(now);
    const yesterday = new Date(end.getTime() - 86_400_000);
    const weekStart = new Date(end.getTime() - 7 * 86_400_000);
    for (const [kind, start] of [['day', yesterday], ['week', weekStart]] as const) {
      try {
        const body = await deps.instagram.insights(token, ch.external_account_id, {
          metric: IG_ACCOUNT_INSIGHTS.map((m) => m.api).join(','), period: 'day', metric_type: 'total_value',
          since: String(Math.floor(start.getTime() / 1000)), until: String(Math.floor(end.getTime() / 1000)),
        });
        const got = parseInsights(body);
        for (const m of IG_ACCOUNT_INSIGHTS) {
          readings.push({ metric: m.metric, periodKind: kind, periodStart: start, periodEnd: end, asOf: isoDay(yesterday), ...point(got.get(m.api) ?? null), endpoint: `/insights ${m.api}`, contentId: null });
        }
      } catch (e) {
        note(kind === 'day' ? 'Daily insights' : 'Weekly insights', e);
      }
    }
  }

  let posts: IgMedia[] = [];
  if (!authError) {
    try {
      posts = await deps.instagram.recentMedia(token, ch.external_account_id, SYNC_POSTS);
    } catch (e) {
      note('Posts', e);
    }
  }
  const postIds = new Map<string, string>();
  for (const p of posts) {
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO creator_content (workspace_id, channel_id, platform, external_id, permalink, media_type, product_type, caption_excerpt, thumbnail_url, published_at, retrieved_at)
      VALUES (${ch.workspace_id}, ${channelId}, 'instagram', ${p.id}, ${p.permalink?.startsWith('https://') ? p.permalink : null}, ${p.mediaType}, ${p.productType},
              ${p.caption ? p.caption.slice(0, 300) : null}, ${p.thumbnailUrl}, ${p.timestamp}, ${now})
      ON CONFLICT (channel_id, external_id) DO UPDATE SET permalink = EXCLUDED.permalink, caption_excerpt = EXCLUDED.caption_excerpt,
        thumbnail_url = EXCLUDED.thumbnail_url, retrieved_at = EXCLUDED.retrieved_at
      RETURNING id
    `;
    if (row) postIds.set(p.id, row.id);
  }

  const canInsights = ch.granted_scopes.includes('instagram_business_manage_insights');
  for (const p of posts) {
    const contentId = postIds.get(p.id) ?? null;
    const base = { periodKind: 'lifetime' as const, periodStart: null, periodEnd: null, asOf: today, contentId };
    const kind = insightsKind(p.mediaType, p.productType);
    const metrics = kind ? IG_MEDIA_INSIGHTS[kind] ?? [] : [];
    let got: Map<string, number> | null = null;
    if (canInsights && metrics.length && !authError) {
      try {
        got = parseInsights(await deps.instagram.insights(token, p.id, { metric: metrics.map((m) => m.api).join(',') }));
      } catch (e) {
        if (e instanceof InstagramApiError && e.isAuth) note('Post insights', e);
        // A post Meta has no insights for (too old, or a type it does not report) is "not reported"; the counts below still apply.
      }
    }
    if (got) {
      for (const m of metrics) readings.push({ ...base, metric: m.metric, ...point(got.get(m.api) ?? null), endpoint: `/media/insights ${m.api}` });
    } else {
      // No insights (carousel, missing permission, or none returned): the public counts on the post itself.
      readings.push({ ...base, metric: 'likes', ...point(p.likeCount), endpoint: '/media like_count' });
      readings.push({ ...base, metric: 'comments', ...point(p.commentsCount), endpoint: '/media comments_count' });
      if (!kind) readings.push({ ...base, metric: 'views', value: null, availability: 'not_supported', endpoint: '/media (carousel: no insights)' });
    }
  }

  await saveReadings(sql, ch.workspace_id, channelId, now, readings);
  const status: 'ok' | 'partial' | 'failed' = readings.length === 0 ? 'failed' : problems.length ? 'partial' : 'ok';
  await sql`
    UPDATE creator_channels SET last_synced_at = ${now}, last_sync_status = ${status},
      last_sync_error = ${problems.length ? problems.join('; ').slice(0, 500) : null}, auth_error = ${authError ? String(authError).slice(0, 500) : null}, updated_at = now()
    WHERE id = ${channelId}
  `;
  await recordAudit(sql, {
    workspaceId: ch.workspace_id, actorType: 'system', actorId: null, via: 'worker', entityType: 'channel', entityId: channelId,
    action: 'synced', toState: status, detail: { reason, readings: readings.length, posts: posts.length, problems: problems.length },
  });
  return { channelId, status, readings: readings.length, posts: posts.length, problems };
}

/** Sync a creator's channels that are due (or all, with `force`, still at most once a minute). */
export async function syncWorkspace(sql: Sql, ctx: RequestContext, workspaceId: string, deps: ConnectorDeps, force = false): Promise<SyncResult[]> {
  await requireCapability(sql, ctx, workspaceId, 'view');
  const minutes = force ? 1 : SYNC_MIN_MINUTES;
  const due = await sql<{ id: string }[]>`
    SELECT id FROM creator_channels WHERE workspace_id = ${workspaceId} AND platform = 'instagram' AND revoked_at IS NULL
      AND (last_synced_at IS NULL OR last_synced_at < now() - make_interval(mins => ${minutes}))
  `;
  const out: SyncResult[] = [];
  for (const d of due) out.push(await syncInstagramChannel(sql, d.id, deps, force ? 'manual' : 'auto'));
  return out;
}

/** The daily snapshot for every connected channel not read in the last 20 hours. */
export async function syncAllDue(sql: Sql, deps: ConnectorDeps, limit = 200): Promise<SyncResult[]> {
  const due = await sql<{ id: string }[]>`
    SELECT id FROM creator_channels WHERE platform = 'instagram' AND revoked_at IS NULL
      AND (last_synced_at IS NULL OR last_synced_at < now() - interval '20 hours')
    ORDER BY last_synced_at NULLS FIRST LIMIT ${limit}
  `;
  const out: SyncResult[] = [];
  for (const d of due) out.push(await syncInstagramChannel(sql, d.id, deps, 'daily'));
  return out;
}
