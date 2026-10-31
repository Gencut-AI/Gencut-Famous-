import { OAUTH_STATE_MINUTES, instagramAuthorizeUrl, newNonce, requireCapability, signState } from '@gencut/services';
import { NextResponse } from 'next/server';
import { connectorDeps, siteOrigin, stateSecret } from '../../../../../lib/connectors.ts';
import { db } from '../../../../../lib/db.ts';
import { requireSession } from '../../../../../lib/session.ts';

const NONCE_COOKIE = 'gc_oauth_nonce';

/**
 * Start Instagram sign-in for the creator being worked on. The signed state
 * carries the creator, the user and a nonce; the same nonce goes into an
 * HttpOnly cookie, so only this browser can finish this connection.
 */
export async function GET() {
  const { ctx, workspace } = await requireSession();
  const deps = connectorDeps();
  const secret = stateSecret();
  if (!deps || !secret) return NextResponse.redirect(new URL('/channels?error=not_configured', await siteOrigin()), 303);
  await requireCapability(db(), ctx, workspace.workspaceId, 'manage_channels');
  const nonce = newNonce();
  const state = signState(secret, { platform: 'instagram', workspaceId: workspace.workspaceId, userId: ctx.userId, nonce, expiresAt: Date.now() + OAUTH_STATE_MINUTES * 60_000 });
  const redirectUri = `${await siteOrigin()}/api/connect/instagram/callback`;
  const res = NextResponse.redirect(instagramAuthorizeUrl(deps, redirectUri, state), 303);
  res.cookies.set(NONCE_COOKIE, nonce, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/connect', maxAge: OAUTH_STATE_MINUTES * 60 });
  return res;
}
