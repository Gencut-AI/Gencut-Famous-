import 'server-only';
import { type RequestContext, type WorkspaceMembership, ensureUser, listMemberships, pickWorkspace } from '@gencut/services';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { db } from './db.ts';
import { supabaseConfig } from './supabase/config.ts';
import { createSupabaseServerClient } from './supabase/server.ts';

/** Cookie holding the creator a manager last chose; checked against memberships on every request. */
export const WORKSPACE_COOKIE = 'gc_creator';

/** The verified user for this request, or null. Uses getClaims, which verifies the token's signature. */
export const currentUser = cache(async (): Promise<RequestContext | null> => {
  if (!supabaseConfig()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub || typeof claims.email !== 'string') return null;
  return { userId: claims.sub, email: claims.email, via: 'web' };
});

export interface AppSession {
  readonly ctx: RequestContext;
  readonly workspace: WorkspaceMembership;
  readonly memberships: readonly WorkspaceMembership[];
}

/** For signed-in pages: the user and the creator they are working on; else sign-in or onboarding. */
export const requireSession = cache(async (): Promise<AppSession> => {
  const ctx = await currentUser();
  if (!ctx) redirect('/sign-in');
  await ensureUser(db(), ctx);
  const memberships = await listMemberships(db(), ctx);
  const workspace = pickWorkspace(memberships, (await cookies()).get(WORKSPACE_COOKIE)?.value);
  if (!workspace) redirect('/onboarding');
  return { ctx, workspace, memberships };
});
