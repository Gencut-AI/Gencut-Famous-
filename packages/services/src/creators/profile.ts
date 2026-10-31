import {
  type CreatorProfile,
  NICHES,
  type Niche,
  PARTNERSHIP_KINDS,
  type PartnershipKind,
  type RateCardItem,
  TONES,
  type Tone,
  normalizeColor,
  splitList,
  validateHandle,
} from '@gencut/core';
import { z } from 'zod';
import { recordAudit } from '../audit.ts';
import type { RequestContext } from '../context.ts';
import type { Db, Sql } from '../db.ts';
import { ServiceError } from '../errors.ts';
import { requireCapability } from '../membership.ts';

function invalid(error: z.ZodError): ServiceError {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) fields[String(issue.path[0] ?? 'form')] ??= issue.message;
  return new ServiceError('invalid', 'Some details need fixing.', fields);
}

const optionalText = (max: number) =>
  z.string().trim().max(max, `Keep this under ${max} characters.`).transform((v) => (v ? v : null));

export const onboardingInput = z.object({
  publicName: z.string().trim().min(1, 'Enter the name you publish under.').max(80),
  handle: z.string(),
  adult: z.literal(true, { error: 'GenCut Famous is for creators aged 18 or older in this version.' }),
});

/**
 * Start a creator: one workspace, owned by the signed-in user, with the two
 * required profile fields. Everything else is optional and comes later.
 */
export async function createCreator(sql: Sql, ctx: RequestContext, input: unknown): Promise<string> {
  const parsed = onboardingInput.safeParse(input);
  if (!parsed.success) throw invalid(parsed.error);
  const handle = validateHandle(parsed.data.handle);
  if (!handle.ok) throw new ServiceError('invalid', 'Some details need fixing.', { handle: handle.message });
  return (await sql.begin(async (tx) => {
    const [taken] = await tx`SELECT 1 FROM creator_profiles WHERE handle = ${handle.value}`;
    if (taken) throw new ServiceError('invalid', 'Some details need fixing.', { handle: 'That handle is taken. Try another.' });
    const [ws] = await tx<{ id: string }[]>`INSERT INTO workspaces (name) VALUES (${parsed.data.publicName}) RETURNING id`;
    if (!ws) throw new Error('workspace insert returned no row');
    await tx`INSERT INTO users (id, email) VALUES (${ctx.userId}, ${ctx.email.toLowerCase()}) ON CONFLICT (id) DO NOTHING`;
    await tx`INSERT INTO memberships (workspace_id, user_id, role) VALUES (${ws.id}, ${ctx.userId}, 'owner')`;
    await tx`
      INSERT INTO creator_profiles (workspace_id, public_name, handle, adult_attested_at, adult_attested_by)
      VALUES (${ws.id}, ${parsed.data.publicName}, ${handle.value}, now(), ${ctx.userId})
    `;
    await tx`INSERT INTO profile_pages (workspace_id) VALUES (${ws.id})`;
    const actor = { workspaceId: ws.id, actorType: 'user', actorId: ctx.userId, via: ctx.via } as const;
    await recordAudit(tx, { ...actor, entityType: 'workspace', entityId: ws.id, action: 'created' });
    await recordAudit(tx, { ...actor, entityType: 'membership', entityId: ctx.userId, action: 'created', toState: 'owner' });
    await recordAudit(tx, { ...actor, entityType: 'creator_profile', entityId: ws.id, action: 'created', detail: { handle: handle.value, adultAttested: true } });
    return ws.id;
  })) as string;
}

interface ProfileRow {
  workspace_id: string;
  public_name: string;
  handle: string;
  legal_name: string | null;
  bio: string | null;
  niches: Niche[];
  target_audience: string | null;
  audience_notes: string | null;
  brand_message: string | null;
  brand_values: string[];
  tone: Tone | null;
  tone_notes: string | null;
  colors: string[];
  fonts: string[];
  goals: string | null;
  growth_target: string | null;
  partnership_kinds: PartnershipKind[];
  brands_wanted: string[];
  brands_avoided: string[];
  rate_card: RateCardItem[];
  has_logo: boolean;
  has_photo: boolean;
  content_examples: number;
  updated_at: Date;
}

