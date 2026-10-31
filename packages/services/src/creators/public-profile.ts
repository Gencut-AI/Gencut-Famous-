import { createHmac } from 'node:crypto';
import {
  INQUIRY_CONSENT_VERSION,
  INQUIRY_KINDS,
  INQUIRY_LIMIT_PER_PROFILE_PER_DAY,
  INQUIRY_LIMIT_PER_SENDER_PER_DAY,
  type InquiryKind,
  type MetricKey,
  NICHE_LABELS,
  type Niche,
  type Platform,
  inquiryConsentText,
  normalizeHandle,
  normalizeReferral,
  platformProfileUrl,
  referrerHost,
} from '@gencut/core';
import { z } from 'zod';
import { recordAudit } from '../audit.ts';
import type { RequestContext } from '../context.ts';
import type { Db, Sql } from '../db.ts';
import { ServiceError } from '../errors.ts';
import { requireCapability } from '../membership.ts';
import { type Figure, periodLabel } from './dashboard.ts';
import { type Partnership, listPartnerships, loadProfile } from './profile.ts';

export const SHOWABLE_METRICS = ['followers', 'posts', 'views', 'reach', 'interactions'] as const;
export type ShowableMetric = (typeof SHOWABLE_METRICS)[number];
export const PROFILE_CONTENT_MAX = 9;

export interface PageSettings {
  readonly published: boolean;
  readonly publishedAt: Date | null;
  readonly headline: string | null;
  readonly workWithMe: string | null;
  readonly showInquiryForm: boolean;
  readonly shownMetrics: readonly ShowableMetric[];
}

export async function getPageSettings(db: Db, ctx: RequestContext, workspaceId: string): Promise<PageSettings> {
  await requireCapability(db, ctx, workspaceId, 'view');
  const [r] = await db<{ published: boolean; published_at: Date | null; headline: string | null; work_with_me: string | null; show_inquiry_form: boolean; shown_metrics: ShowableMetric[] }[]>`
    SELECT published, published_at, headline, work_with_me, show_inquiry_form, shown_metrics FROM profile_pages WHERE workspace_id = ${workspaceId}
  `;
  if (!r) throw new ServiceError('not_found', 'No profile page.');
  return { published: r.published, publishedAt: r.published_at, headline: r.headline, workWithMe: r.work_with_me, showInquiryForm: r.show_inquiry_form, shownMetrics: r.shown_metrics };
}

const settingsInput = z.object({
  headline: z.string().trim().max(120).transform((v) => v || null),
  workWithMe: z.string().trim().max(600).transform((v) => v || null),
  showInquiryForm: z.boolean(),
  shownMetrics: z.array(z.enum(SHOWABLE_METRICS)).max(SHOWABLE_METRICS.length),
});

export async function savePageSettings(sql: Sql, ctx: RequestContext, workspaceId: string, input: unknown): Promise<void> {
  const parsed = settingsInput.safeParse(input);
  if (!parsed.success) throw new ServiceError('invalid', 'Some details need fixing.', { form: parsed.error.issues[0]?.message ?? 'Invalid' });
  const v = parsed.data;
  await sql.begin(async (tx) => {
    await requireCapability(tx, ctx, workspaceId, 'edit_profile');
    await tx`
      UPDATE profile_pages SET headline = ${v.headline}, work_with_me = ${v.workWithMe}, show_inquiry_form = ${v.showInquiryForm},
        shown_metrics = ${[...new Set(v.shownMetrics)]}, updated_at = now() WHERE workspace_id = ${workspaceId}
    `;
    await recordAudit(tx, { workspaceId, actorType: 'user', actorId: ctx.userId, via: ctx.via, entityType: 'profile_page', entityId: workspaceId, action: 'updated', detail: { shownMetrics: v.shownMetrics, showInquiryForm: v.showInquiryForm } });
  });
}

