import { type Capability, type Role, can } from '@gencut/core';
import { z } from 'zod';
import type { RequestContext } from './context.ts';
import type { Db } from './db.ts';
import { ServiceError } from './errors.ts';

/** The caller's role in the workspace, or `forbidden`. Every workspace read and write goes through this. */
export async function requireMembership(db: Db, userId: string, workspaceId: string): Promise<Role> {
  if (!z.uuid().safeParse(workspaceId).success) throw new ServiceError('forbidden', 'You do not have access to this creator.');
  const [row] = await db<{ role: Role }[]>`
    SELECT role FROM memberships WHERE workspace_id = ${workspaceId} AND user_id = ${userId}
  `;
  if (!row) throw new ServiceError('forbidden', 'You do not have access to this creator.');
  return row.role;
}

/** Membership plus a capability check (roles.ts in core). */
export async function requireCapability(db: Db, ctx: RequestContext, workspaceId: string, capability: Capability): Promise<Role> {
  const role = await requireMembership(db, ctx.userId, workspaceId);
  if (!can(role, capability)) throw new ServiceError('forbidden', 'Only the creator can do that.');
  return role;
}
