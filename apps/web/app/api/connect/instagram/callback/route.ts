import { connectInstagram, isServiceError, syncInstagramChannel, verifyState } from '@gencut/services';
import { type NextRequest, NextResponse, after } from 'next/server';
import { connectorDeps, siteOrigin, stateSecret } from '../../../../../lib/connectors.ts';
import { db } from '../../../../../lib/db.ts';
import { currentUser } from '../../../../../lib/session.ts';

const NONCE_COOKIE = 'gc_oauth_nonce';

/** Finish Instagram sign-in. Every check fails closed and sends the creator back to Channels with a reason. */
export async function GET(request: NextRequest) {
  const origin = await siteOrigin();
  const back = (q: string) => {
    const res = NextResponse.redirect(new URL(`/channels?${q}`, origin), 303);
    res.cookies.delete({ name: NONCE_COOKIE, path: '/api/connect' });
    return res;
  };
  const p = request.nextUrl.searchParams;
  if (p.get('error')) return back(p.get('error_reason') === 'user_denied' ? 'error=denied' : 'error=instagram');

  const ctx = await currentUser();
  const secret = stateSecret();
  const deps = connectorDeps();
  if (!ctx) return NextResponse.redirect(new URL('/sign-in?next=/channels', origin), 303);
  if (!secret || !deps) return back('error=not_configured');

  const state = verifyState(secret, p.get('state'));
  const nonce = request.cookies.get(NONCE_COOKIE)?.value;
  if (!state || state.platform !== 'instagram' || !nonce || nonce !== state.nonce || state.userId !== ctx.userId) return back('error=state');

  const code = p.get('code');
  if (!code) return back('error=instagram');
  try {
    const ch = await connectInstagram(db(), ctx, state.workspaceId, code, `${origin}/api/connect/instagram/callback`, deps);
    // First reading right after the redirect, so the dashboard has numbers on the next visit.
    after(() => syncInstagramChannel(db(), ch.id, deps, 'manual').then(() => undefined, () => undefined));
    return back(`connected=instagram&state=${ch.state}`);
  } catch (e) {
    if (isServiceError(e)) return back(`error=refused&message=${encodeURIComponent(e.message.slice(0, 300))}`);
    throw e;
  }
}