/** Publishing makes the page public at /@handle. The creator or a manager decides; it is audited either way. */
export async function setPublished(sql: Sql, ctx: RequestContext, workspaceId: string, published: boolean): Promise<void> {
  await sql.begin(async (tx) => {
    await requireCapability(tx, ctx, workspaceId, 'publish_profile');
    const [before] = await tx<{ published: boolean }[]>`SELECT published FROM profile_pages WHERE workspace_id = ${workspaceId} FOR UPDATE`;
    if (!before || before.published === published) return;
    await tx`
      UPDATE profile_pages SET published = ${published}, published_at = ${published ? new Date() : null}, published_by = ${published ? ctx.userId : null}, updated_at = now()
      WHERE workspace_id = ${workspaceId}
    `;
    await recordAudit(tx, { workspaceId, actorType: 'user', actorId: ctx.userId, via: ctx.via, entityType: 'profile_page', entityId: workspaceId, action: published ? 'published' : 'unpublished', fromState: before.published ? 'published' : 'draft', toState: published ? 'published' : 'draft' });
  });
}

export async function setContentShown(sql: Sql, ctx: RequestContext, workspaceId: string, contentId: string, shown: boolean): Promise<void> {
  if (!z.uuid().safeParse(contentId).success) throw new ServiceError('not_found', 'Not found.');
  await sql.begin(async (tx) => {
    await requireCapability(tx, ctx, workspaceId, 'edit_profile');
    if (shown) {
      const [{ n } = { n: 0 }] = await tx<{ n: number }[]>`SELECT count(*)::int AS n FROM creator_content WHERE workspace_id = ${workspaceId} AND shown_on_profile`;
      if (n >= PROFILE_CONTENT_MAX) throw new ServiceError('invalid', `Up to ${PROFILE_CONTENT_MAX} posts on your page. Remove one first.`);
    }
    const rows = await tx`UPDATE creator_content SET shown_on_profile = ${shown} WHERE id = ${contentId} AND workspace_id = ${workspaceId} RETURNING id`;
    if (!rows.length) throw new ServiceError('not_found', 'Not found.');
    await recordAudit(tx, { workspaceId, actorType: 'user', actorId: ctx.userId, via: ctx.via, entityType: 'profile_page', entityId: workspaceId, action: shown ? 'content_shown' : 'content_hidden', detail: { contentId } });
  });
}

export interface PublicProfile {
  readonly workspaceId: string;
  readonly handle: string;
  readonly publicName: string;
  readonly bio: string | null;
  readonly brandMessage: string | null;
  readonly niches: readonly string[];
  readonly headline: string | null;
  readonly workWithMe: string | null;
  readonly showInquiryForm: boolean;
  readonly accent: string | null;
  readonly photoId: string | null;
  readonly logoId: string | null;
  readonly links: ReadonlyArray<{ platform: Platform; username: string; url: string | null }>;
  readonly metrics: readonly Figure[];
  readonly content: ReadonlyArray<{ id: string; platform: Platform; permalink: string; caption: string | null; publishedAt: Date | null }>;
  readonly partnerships: readonly Partnership[];
  readonly examples: ReadonlyArray<{ id: string; caption: string | null }>;
  readonly publishedAt: Date;
  readonly updatedAt: Date;
}

/**
 * The public media kit for a handle, or null when it does not exist or is not
 * published. Only what the creator chose is included; metrics come only from
 * connected accounts, with source and date; nothing private (rate card, legal
 * name, brands to avoid) is ever selected here.
 */
export async function getPublishedProfile(db: Db, rawHandle: string): Promise<PublicProfile | null> {
  const handle = normalizeHandle(rawHandle);
  if (!/^[a-z0-9._]{3,30}$/.test(handle)) return null;
  const [page] = await db<PageRow[]>`
    SELECT pp.workspace_id, pp.headline, pp.work_with_me, pp.show_inquiry_form, pp.shown_metrics, pp.published_at, greatest(pp.updated_at, cp.updated_at) AS updated_at
    FROM profile_pages pp JOIN creator_profiles cp ON cp.workspace_id = pp.workspace_id
    WHERE cp.handle = ${handle} AND pp.published
  `;
  return page ? assemble(db, page) : null;
}