export function toProfile(r: ProfileRow): CreatorProfile {
  return {
    workspaceId: r.workspace_id, publicName: r.public_name, handle: r.handle, legalName: r.legal_name, bio: r.bio,
    niches: r.niches, targetAudience: r.target_audience, audienceNotes: r.audience_notes, brandMessage: r.brand_message,
    values: r.brand_values, tone: r.tone, toneNotes: r.tone_notes, colors: r.colors, fonts: r.fonts, goals: r.goals,
    growthTarget: r.growth_target, partnershipKinds: r.partnership_kinds, brandsWanted: r.brands_wanted,
    brandsAvoided: r.brands_avoided, rateCard: r.rate_card, hasLogo: r.has_logo, hasPhoto: r.has_photo,
    contentExamples: Number(r.content_examples), updatedAt: r.updated_at,
  };
}

export async function loadProfile(db: Db, workspaceId: string): Promise<CreatorProfile | null> {
  const [row] = await db<ProfileRow[]>`
    SELECT p.*,
      EXISTS (SELECT 1 FROM media_assets m WHERE m.workspace_id = p.workspace_id AND m.kind = 'logo' AND m.replaced_at IS NULL) AS has_logo,
      EXISTS (SELECT 1 FROM media_assets m WHERE m.workspace_id = p.workspace_id AND m.kind = 'profile_photo' AND m.replaced_at IS NULL) AS has_photo,
      (SELECT count(*) FROM media_assets m WHERE m.workspace_id = p.workspace_id AND m.kind = 'content_example')::int AS content_examples
    FROM creator_profiles p WHERE p.workspace_id = ${workspaceId}
  `;
  return row ? toProfile(row) : null;
}

export async function getCreatorProfile(db: Db, ctx: RequestContext, workspaceId: string): Promise<CreatorProfile> {
  await requireCapability(db, ctx, workspaceId, 'view');
  const p = await loadProfile(db, workspaceId);
  if (!p) throw new ServiceError('not_found', 'This creator has no profile yet.');
  return p;
}

const listField = (max: number, maxLength = 60) => z.string().max(4000).transform((v) => splitList(v, max, maxLength));

/** Every editable field. A save sends only the fields of the section being edited. */
export const profilePatch = z
  .object({
    publicName: z.string().trim().min(1, 'Enter the name you publish under.').max(80),
    handle: z.string(),
    legalName: optionalText(120),
    bio: optionalText(600),
    niches: z.array(z.enum(NICHES)).max(5, 'Choose up to 5.'),
    targetAudience: optionalText(400),
    audienceNotes: optionalText(600),
    brandMessage: optionalText(400),
    values: listField(8, 40),
    tone: z.enum(TONES).nullable(),
    toneNotes: optionalText(400),
    colors: z.string().max(200).transform((v, c) => {
      const parts = splitList(v, 6, 9);
      const colors = parts.map(normalizeColor);
      if (colors.some((x) => x === null)) {
        c.addIssue({ code: 'custom', message: 'Use hex colors like #0f6e73, separated by commas.' });
        return z.NEVER;
      }
      return colors as string[];
    }),
    fonts: listField(3, 60),
    goals: optionalText(600),
    growthTarget: optionalText(200),
    partnershipKinds: z.array(z.enum(PARTNERSHIP_KINDS)),
    brandsWanted: listField(30),
    brandsAvoided: listField(30),
    rateCard: z
      .array(z.object({ deliverable: z.string().trim().min(1).max(80), priceUsd: z.number().int().min(0).max(10_000_000) }))
      .max(12),
  })
  .partial();

const COLUMNS: Readonly<Record<string, string>> = {
  publicName: 'public_name', handle: 'handle', legalName: 'legal_name', bio: 'bio', niches: 'niches',
  targetAudience: 'target_audience', audienceNotes: 'audience_notes', brandMessage: 'brand_message', values: 'brand_values',
  tone: 'tone', toneNotes: 'tone_notes', colors: 'colors', fonts: 'fonts', goals: 'goals', growthTarget: 'growth_target',
  partnershipKinds: 'partnership_kinds', brandsWanted: 'brands_wanted', brandsAvoided: 'brands_avoided', rateCard: 'rate_card',
};

