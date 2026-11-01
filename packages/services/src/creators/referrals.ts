import {
  REFERRAL_CONSENT_VERSION,
  REFERRAL_LEADS_PER_LINK_PER_DAY,
  REFERRAL_LEADS_PER_SENDER_PER_DAY,
  REFERRAL_LEAD_ROLES,
  type ReferralLeadRole,
  normalizeReferral,
  normalizeReferralCode,
  referralConsentText,
} from '@gencut/core';
import { z } from 'zod';
import { recordAudit } from '../audit.ts';
import type { RequestContext } from '../context.ts';
import type { Db, Sql } from '../db.ts';
import { ServiceError } from '../errors.ts';
import { requireCapability } from '../membership.ts';
import { visitorHash } from './public-profile.ts';

interface Referrer {
  workspaceId: string;
  code: string;
  publicName: string;
  handle: string;
  photoId: string | null;
}

async function findReferrer(db: Db, rawCode: string | null | undefined): Promise<Referrer | null> {
  const code = normalizeReferralCode(rawCode);
  if (!code) return null;
  const [r] = await db<{ workspace_id: string; code: string; public_name: string; handle: string; photo_id: string | null }[]>`
    SELECT rc.workspace_id, rc.code, cp.public_name, cp.handle,
      (SELECT m.id FROM media_assets m JOIN profile_pages pp ON pp.workspace_id = m.workspace_id AND pp.published
       WHERE m.workspace_id = rc.workspace_id AND m.kind = 'profile_photo' AND m.replaced_at IS NULL LIMIT 1) AS photo_id
    FROM referral_codes rc JOIN creator_profiles cp ON cp.workspace_id = rc.workspace_id
    WHERE rc.code = ${code} AND rc.active
  `;
  return r ? { workspaceId: r.workspace_id, code: r.code, publicName: r.public_name, handle: r.handle, photoId: r.photo_id } : null;
}

/** What the public join page shows: who invited you. Null for an unknown or switched-off code. */
export async function getJoinPage(db: Db, rawCode: string): Promise<Omit<Referrer, 'workspaceId'> | null> {
  const r = await findReferrer(db, rawCode);
  return r ? { code: r.code, publicName: r.publicName, handle: r.handle, photoId: r.photoId } : null;
}

/** Count a join-page visit once per visitor per day. Crawlers are skipped; no address is stored. */
export async function recordReferralVisit(db: Db, rawCode: string, v: { address: string; userAgent: string; src: string | null }, secret: string, now = new Date()): Promise<boolean> {
  if (/bot|crawler|spider|preview|facebookexternalhit|slurp/i.test(v.userAgent)) return false;
  const r = await findReferrer(db, rawCode);
  if (!r) return false;
  const day = now.toISOString().slice(0, 10);
  const rows = await db`
    INSERT INTO referral_visits (referrer_workspace_id, visited_on, src, visitor_hash)
    VALUES (${r.workspaceId}, ${day}, ${normalizeReferral(v.src)}, ${visitorHash(secret, `ref:${day}`, v.address, v.userAgent)})
    ON CONFLICT (referrer_workspace_id, visited_on, visitor_hash) DO NOTHING RETURNING id
  `;
  return rows.length > 0;
}

const leadInput = z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(120),
  email: z.email('Enter a valid email address.').max(254).transform((v) => v.toLowerCase()),
  socialHandle: z.string().trim().max(60).transform((v) => v.replace(/^@+/, '') || null),
  role: z.enum(REFERRAL_LEAD_ROLES, { error: 'Choose what describes you.' }),
  consent: z.literal(true, { error: 'Tick the box so GenCut can contact you.' }),
  src: z.string().max(40).nullable(),
});

export type ReferralLeadOutcome = { status: 'sent' } | { status: 'limited' } | { status: 'unavailable' };

