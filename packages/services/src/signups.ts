import type { Role } from '@gencut/core';
import type { RequestContext } from './context.ts';
import { isAdmin } from './creators/referrals.ts';
import type { Db } from './db.ts';
import { ServiceError } from './errors.ts';

/**
 * How far a person got, furthest first:
 * - `published`: a creator they own has a live media kit.
 * - `connected`: a creator they own has Instagram connected.
 * - `onboarded`: owns or manages a creator.
 * - `signed_in`: signed in at least once, no creator yet.
 * - `not_finished`: asked for a sign-in email and never used it.
 */
export type SignupStage = 'published' | 'connected' | 'onboarded' | 'signed_in' | 'not_finished';
export const SIGNUP_STAGES: readonly SignupStage[] = ['not_finished', 'signed_in', 'onboarded', 'connected', 'published'];

/** How many people reached each step, and how long the first live media kit took. */
export interface SignupFunnel {
  /** People who asked for a sign-in email; null when sign-in records are unavailable. */
  readonly asked: number | null;
  readonly signedIn: number;
  readonly onboarded: number;
  readonly connected: number;
  readonly published: number;
  /** Median minutes from first asking to sign in to a live media kit, over people who got there; null when none did. */
  readonly medianMinutesToPublished: number | null;
}

/** The middle value (mean of the two middle values for an even count); null for none. */
export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? (v[mid] as number) : ((v[mid - 1] as number) + (v[mid] as number)) / 2;
}

export interface AdminSignup {
  readonly email: string;
  readonly stage: SignupStage;
  /** When they first asked for a sign-in email. Null when sign-in records are unavailable. */
  readonly requestedAt: Date | null;
  /** Their latest sign-in. Null when they never signed in or sign-in records are unavailable. */
  readonly lastSignInAt: Date | null;
  /** When the app first saw them signed in. */
  readonly firstSeenAt: Date | null;
  /** When Instagram was first connected for a creator they own. */
  readonly connectedAt: Date | null;
  /** When a creator they own first had a live media kit (the current publish time). */
  readonly publishedAt: Date | null;
  /** Minutes from first asking to sign in (or first seen) to a live media kit. */
  readonly minutesToPublished: number | null;
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
  readonly funnel: SignupFunnel;
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
  const creators = await db<{ user_id: string; handle: string; public_name: string; role: Role; referred_by: string | null; connected_at: Date | null; published_at: Date | null }[]>`
    SELECT m.user_id, cp.handle, cp.public_name, m.role, rp.handle AS referred_by,
           (SELECT min(ch.connected_at) FROM creator_channels ch WHERE ch.workspace_id = m.workspace_id AND ch.revoked_at IS NULL) AS connected_at,
           CASE WHEN pp.published THEN pp.published_at END AS published_at
    FROM memberships m
    JOIN creator_profiles cp ON cp.workspace_id = m.workspace_id
    JOIN workspaces w ON w.id = m.workspace_id
    LEFT JOIN creator_profiles rp ON rp.workspace_id = w.referred_by_workspace_id
    LEFT JOIN profile_pages pp ON pp.workspace_id = m.workspace_id
    ORDER BY (m.role = 'owner') DESC, m.created_at, m.workspace_id
  `;
  const byUser = new Map<string, AdminSignup['creators'][number][]>();
  const owned = new Map<string, { connected: Date | null; published: Date | null }>();
  const earliest = (a: Date | null, b: Date | null) => (a && b ? (a < b ? a : b) : a ?? b);
  for (const c of creators) {
    const list = byUser.get(c.user_id) ?? [];
    list.push({ handle: c.handle, publicName: c.public_name, role: c.role, referredByHandle: c.role === 'owner' ? c.referred_by : null });
    byUser.set(c.user_id, list);
    // Progress counts only for creators a person owns: a manager joining an existing creator did not set it up.
    if (c.role === 'owner') {
      const o = owned.get(c.user_id) ?? { connected: null, published: null };
      owned.set(c.user_id, { connected: earliest(o.connected, c.connected_at), published: earliest(o.published, c.published_at) });
    }
  }
  const list: AdminSignup[] = people.map((p) => {
    const mine = byUser.get(p.id) ?? [];
    const o = owned.get(p.id) ?? { connected: null, published: null };
    const signedIn = p.first_seen_at !== null || p.last_sign_in_at !== null;
    const start = p.requested_at ?? p.first_seen_at;
    const stage: SignupStage = o.published ? 'published' : o.connected ? 'connected' : mine.length > 0 ? 'onboarded' : signedIn ? 'signed_in' : 'not_finished';
    return {
      email: p.email,
      stage,
      requestedAt: p.requested_at,
      lastSignInAt: p.last_sign_in_at,
      firstSeenAt: p.first_seen_at,
      connectedAt: o.connected,
      publishedAt: o.published,
      minutesToPublished: o.published && start ? Math.max(0, Math.round((o.published.getTime() - start.getTime()) / 60_000)) : null,
      creators: mine,
    };
  });
  const reached = (s: SignupStage) => list.filter((p) => SIGNUP_STAGES.indexOf(p.stage) >= SIGNUP_STAGES.indexOf(s)).length;
  return {
    signInRecords: withAuth ? 'available' : 'unavailable',
    people: list,
    funnel: {
      asked: withAuth ? list.length : null,
      signedIn: reached('signed_in'),
      onboarded: reached('onboarded'),
      connected: reached('connected'),
      published: reached('published'),
      medianMinutesToPublished: median(list.flatMap((p) => (p.minutesToPublished === null ? [] : [p.minutesToPublished]))),
    },
  };
}