/** The same page for the creator's team, published or not, so they can check it before going live. */
export async function getProfilePreview(db: Db, ctx: RequestContext, workspaceId: string): Promise<PublicProfile | null> {
  await requireCapability(db, ctx, workspaceId, 'view');
  const [page] = await db<PageRow[]>`
    SELECT pp.workspace_id, pp.headline, pp.work_with_me, pp.show_inquiry_form, pp.shown_metrics, coalesce(pp.published_at, now()) AS published_at, greatest(pp.updated_at, cp.updated_at) AS updated_at
    FROM profile_pages pp JOIN creator_profiles cp ON cp.workspace_id = pp.workspace_id WHERE pp.workspace_id = ${workspaceId}
  `;
  return page ? assemble(db, page) : null;
}

interface PageRow {
  workspace_id: string;
  headline: string | null;
  work_with_me: string | null;
  show_inquiry_form: boolean;
  shown_metrics: MetricKey[];
  published_at: Date;
  updated_at: Date;
}

async function assemble(db: Db, page: PageRow): Promise<PublicProfile | null> {
  const ws = page.workspace_id;
  const profile = await loadProfile(db, ws);
  if (!profile) return null;
  const handle = profile.handle;

  const channels = await db<{ id: string; platform: Platform; username: string }[]>`
    SELECT id, platform, username FROM creator_channels WHERE workspace_id = ${ws} AND revoked_at IS NULL ORDER BY platform
  `;
  const ids = channels.map((c) => c.id);
  const platformOf = new Map(channels.map((c) => [c.id, c.platform]));
  const shown = page.shown_metrics.filter((m): m is MetricKey => (SHOWABLE_METRICS as readonly string[]).includes(m));
  const snaps = ids.length && shown.length
    ? await db<{ channel_id: string; metric: MetricKey; period_kind: string; period_start: Date | null; period_end: Date | null; as_of: Date; value: string; retrieved_at: Date }[]>`
        SELECT DISTINCT ON (channel_id, metric) channel_id, metric, period_kind, period_start, period_end, as_of, value, retrieved_at
        FROM creator_metric_snapshots
        WHERE channel_id = ANY(${ids}) AND content_id IS NULL AND metric = ANY(${shown}) AND availability = 'available'
          AND period_kind IN ('instant', 'week')
        ORDER BY channel_id, metric, as_of DESC, (period_kind = 'week') DESC`
    : [];
  const metrics: Figure[] = snaps.map((s) => ({
    metric: s.metric, source: platformOf.get(s.channel_id) as Platform, value: Number(s.value), availability: 'available',
    periodLabel: periodLabel(s.period_kind, s.period_start, s.period_end, s.as_of), retrievedAt: s.retrieved_at,
  }));

  const content = await db<{ id: string; platform: Platform; permalink: string; caption_excerpt: string | null; published_at: Date | null }[]>`
    SELECT c.id, c.platform, c.permalink, c.caption_excerpt, c.published_at FROM creator_content c
    JOIN creator_channels ch ON ch.id = c.channel_id AND ch.revoked_at IS NULL
    WHERE c.workspace_id = ${ws} AND c.shown_on_profile AND c.permalink IS NOT NULL
    ORDER BY c.published_at DESC NULLS LAST LIMIT ${PROFILE_CONTENT_MAX}
  `;
  const media = await db<{ id: string; kind: string; caption: string | null }[]>`
    SELECT id, kind, caption FROM media_assets WHERE workspace_id = ${ws} AND replaced_at IS NULL ORDER BY created_at
  `;

  return {
    workspaceId: ws, handle, publicName: profile.publicName, bio: profile.bio, brandMessage: profile.brandMessage,
    niches: profile.niches.map((n: Niche) => NICHE_LABELS[n]), headline: page.headline, workWithMe: page.work_with_me,
    showInquiryForm: page.show_inquiry_form, accent: profile.colors[0] ?? null,
    photoId: media.find((m) => m.kind === 'profile_photo')?.id ?? null, logoId: media.find((m) => m.kind === 'logo')?.id ?? null,
    links: channels.map((c) => ({ platform: c.platform, username: c.username, url: platformProfileUrl(c.platform, c.username) })),
    metrics,
    content: content.map((c) => ({ id: c.id, platform: c.platform, permalink: c.permalink, caption: c.caption_excerpt, publishedAt: c.published_at })),
    partnerships: await listPartnerships(db, ws),
    examples: media.filter((m) => m.kind === 'content_example').map((m) => ({ id: m.id, caption: m.caption })),
    publishedAt: page.published_at,
    updatedAt: page.updated_at,
  };
}