/** Someone not ready to sign up leaves their details on a join page. */
export async function submitReferralLead(sql: Sql, rawCode: string, input: unknown, sender: { address: string; userAgent: string }, secret: string, now = new Date()): Promise<ReferralLeadOutcome> {
  const parsed = leadInput.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0] ?? 'form')] ??= i.message;
    throw new ServiceError('invalid', 'Some details need fixing.', fields);
  }
  const v = parsed.data;
  const submitter = visitorHash(secret, `lead:${now.toISOString().slice(0, 10)}`, sender.address, sender.userAgent);
  return (await sql.begin(async (tx) => {
    const r = await findReferrer(tx, rawCode);
    if (!r) return { status: 'unavailable' } as const;
    const [c] = await tx<{ mine: number; link: number }[]>`
      SELECT count(*) FILTER (WHERE submitter_hash = ${submitter})::int AS mine, count(*)::int AS link
      FROM referral_leads WHERE referrer_workspace_id = ${r.workspaceId} AND created_at > ${new Date(now.getTime() - 86_400_000)}
    `;
    if ((c?.mine ?? 0) >= REFERRAL_LEADS_PER_SENDER_PER_DAY || (c?.link ?? 0) >= REFERRAL_LEADS_PER_LINK_PER_DAY) return { status: 'limited' } as const;
    const [consent] = await tx<{ id: string }[]>`
      INSERT INTO consents (workspace_id, channel, address, purpose, disclosure_text, disclosure_version, obtained_at)
      VALUES (${r.workspaceId}, 'email', ${v.email}, 'referral_followup', ${referralConsentText(r.publicName)}, ${REFERRAL_CONSENT_VERSION}, ${now}) RETURNING id
    `;
    const [lead] = await tx<{ id: string }[]>`
      INSERT INTO referral_leads (referrer_workspace_id, name, email, social_handle, role, consent_id, src, submitter_hash, created_at)
      VALUES (${r.workspaceId}, ${v.name}, ${v.email}, ${v.socialHandle}, ${v.role}, ${consent?.id ?? null}, ${normalizeReferral(v.src)}, ${submitter}, ${now})
      RETURNING id
    `;
    await recordAudit(tx, { workspaceId: r.workspaceId, actorType: 'system', actorId: null, via: 'web', entityType: 'referral', entityId: lead?.id ?? '', action: 'lead_received', detail: { role: v.role } });
    return { status: 'sent' } as const;
  })) as ReferralLeadOutcome;
}

/**
 * Credit a new workspace to the creator whose link it came through. Called
 * inside account creation. A creator cannot refer themselves; an unknown code
 * is ignored. A lead with the same email is marked as joined.
 */
export async function attributeSignup(tx: Db, newWorkspaceId: string, rawCode: string, ctx: RequestContext): Promise<void> {
  const r = await findReferrer(tx, rawCode);
  if (!r) return;
  const [own] = await tx`SELECT 1 FROM memberships WHERE workspace_id = ${r.workspaceId} AND user_id = ${ctx.userId}`;
  if (own) return;
  await tx`UPDATE workspaces SET referred_by_workspace_id = ${r.workspaceId}, referred_at = now() WHERE id = ${newWorkspaceId} AND referred_by_workspace_id IS NULL`;
  await tx`UPDATE referral_leads SET joined_workspace_id = ${newWorkspaceId} WHERE referrer_workspace_id = ${r.workspaceId} AND email = ${ctx.email.toLowerCase()} AND joined_workspace_id IS NULL`;
  await recordAudit(tx, { workspaceId: r.workspaceId, actorType: 'system', actorId: null, via: ctx.via, entityType: 'referral', entityId: newWorkspaceId, action: 'signup_credited' });
}

export interface ReferralOverview {
  readonly code: string;
  readonly visits7: number;
  readonly visits30: number;
  readonly visitsAll: number;
  readonly bySource: ReadonlyArray<{ source: string; visits: number }>;
  readonly signups: ReadonlyArray<{ publicName: string; handle: string; joinedAt: Date }>;
  /** Leads as the referrer may see them: never the email (the consent text promises this). */
  readonly leads: ReadonlyArray<{ id: string; name: string; socialHandle: string | null; role: ReferralLeadRole; createdAt: Date; joined: boolean }>;
}