/** Save the fields sent; records which fields changed (names only, never values). */
export async function updateProfile(sql: Sql, ctx: RequestContext, workspaceId: string, input: unknown): Promise<CreatorProfile> {
  const parsed = profilePatch.safeParse(input);
  if (!parsed.success) throw invalid(parsed.error);
  const patch: Record<string, unknown> = { ...parsed.data };
  if (typeof patch.handle === 'string') {
    const h = validateHandle(patch.handle);
    if (!h.ok) throw new ServiceError('invalid', 'Some details need fixing.', { handle: h.message });
    patch.handle = h.value;
  }
  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    const col = COLUMNS[k];
    if (col && v !== undefined) row[col] = k === 'rateCard' ? sql.json(v as never) : v;
  }
  return (await sql.begin(async (tx) => {
    await requireCapability(tx, ctx, workspaceId, 'edit_profile');
    const before = await loadProfile(tx, workspaceId);
    if (!before) throw new ServiceError('not_found', 'This creator has no profile yet.');
    if (row.handle && row.handle !== before.handle) {
      const [taken] = await tx`SELECT 1 FROM creator_profiles WHERE handle = ${row.handle as string} AND workspace_id <> ${workspaceId}`;
      if (taken) throw new ServiceError('invalid', 'Some details need fixing.', { handle: 'That handle is taken. Try another.' });
    }
    const cols = Object.keys(row);
    if (cols.length) {
      await tx`UPDATE creator_profiles SET ${tx(row as Record<string, never>, cols)}, updated_at = now() WHERE workspace_id = ${workspaceId}`;
      if (row.public_name) await tx`UPDATE workspaces SET name = ${row.public_name as string} WHERE id = ${workspaceId}`;
      const changed = Object.keys(patch).filter((k) => JSON.stringify((before as unknown as Record<string, unknown>)[k]) !== JSON.stringify(patch[k]));
      if (changed.length) {
        await recordAudit(tx, { workspaceId, actorType: 'user', actorId: ctx.userId, via: ctx.via, entityType: 'creator_profile', entityId: workspaceId, action: 'updated', detail: { fields: changed } });
      }
    }
    const after = await loadProfile(tx, workspaceId);
    if (!after) throw new Error('profile vanished');
    return after;
  })) as CreatorProfile;
}

export interface Partnership {
  readonly id: string;
  readonly brandName: string;
  readonly description: string | null;
  readonly period: string | null;
  readonly url: string | null;
}

const partnershipInput = z.object({
  brandName: z.string().trim().min(1, 'Enter the brand.').max(80),
  description: optionalText(280),
  period: optionalText(40),
  url: z.string().trim().max(500).transform((v) => (v ? v : null)).refine((v) => v === null || /^https:\/\/[^\s]+$/.test(v), 'Use a full https:// link.'),
});

export async function listPartnerships(db: Db, workspaceId: string): Promise<Partnership[]> {
  const rows = await db<{ id: string; brand_name: string; description: string | null; period: string | null; url: string | null }[]>`
    SELECT id, brand_name, description, period, url FROM creator_partnerships WHERE workspace_id = ${workspaceId} ORDER BY created_at
  `;
  return rows.map((r) => ({ id: r.id, brandName: r.brand_name, description: r.description, period: r.period, url: r.url }));
}

/** Partnerships are always self-reported: GenCut cannot verify them. */
export async function addPartnership(sql: Sql, ctx: RequestContext, workspaceId: string, input: unknown): Promise<void> {
  const parsed = partnershipInput.safeParse(input);
  if (!parsed.success) throw invalid(parsed.error);
  await sql.begin(async (tx) => {
    await requireCapability(tx, ctx, workspaceId, 'edit_profile');
    const [{ n } = { n: 0 }] = await tx<{ n: number }[]>`SELECT count(*)::int AS n FROM creator_partnerships WHERE workspace_id = ${workspaceId}`;
    if (n >= 20) throw new ServiceError('invalid', 'Up to 20 partnerships.');
    const v = parsed.data;
    const [row] = await tx<{ id: string }[]>`
      INSERT INTO creator_partnerships (workspace_id, brand_name, description, period, url, created_by)
      VALUES (${workspaceId}, ${v.brandName}, ${v.description}, ${v.period}, ${v.url}, ${ctx.userId}) RETURNING id
    `;
    await recordAudit(tx, { workspaceId, actorType: 'user', actorId: ctx.userId, via: ctx.via, entityType: 'creator_profile', entityId: workspaceId, action: 'partnership_added', detail: { partnershipId: row?.id } });
  });
}

export async function removePartnership(sql: Sql, ctx: RequestContext, workspaceId: string, id: string): Promise<void> {
  await sql.begin(async (tx) => {
    await requireCapability(tx, ctx, workspaceId, 'edit_profile');
    if (!z.uuid().safeParse(id).success) throw new ServiceError('not_found', 'Not found.');
    await tx`DELETE FROM creator_partnerships WHERE id = ${id} AND workspace_id = ${workspaceId}`;
    await recordAudit(tx, { workspaceId, actorType: 'user', actorId: ctx.userId, via: ctx.via, entityType: 'creator_profile', entityId: workspaceId, action: 'partnership_removed', detail: { partnershipId: id } });
  });
}
