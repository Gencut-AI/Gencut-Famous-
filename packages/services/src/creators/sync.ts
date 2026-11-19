import { type Availability, IG_ACCOUNT_INSIGHTS, IG_MEDIA_INSIGHTS, MEDIA_MAX_BYTES, type MetricKey, effectiveInstagramScopes, insightsKind, parseInsights, sniffImageType } from '@gencut/core';
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
/** Post insights fetched at once per channel: fast, and well inside Instagram's limits. */
export const POST_INSIGHTS_CONCURRENCY = 5;
/** A claim older than this is treated as abandoned (a run that crashed or timed out). */
export const SYNC_CLAIM_MINUTES = 10;

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
  // One statement for the whole sync. A key may appear only once per statement, so the last reading for a key wins.
  const byKey = new Map<string, Reading>();
  for (const r of readings) byKey.set(`${r.contentId ?? ''}|${r.metric}|${r.periodKind}|${r.asOf}`, r);
  const rows = [...byKey.values()].map((r) => ({
    workspace_id: workspaceId, channel_id: channelId, content_id: r.contentId, metric: r.metric, period_kind: r.periodKind,
    period_start: r.periodStart, period_end: r.periodEnd, as_of: r.asOf, value: r.value, availability: r.availability,
    retrieved_at: retrievedAt, source_endpoint: r.endpoint, api_version: INSTAGRAM_API_VERSION,
  }));
  if (!rows.length) return;
  await db`
    INSERT INTO creator_metric_snapshots ${db(rows)}
    ON CONFLICT (channel_id, coalesce(content_id, '00000000-0000-0000-0000-000000000000'::uuid), metric, period_kind, as_of)
    DO UPDATE SET value = EXCLUDED.value, availability = EXCLUDED.availability, retrieved_at = EXCLUDED.retrieved_at,
      period_start = EXCLUDED.period_start, period_end = EXCLUDED.period_end, source_endpoint = EXCLUDED.source_endpoint, api_version = EXCLUDED.api_version
  `;
}

/** Run `fn` over `items`, at most `limit` at a time, keeping the input order in the result. */
async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * On a channel's first read, if the creator has no profile photo yet, use the
 * account's own Instagram picture so the media kit has a face from the start.
 * Never replaces a photo the creator chose; any failure just leaves no photo.
 */
