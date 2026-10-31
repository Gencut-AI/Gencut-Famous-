import type { Role } from '@gencut/core';
import type { RequestContext } from './context.ts';
import type { Db, Sql } from './db.ts';

export interface WorkspaceMembership {
  readonly workspaceId: string;
  readonly name: string;
  readonly handle: string | null;
  readonly role: Role;
}

/** Record the signed-in user (id and email come from the verified session). Safe on every request. */
export async function ensureUser(sql: Sql, ctx: RequestContext): Promise<void> {
  await sql`
    INSERT INTO users (id, email) VALUES (${ctx.userId}, ${ctx.email.toLowerCase()})
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email WHERE users.email IS DISTINCT FROM EXCLUDED.email
  `;
}

/** Every creator the user can work on: their own first, then those they manage. */
export async function listMemberships(db: Db, ctx: RequestContext): Promise<WorkspaceMembership[]> {
  const rows = await db<{ workspace_id: string; name: string; handle: string | null; role: Role }[]>`
    SELECT m.workspace_id, coalesce(p.public_name, w.name) AS name, p.handle, m.role
    FROM memberships m
    JOIN workspaces w ON w.id = m.workspace_id
    LEFT JOIN creator_profiles p ON p.workspace_id = m.workspace_id
    WHERE m.user_id = ${ctx.userId}
    ORDER BY (m.role = 'owner') DESC, m.created_at, m.workspace_id
  `;
  return rows.map((r) => ({ workspaceId: r.workspace_id, name: r.name, handle: r.handle, role: r.role }));
}

/** The workspace to show: the one the user picked (cookie), if still allowed, else their first. */
export function pickWorkspace(memberships: readonly WorkspaceMembership[], preferred: string | null | undefined): WorkspaceMembership | null {
  return memberships.find((m) => m.workspaceId === preferred) ?? memberships[0] ?? null;
}