/** The referrer's own results. */
export async function getReferralOverview(sql: Sql, ctx: RequestContext, workspaceId: string): Promise<ReferralOverview> {
  await requireCapability(sql, ctx, workspaceId, 'view');
  let [rc] = await sql<{ code: string }[]>`SELECT code FROM referral_codes WHERE workspace_id = ${workspaceId}`;
  if (!rc) {
    // Creators made before referrals existed get their code on first view.
    [rc] = await sql<{ code: string }[]>`
      INSERT INTO referral_codes (workspace_id, code)
      SELECT workspace_id, handle FROM creator_profiles WHERE workspace_id = ${workspaceId}
      ON CONFLICT (workspace_id) DO UPDATE SET code = referral_codes.code RETURNING code
    `;
  }
  if (!rc) throw new ServiceError('not_found', 'This creator has no profile yet.');
  const [v] = await sql<{ d7: number; d30: number; all: number }[]>`
    SELECT count(*) FILTER (WHERE visited_on > current_date - 7)::int AS d7,
           count(*) FILTER (WHERE visited_on > current_date - 30)::int AS d30,
           count(*)::int AS all
    FROM referral_visits WHERE referrer_workspace_id = ${workspaceId}
  `;
  const bySource = await sql<{ source: string; visits: number }[]>`
    SELECT coalesce(src, 'direct') AS source, count(*)::int AS visits FROM referral_visits
    WHERE referrer_workspace_id = ${workspaceId} GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 6
  `;
  const signups = await sql<{ public_name: string; handle: string; referred_at: Date }[]>`
    SELECT cp.public_name, cp.handle, w.referred_at FROM workspaces w JOIN creator_profiles cp ON cp.workspace_id = w.id
    WHERE w.referred_by_workspace_id = ${workspaceId} ORDER BY w.referred_at DESC LIMIT 200
  `;
  const leads = await sql<{ id: string; name: string; social_handle: string | null; role: ReferralLeadRole; created_at: Date; joined: boolean }[]>`
    SELECT id, name, social_handle, role, created_at, joined_workspace_id IS NOT NULL AS joined FROM referral_leads
    WHERE referrer_workspace_id = ${workspaceId} ORDER BY created_at DESC LIMIT 200
  `;
  return {
    code: rc.code,
    visits7: v?.d7 ?? 0,
    visits30: v?.d30 ?? 0,
    visitsAll: v?.all ?? 0,
    bySource: bySource.map((b) => ({ source: b.source, visits: b.visits })),
    signups: signups.map((s) => ({ publicName: s.public_name, handle: s.handle, joinedAt: s.referred_at })),
    leads: leads.map((l) => ({ id: l.id, name: l.name, socialHandle: l.social_handle, role: l.role, createdAt: l.created_at, joined: l.joined })),
  };
}

/** GenCut staff are listed by email in configuration (GENCUT_ADMIN_EMAILS); nobody else is. */
export function isAdmin(email: string, adminEmails: string | undefined): boolean {
  const list = (adminEmails ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

export interface AdminReferralLead {
  readonly name: string;
  readonly email: string;
  readonly socialHandle: string | null;
  readonly role: ReferralLeadRole;
  readonly src: string | null;
  readonly createdAt: Date;
  readonly joined: boolean;
  readonly referrerHandle: string;
}

/** Every referral lead with its email, for GenCut staff to follow up. */
export async function listAllReferralLeads(db: Db, ctx: RequestContext, adminEmails: string | undefined): Promise<AdminReferralLead[]> {
  if (!isAdmin(ctx.email, adminEmails)) throw new ServiceError('forbidden', 'GenCut staff only.');
  const rows = await db<{ name: string; email: string; social_handle: string | null; role: ReferralLeadRole; src: string | null; created_at: Date; joined: boolean; handle: string }[]>`
    SELECT l.name, l.email, l.social_handle, l.role, l.src, l.created_at, l.joined_workspace_id IS NOT NULL AS joined, cp.handle
    FROM referral_leads l JOIN creator_profiles cp ON cp.workspace_id = l.referrer_workspace_id
    ORDER BY l.created_at DESC LIMIT 1000
  `;
  return rows.map((r) => ({ name: r.name, email: r.email, socialHandle: r.social_handle, role: r.role, src: r.src, createdAt: r.created_at, joined: r.joined, referrerHandle: r.handle }));
}