/** The handles of every published profile, for the sitemap. */
export async function listPublishedHandles(db: Db): Promise<Array<{ handle: string; updatedAt: Date }>> {
  const rows = await db<{ handle: string; updated_at: Date }[]>`
    SELECT cp.handle, greatest(pp.updated_at, cp.updated_at) AS updated_at FROM profile_pages pp
    JOIN creator_profiles cp ON cp.workspace_id = pp.workspace_id WHERE pp.published ORDER BY cp.handle LIMIT 5000
  `;
  return rows.map((r) => ({ handle: r.handle, updatedAt: r.updated_at }));
}

/** One-way, per-day visitor fingerprint. The address and browser string are never stored. */
export function visitorHash(secret: string, day: string, address: string, userAgent: string): string {
  return createHmac('sha256', secret).update(`${day}|${address}|${userAgent}`).digest('hex');
}

export interface VisitorInfo {
  readonly address: string;
  readonly userAgent: string;
  readonly referrer: string | null;
  readonly ownHost: string | null;
  readonly src: string | null;
}

/** Count a visit to a published profile: once per visitor per day. Returns whether it was new. */
export async function recordVisit(db: Db, handle: string, v: VisitorInfo, secret: string, now = new Date()): Promise<boolean> {
  if (/bot|crawler|spider|preview|facebookexternalhit|slurp/i.test(v.userAgent)) return false;
  const [page] = await db<{ workspace_id: string }[]>`
    SELECT pp.workspace_id FROM profile_pages pp JOIN creator_profiles cp ON cp.workspace_id = pp.workspace_id
    WHERE cp.handle = ${normalizeHandle(handle)} AND pp.published
  `;
  if (!page) return false;
  const day = now.toISOString().slice(0, 10);
  const rows = await db`
    INSERT INTO profile_visits (workspace_id, visited_on, src, referrer_host, visitor_hash)
    VALUES (${page.workspace_id}, ${day}, ${normalizeReferral(v.src)}, ${referrerHost(v.referrer, v.ownHost)}, ${visitorHash(secret, day, v.address, v.userAgent)})
    ON CONFLICT (workspace_id, visited_on, visitor_hash) DO NOTHING RETURNING id
  `;
  return rows.length > 0;
}

const inquiryInput = z.object({
  kind: z.enum(INQUIRY_KINDS, { error: 'Choose what this is about.' }),
  name: z.string().trim().min(2, 'Enter your name.').max(120),
  email: z.email('Enter a valid email address.').max(254).transform((v) => v.toLowerCase()),
  organization: z.string().trim().max(120).transform((v) => v || null),
  message: z.string().trim().min(10, 'Tell them a little more (at least 10 characters).').max(2000),
  consent: z.literal(true, { error: 'Tick the box so they can reply to you.' }),
  src: z.string().max(40).nullable(),
});

export type InquiryOutcome = { status: 'sent' } | { status: 'limited' } | { status: 'unavailable' };

/**
 * An inquiry from the public page. Stores the exact consent text agreed to,
 * hashed sender info for rate limits only, and audits the arrival. GenCut
 * replies to nobody: the creator sees it in the app.
 */
