import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { recordAudit } from './audit.ts';
import type { RequestContext } from './context.ts';
import type { Db, Sql } from './db.ts';
import { ServiceError } from './errors.ts';
import { requireCapability } from './membership.ts';

/**
 * Managers join by a one-time link the creator shares (GenCut sends no email
 * in this version). Only a hash of the token is stored; the link works once,
 * for 7 days, and only for the invited email address.
 */
export const INVITATION_DAYS = 7;

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export interface Invitation {
  readonly id: string;
  readonly email: string;
  readonly expiresAt: Date;
  readonly acceptedAt: Date | null;
  readonly revokedAt: Date | null;
}

export async function createInvitation(sql: Sql, ctx: RequestContext, workspaceId: string, rawEmail: unknown, now = new Date()): Promise<{ invitation: Invitation; token: string }> {
  const email = z.email().max(254).safeParse(String(rawEmail ?? '').trim().toLowerCase());
  if (!email.success) throw new ServiceError('invalid', 'Enter a valid email address.', { email: 'Enter a valid email address.' });
  if (email.data === ctx.email.toLowerCase()) throw new ServiceError('invalid', 'That is your own address.', { email: 'That is your own address.' });
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + INVITATION_DAYS * 86_400_000);
  return (await sql.begin(async (tx) => {
    await requireCapability(tx, ctx, workspaceId, 'manage_team');
    const [already] = await tx`
      SELECT 1 FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.workspace_id = ${workspaceId} AND u.email = ${email.data}
    `;
    if (already) throw new ServiceError('invalid', 'That person already has access.', { email: 'That person already has access.' });
    const [row] = await tx<{ id: string }[]>`
      INSERT INTO invitations (workspace_id, email, token_hash, invited_by, expires_at)
      VALUES (${workspaceId}, ${email.data}, ${hash(token)}, ${ctx.userId}, ${expiresAt}) RETURNING id
    `;
    if (!row) throw new Error('invitation insert returned no row');
    await recordAudit(tx, { workspaceId, actorType: 'user', actorId: ctx.userId, via: ctx.via, entityType: 'invitation', entityId: row.id, action: 'created', detail: { role: 'manager' } });
    return { invitation: { id: row.id, email: email.data, expiresAt, acceptedAt: null, revokedAt: null }, token };
  })) as { invitation: Invitation; token: string };
}

export async function listInvitations(db: Db, ctx: RequestContext, workspaceId: string): Promise<Invitation[]> {
  await requireCapability(db, ctx, workspaceId, 'manage_team');
  const rows = await db<{ id: string; email: string; expires_at: Date; accepted_at: Date | null; revoked_at: Date | null }[]>`
    SELECT id, email, expires_at, accepted_at, revoked_at FROM invitations WHERE workspace_id = ${workspaceId} ORDER BY created_at DESC LIMIT 50
  `;
  return rows.map((r) => ({ id: r.id, email: r.email, expiresAt: r.expires_at, acceptedAt: r.accepted_at, revokedAt: r.revoked_at }));
}

export async function revokeInvitation(sql: Sql, ctx: RequestContext, workspaceId: string, invitationId: string): Promise<void> {
  await sql.begin(async (tx) => {
    await requireCapability(tx, ctx, workspaceId, 'manage_team');
    const rows = await tx`
      UPDATE invitations SET revoked_at = now()
      WHERE id = ${invitationId} AND workspace_id = ${workspaceId} AND accepted_at IS NULL AND revoked_at IS NULL RETURNING id
    `;
    if (!rows.length) throw new ServiceError('not_found', 'That invitation is no longer open.');
    await recordAudit(tx, { workspaceId, actorType: 'user', actorId: ctx.userId, via: ctx.via, entityType: 'invitation', entityId: invitationId, action: 'revoked' });
  });
}

/** Accept an invitation as the signed-in user. Returns the workspace joined. */
export async function acceptInvitation(sql: Sql, ctx: RequestContext, token: string, now = new Date()): Promise<string> {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) throw new ServiceError('not_found', 'This invitation link is not valid.');
  return (await sql.begin(async (tx) => {
    const [inv] = await tx<{ id: string; workspace_id: string; email: string; expires_at: Date; accepted_at: Date | null; revoked_at: Date | null }[]>`
      SELECT id, workspace_id, email, expires_at, accepted_at, revoked_at FROM invitations WHERE token_hash = ${hash(token)} FOR UPDATE
    `;
    if (!inv || inv.revoked_at || inv.accepted_at) throw new ServiceError('not_found', 'This invitation link has already been used or was withdrawn.');
    if (inv.expires_at.getTime() <= now.getTime()) throw new ServiceError('not_found', 'This invitation link has expired. Ask for a new one.');
    if (inv.email !== ctx.email.toLowerCase()) throw new ServiceError('forbidden', `This invitation is for ${inv.email}. Sign in with that address to accept it.`);
    await tx`
      INSERT INTO users (id, email) VALUES (${ctx.userId}, ${ctx.email.toLowerCase()}) ON CONFLICT (id) DO NOTHING
    `;
    await tx`
      INSERT INTO memberships (workspace_id, user_id, role) VALUES (${inv.workspace_id}, ${ctx.userId}, 'manager')
      ON CONFLICT (workspace_id, user_id) DO NOTHING
    `;
    await tx`UPDATE invitations SET accepted_at = ${now}, accepted_by = ${ctx.userId} WHERE id = ${inv.id}`;
    const actor = { workspaceId: inv.workspace_id, actorType: 'user', actorId: ctx.userId, via: ctx.via } as const;
    await recordAudit(tx, { ...actor, entityType: 'invitation', entityId: inv.id, action: 'accepted' });
    await recordAudit(tx, { ...actor, entityType: 'membership', entityId: ctx.userId, action: 'created', toState: 'manager' });
    return inv.workspace_id;
  })) as string;
}

export interface TeamMember {
  readonly userId: string;
  readonly email: string;
  readonly role: 'owner' | 'manager';
}

export async function listTeam(db: Db, ctx: RequestContext, workspaceId: string): Promise<TeamMember[]> {
  await requireCapability(db, ctx, workspaceId, 'view');
  const rows = await db<{ user_id: string; email: string; role: 'owner' | 'manager' }[]>`
    SELECT m.user_id, u.email, m.role FROM memberships m JOIN users u ON u.id = m.user_id
    WHERE m.workspace_id = ${workspaceId} ORDER BY (m.role = 'owner') DESC, u.email
  `;
  return rows.map((r) => ({ userId: r.user_id, email: r.email, role: r.role }));
}

export async function removeManager(sql: Sql, ctx: RequestContext, workspaceId: string, userId: string): Promise<void> {
  await sql.begin(async (tx) => {
    await requireCapability(tx, ctx, workspaceId, 'manage_team');
    const rows = await tx`DELETE FROM memberships WHERE workspace_id = ${workspaceId} AND user_id = ${userId} AND role = 'manager' RETURNING user_id`;
    if (!rows.length) throw new ServiceError('not_found', 'That manager no longer has access.');
    await recordAudit(tx, { workspaceId, actorType: 'user', actorId: ctx.userId, via: ctx.via, entityType: 'membership', entityId: userId, action: 'removed', fromState: 'manager' });
  });
}
