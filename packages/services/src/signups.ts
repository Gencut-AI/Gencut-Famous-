import type { Role } from '@gencut/core';
import type { RequestContext } from './context.ts';
import { isAdmin } from './creators/referrals.ts';
import type { Db } from './db.ts';
import { ServiceError } from './errors.ts';

/**
 * How far a person got:
 * - `onboarded`: owns or manages a creator.
 * - `signed_in`: signed in at least once, no creator yet.
 * - `not_finished`: asked for a sign-in email and never used it.
 */
export type SignupStage = 'onboarded' | 'signed_in' | 'not_finished';

export interface AdminSignup {
  readonly email: string;
  readonly stage: SignupStage;
  /** When they first asked for a sign-in email. Null when sign-in records are unavailable. */
  readonly requestedAt: Date | null;
  /** Their latest sign-in. Null when they never signed in or sign-in records are unavailable. */
  readonly lastSignInAt: Date | null;
  /** When the app first saw them signed in. */
  readonly firstSeenAt: Date | null;
  readonly creators: ReadonlyArray<{ handle: string; publicName: string; role: Role; referredByHandle: string | null }>;
}

export interface AdminSignups {
  /**
   * Whether the sign-in provider's own records (Supabase `auth.users`) could be
   * read. When false, people who never finished signing in cannot be listed and
   * sign-in times are unknown; the page says so instead of showing zero.
   */
  readonly signInRecords: 'available' | 'unavailable';
  readonly people: readonly AdminSignup[];
}

async function canReadSignInRecords(db: Db): Promise<boolean> {
  const [r] = await db<{ ok: boolean }[]>`
    SELECT has_schema_privilege(n.oid, 'USAGE') AND has_table_privilege(c.oid, 'SELECT') AS ok
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'auth' AND c.relname = 'users'
  `;
  return r?.ok === true;
}

interface PersonRow {
  id: string;
  email: string;
  requested_at: Date | null;
  last_sign_in_at: Date | null;
  first_seen_at: Date | null;
}

/** Everyone who signed up or asked to, newest first, for GenCut staff. */
export async function listSignups(db: Db, ctx: RequestContext, adminEmails: string | undefined): Promise<AdminSignups> {
  if (!isAdmin(ctx.email, adminEmails)) throw new ServiceError('forbidden', 'GenCut staff only.');
  const withAuth = await canReadSignInRecords(db);
  const people = withAuth
    ? await db<PersonRow[]>`
        SELECT coalesce(u.id, au.id) AS id, coalesce(u.email, lower(au.email)) AS email,
               au.created_at AS requested_at, au.last_sign_in_at, u.created_at AS first_seen_at
        FROM auth.users au FULL JOIN users u ON u.id = au.id
        WHERE u.id IS NOT NULL OR au.email IS NOT NULL
        ORDER BY coalesce(au.created_at, u.created_at) DESC LIMIT 1000
      `
    : await db<PersonRow[]>`
        SELECT u.id, u.email, NULL::timestamptz AS requested_at, NULL::timestamptz AS last_sign_in_at, u.created_at AS first_seen_at
        FROM users u ORDER BY u.created_at DESC LIMIT 1000
      `;
  const creators = await db<{ user_id: string; handle: string; public_name: string; role: Role; referred_by: string | null }[]>`
    SELECT m.user_id, cp.handle, cp.public_name, m.role, rp.handle AS referred_by
    FROM memberships m
    JOIN creator_profiles cp ON cp.workspace_id = m.workspace_id
    JOIN workspaces w ON w.id = m.workspace_id
    LEFT JOIN creator_profiles rp ON rp.workspace_id = w.referred_by_workspace_id
    ORDER BY (m.role = 'owner') DESC, m.created_at, m.workspace_id
  `;
  const byUser = new Map<string, AdminSignup['creators'][number][]>();
  for (const c of creators) {
    const list = byUser.get(c.user_id) ?? [];
    list.push({ handle: c.handle, publicName: c.public_name, role: c.role, referredByHandle: c.role === 'owner' ? c.referred_by : null });
    byUser.set(c.user_id, list);
  }
  return {
    signInRecords: withAuth ? 'available' : 'unavailable',
    people: people.map((p) => {
      const mine = byUser.get(p.id) ?? [];
      const signedIn = p.first_seen_at !== null || p.last_sign_in_at !== null;
      return {
        email: p.email,
        stage: mine.length > 0 ? 'onboarded' : signedIn ? 'signed_in' : 'not_finished',
        requestedAt: p.requested_at,
        lastSignInAt: p.last_sign_in_at,
        firstSeenAt: p.first_seen_at,
        creators: mine,
      };
    }),
  };
}