export async function submitInquiry(sql: Sql, rawHandle: string, input: unknown, sender: { address: string; userAgent: string }, secret: string, now = new Date()): Promise<InquiryOutcome> {
  const parsed = inquiryInput.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0] ?? 'form')] ??= i.message;
    throw new ServiceError('invalid', 'Some details need fixing.', fields);
  }
  const v = parsed.data;
  const day = now.toISOString().slice(0, 10);
  const submitter = visitorHash(secret, day, sender.address, sender.userAgent);
  return (await sql.begin(async (tx) => {
    const [page] = await tx<{ workspace_id: string; public_name: string; show_inquiry_form: boolean }[]>`
      SELECT pp.workspace_id, cp.public_name, pp.show_inquiry_form FROM profile_pages pp JOIN creator_profiles cp ON cp.workspace_id = pp.workspace_id
      WHERE cp.handle = ${normalizeHandle(rawHandle)} AND pp.published
    `;
    if (!page || !page.show_inquiry_form) return { status: 'unavailable' } as const;
    const [counts] = await tx<{ mine: number; page: number }[]>`
      SELECT count(*) FILTER (WHERE submitter_hash = ${submitter})::int AS mine, count(*)::int AS page
      FROM creator_inquiries WHERE workspace_id = ${page.workspace_id} AND created_at > ${new Date(now.getTime() - 86_400_000)}
    `;
    if ((counts?.mine ?? 0) >= INQUIRY_LIMIT_PER_SENDER_PER_DAY || (counts?.page ?? 0) >= INQUIRY_LIMIT_PER_PROFILE_PER_DAY) return { status: 'limited' } as const;
    const [consent] = await tx<{ id: string }[]>`
      INSERT INTO consents (workspace_id, channel, address, purpose, disclosure_text, disclosure_version, obtained_at)
      VALUES (${page.workspace_id}, 'email', ${v.email}, 'inquiry_reply', ${inquiryConsentText(page.public_name)}, ${INQUIRY_CONSENT_VERSION}, ${now}) RETURNING id
    `;
    const [row] = await tx<{ id: string }[]>`
      INSERT INTO creator_inquiries (workspace_id, kind, name, email, organization, message, consent_id, src, submitter_hash, created_at)
      VALUES (${page.workspace_id}, ${v.kind}, ${v.name}, ${v.email}, ${v.organization}, ${v.message}, ${consent?.id ?? null}, ${normalizeReferral(v.src)}, ${submitter}, ${now})
      RETURNING id
    `;
    await recordAudit(tx, { workspaceId: page.workspace_id, actorType: 'system', actorId: null, via: 'web', entityType: 'inquiry', entityId: row?.id ?? '', action: 'received', detail: { kind: v.kind } });
    return { status: 'sent' } as const;
  })) as InquiryOutcome;
}

export interface Inquiry {
  readonly id: string;
  readonly kind: InquiryKind;
  readonly name: string;
  readonly email: string;
  readonly organization: string | null;
  readonly message: string;
  readonly src: string | null;
  readonly status: 'new' | 'read' | 'archived';
  readonly createdAt: Date;
}

export async function listInquiries(db: Db, ctx: RequestContext, workspaceId: string): Promise<Inquiry[]> {
  await requireCapability(db, ctx, workspaceId, 'view');
  const rows = await db<{ id: string; kind: InquiryKind; name: string; email: string; organization: string | null; message: string; src: string | null; status: Inquiry['status']; created_at: Date }[]>`
    SELECT id, kind, name, email, organization, message, src, status, created_at FROM creator_inquiries
    WHERE workspace_id = ${workspaceId} AND status <> 'archived' ORDER BY created_at DESC LIMIT 100
  `;
  return rows.map((r) => ({ id: r.id, kind: r.kind, name: r.name, email: r.email, organization: r.organization, message: r.message, src: r.src, status: r.status, createdAt: r.created_at }));
}

export async function setInquiryStatus(sql: Sql, ctx: RequestContext, workspaceId: string, id: string, status: 'read' | 'archived'): Promise<void> {
  if (!z.uuid().safeParse(id).success) throw new ServiceError('not_found', 'Not found.');
  await sql.begin(async (tx) => {
    await requireCapability(tx, ctx, workspaceId, 'view');
    const [before] = await tx<{ status: string }[]>`SELECT status FROM creator_inquiries WHERE id = ${id} AND workspace_id = ${workspaceId} FOR UPDATE`;
    if (!before) throw new ServiceError('not_found', 'Not found.');
    if (before.status === status) return;
    await tx`UPDATE creator_inquiries SET status = ${status} WHERE id = ${id}`;
    await recordAudit(tx, { workspaceId, actorType: 'user', actorId: ctx.userId, via: ctx.via, entityType: 'inquiry', entityId: id, action: 'state_change', fromState: before.status, toState: status });
  });
}