async function adoptProfilePhoto(sql: Sql, workspaceId: string, userId: string, channelId: string, url: string | null, deps: ConnectorDeps): Promise<void> {
  if (!url || !deps.fetchPhoto) return;
  const [has] = await sql`SELECT 1 FROM media_assets WHERE workspace_id = ${workspaceId} AND kind = 'profile_photo' LIMIT 1`;
  if (has) return;
  const bytes = await deps.fetchPhoto(url);
  const type = bytes ? sniffImageType(bytes) : null;
  if (!bytes || !type || bytes.length > MEDIA_MAX_BYTES) return;
  await sql.begin(async (tx) => {
    const [row] = await tx<{ id: string }[]>`
      INSERT INTO media_assets (workspace_id, kind, content_type, bytes, byte_size, caption, created_by)
      SELECT ${workspaceId}, 'profile_photo', ${type}, ${Buffer.from(bytes)}, ${bytes.length}, NULL, ${userId}
      WHERE NOT EXISTS (SELECT 1 FROM media_assets WHERE workspace_id = ${workspaceId} AND kind = 'profile_photo')
      RETURNING id
    `;
    if (row) {
      await recordAudit(tx, { workspaceId, actorType: 'system', actorId: null, via: 'worker', entityType: 'media_asset', entityId: row.id, action: 'uploaded', detail: { kind: 'profile_photo', bytes: bytes.length, source: 'instagram', channelId } });
    }
  });
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
  const [ch] = await sql<{ workspace_id: string; external_account_id: string; granted_scopes: string[]; revoked_at: Date | null; last_synced_at: Date | null; connected_by: string }[]>`
    SELECT workspace_id, external_account_id, granted_scopes, revoked_at, last_synced_at, connected_by FROM creator_channels WHERE id = ${channelId} AND platform = 'instagram'
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
      await storeCredential(sql, deps.cipher, channelId, token, r.expiresInSeconds > 0 ? new Date(now.getTime() + r.expiresInSeconds * 1000) : null, now);
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
    if (ch.last_synced_at === null) await adoptProfilePhoto(sql, ch.workspace_id, ch.connected_by, channelId, a.profilePictureUrl, deps);
  } catch (e) {
    note('Account', e);
  }

  if (effectiveInstagramScopes(ch.granted_scopes).includes('instagram_business_manage_insights') && !authError) {
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
  if (posts.length) {
    const rows = posts.map((p) => ({
      workspace_id: ch.workspace_id, channel_id: channelId, platform: 'instagram', external_id: p.id,
      permalink: p.permalink?.startsWith('https://') ? p.permalink : null, media_type: p.mediaType, product_type: p.productType,
      caption_excerpt: p.caption ? p.caption.slice(0, 300) : null, thumbnail_url: p.thumbnailUrl, published_at: p.timestamp, retrieved_at: now,
    }));
    const saved = await sql<{ id: string; external_id: string }[]>`
      INSERT INTO creator_content ${sql(rows)}
      ON CONFLICT (channel_id, external_id) DO UPDATE SET permalink = EXCLUDED.permalink, caption_excerpt = EXCLUDED.caption_excerpt,
        thumbnail_url = EXCLUDED.thumbnail_url, retrieved_at = EXCLUDED.retrieved_at
      RETURNING id, external_id
    `;
    for (const row of saved) postIds.set(row.external_id, row.id);
  }

  const canInsights = effectiveInstagramScopes(ch.granted_scopes).includes('instagram_business_manage_insights');
  // Post insights are independent calls: fetch a few at once, then record them in post order.
  const postInsights = await mapLimit(posts, POST_INSIGHTS_CONCURRENCY, async (p) => {
    const kind = insightsKind(p.mediaType, p.productType);
    const metrics = kind ? IG_MEDIA_INSIGHTS[kind] ?? [] : [];
    if (!canInsights || !metrics.length || authError) return null;
    try {
      return parseInsights(await deps.instagram.insights(token, p.id, { metric: metrics.map((m) => m.api).join(',') }));
    } catch (e) {
      if (e instanceof InstagramApiError && e.isAuth) note('Post insights', e);
      // A post Meta has no insights for (too old, or a type it does not report) is "not reported"; the counts below still apply.
      return null;
    }
  });
  posts.forEach((p, i) => {
    const contentId = postIds.get(p.id) ?? null;
    const base = { periodKind: 'lifetime' as const, periodStart: null, periodEnd: null, asOf: today, contentId };
    const kind = insightsKind(p.mediaType, p.productType);
    const metrics = kind ? IG_MEDIA_INSIGHTS[kind] ?? [] : [];
    const got = postInsights[i] ?? null;
    if (got) {
      for (const m of metrics) readings.push({ ...base, metric: m.metric, ...point(got.get(m.api) ?? null), endpoint: `/media/insights ${m.api}` });
    } else {
      // No insights (carousel, missing permission, or none returned): the public counts on the post itself.
      readings.push({ ...base, metric: 'likes', ...point(p.likeCount), endpoint: '/media like_count' });
      readings.push({ ...base, metric: 'comments', ...point(p.commentsCount), endpoint: '/media comments_count' });
      if (!kind) readings.push({ ...base, metric: 'views', value: null, availability: 'not_supported', endpoint: '/media (carousel: no insights)' });
    }
  });

  await saveReadings(sql, ch.workspace_id, channelId, now, readings);
  const status: 'ok' | 'partial' | 'failed' = readings.length === 0 ? 'failed' : problems.length ? 'partial' : 'ok';
  await sql`
    UPDATE creator_channels SET last_synced_at = ${now}, last_sync_status = ${status}, sync_claimed_at = NULL,
      last_sync_error = ${problems.length ? problems.join('; ').slice(0, 500) : null}, auth_error = ${authError ? String(authError).slice(0, 500) : null}, updated_at = now()
    WHERE id = ${channelId}
  `;
  await recordAudit(sql, {
    workspaceId: ch.workspace_id, actorType: 'system', actorId: null, via: 'worker', entityType: 'channel', entityId: channelId,
    action: 'synced', toState: status, detail: { reason, readings: readings.length, posts: posts.length, problems: problems.length },
  });
  return { channelId, status, readings: readings.length, posts: posts.length, problems };
}

/**
 * Claim one due Instagram channel for this run, or none. The claim is a single
 * statement, so two runs at the same moment never pick the same channel; a
 * claim older than SYNC_CLAIM_MINUTES counts as abandoned.
 */
async function claimDue(sql: Sql, before: Date, now: Date, workspaceId: string | null): Promise<string | null> {
  const stale = new Date(now.getTime() - SYNC_CLAIM_MINUTES * 60_000);
  const [row] = await sql<{ id: string }[]>`
    UPDATE creator_channels SET sync_claimed_at = ${now}
    WHERE id = (
      SELECT id FROM creator_channels
      WHERE platform = 'instagram' AND revoked_at IS NULL
        AND (last_synced_at IS NULL OR last_synced_at < ${before})
        AND (sync_claimed_at IS NULL OR sync_claimed_at < ${stale})
        ${workspaceId ? sql`AND workspace_id = ${workspaceId}` : sql``}
      ORDER BY last_synced_at NULLS FIRST
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `;
  return row?.id ?? null;
}

/** Sync a creator's channels that are due (or all, with `force`, still at most once a minute). */
export async function syncWorkspace(sql: Sql, ctx: RequestContext, workspaceId: string, deps: ConnectorDeps, force = false): Promise<SyncResult[]> {
  await requireCapability(sql, ctx, workspaceId, 'view');
  const now = deps.now?.() ?? new Date();
  const before = new Date(now.getTime() - (force ? 1 : SYNC_MIN_MINUTES) * 60_000);
  const out: SyncResult[] = [];
  for (let id = await claimDue(sql, before, now, workspaceId); id; id = await claimDue(sql, before, now, workspaceId)) {
    out.push(await syncInstagramChannel(sql, id, deps, force ? 'manual' : 'auto'));
  }
  return out;
}

export interface SyncAllOptions {
  /** Most channels this run may sync. */
  readonly limit?: number;
  /** Stop claiming new channels after this many milliseconds (a channel already started finishes). */
  readonly budgetMs?: number;
}

/**
 * The daily snapshot for connected channels not read in the last 20 hours,
 * one claimed channel at a time until the limit or the time budget runs out.
 */
export async function syncAllDue(sql: Sql, deps: ConnectorDeps, options: SyncAllOptions = {}): Promise<SyncResult[]> {
  const started = Date.now();
  const { limit = 200, budgetMs = Number.POSITIVE_INFINITY } = options;
  const now = deps.now?.() ?? new Date();
  const before = new Date(now.getTime() - 20 * 3_600_000);
  const out: SyncResult[] = [];
  while (out.length < limit && Date.now() - started < budgetMs) {
    const id = await claimDue(sql, before, now, null);
    if (!id) break;
    out.push(await syncInstagramChannel(sql, id, deps, 'daily'));
  }
  return out;
}
