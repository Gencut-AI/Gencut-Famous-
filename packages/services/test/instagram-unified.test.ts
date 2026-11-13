import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { InstagramApiError, UnifiedInstagramApi, parseTokenFacts } from '../src/index.ts';

const APP = '1234567890';
const SECRET = 'app-secret-xyz';
const CONFIG = '987654321';

/** A scripted graph.facebook.com: routes by path, records every call. */
function meta(routes: Record<string, (u: URL, init: RequestInit) => unknown>) {
  const calls: Array<{ url: URL; init: RequestInit }> = [];
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url, init: init ?? {} });
    const key = Object.keys(routes).find((k) => url.pathname.endsWith(k));
    if (!key) return new Response(JSON.stringify({ error: { message: `no route ${url.pathname}`, code: 100 } }), { status: 400 });
    const out = routes[key]?.(url, init ?? {});
    const status = (out as { __status?: number })?.__status ?? 200;
    return new Response(JSON.stringify(out), { status });
  }) as typeof fetch;
  return { fetchFn, calls };
}

const debug = (over: Record<string, unknown> = {}) => ({
  data: { app_id: APP, type: 'SYSTEM_USER', is_valid: true, expires_at: 0, scopes: ['instagram_basic', 'instagram_manage_insights', 'public_profile'],
    granular_scopes: [{ scope: 'instagram_basic', target_ids: ['17841400000000009'] }, { scope: 'instagram_manage_insights', target_ids: ['17841400000000009'] }], ...over },
});

describe('Instagram API with Unified Login', () => {
  it('sends the creator to Meta\'s dialog with the login configuration and no scope list', () => {
    const api = new UnifiedInstagramApi(APP, SECRET, CONFIG);
    const u = new URL(api.authorizeUrl('https://gencutfamous.netlify.app/api/connect/instagram/callback', 'signed-state', ['ignored']));
    assert.equal(`${u.origin}${u.pathname}`, 'https://www.facebook.com/dialog/oauth');
    // Parameter for parameter what Meta's dashboard generated for GenCut's configuration (13 Nov 2026).
    const dashboard = new URL('https://www.facebook.com/dialog/oauth?client_id=1234567890&config_id=987654321&display=popup&override_default_response_type=true&redirect_uri=https%3A%2F%2Fgencutfamous.netlify.app%2Fapi%2Fconnect%2Finstagram%2Fcallback&response_type=code&state=signed-state&prompt=login');
    assert.deepEqual([...u.searchParams.entries()].sort(), [...dashboard.searchParams.entries()].sort());
    assert.equal(u.searchParams.get('client_id'), APP);
    assert.equal(u.searchParams.get('config_id'), CONFIG);
    assert.equal(u.searchParams.get('response_type'), 'code');
    assert.equal(u.searchParams.get('override_default_response_type'), 'true');
    assert.equal(u.searchParams.get('state'), 'signed-state');
    assert.equal(u.searchParams.get('scope'), null);
    assert.ok(!u.toString().includes(SECRET));
  });

  it('exchanges the code, finds the chosen Instagram account, and keeps a business token that does not expire', async () => {
    const m = meta({
      '/oauth/access_token': () => ({ access_token: 'EAA-business-token', token_type: 'bearer' }),
      '/debug_token': () => debug(),
      '/17841400000000009': () => ({ id: '17841400000000009', username: 'christian.esd', name: 'Christian', followers_count: 5321, follows_count: 210, media_count: 88 }),
    });
    const api = new UnifiedInstagramApi(APP, SECRET, CONFIG, m.fetchFn);
    const grant = await api.exchangeCode('AQBcode123456#_', 'https://site/cb');
    assert.deepEqual(grant, { accessToken: 'EAA-business-token', userId: '17841400000000009', permissions: ['instagram_basic', 'instagram_manage_insights', 'public_profile'] });
    assert.equal(m.calls[0]?.url.searchParams.get('code'), 'AQBcode123456', 'trailing #_ removed');
    assert.deepEqual(await api.longLived(grant.accessToken), { accessToken: 'EAA-business-token', expiresInSeconds: 0 });
    const a = await api.account(grant.accessToken);
    assert.deepEqual(a, { userId: '17841400000000009', username: 'christian.esd', name: 'Christian', accountType: null, profilePictureUrl: null, followers: 5321, follows: 210, mediaCount: 88 });
    const profile = m.calls.find((c) => c.url.pathname.endsWith('/17841400000000009'));
    assert.equal((profile?.init.headers as Record<string, string>).authorization, 'Bearer EAA-business-token');
    assert.equal(profile?.url.searchParams.get('appsecret_proof'), createHmac('sha256', SECRET).update('EAA-business-token').digest('hex'));
    assert.ok(!profile?.url.toString().includes('EAA-business-token'), 'token never in the URL of a data call');
  });

  it('turns a short user token into a 60-day one', async () => {
    const m = meta({
      '/oauth/access_token': (u) => (u.searchParams.get('grant_type') === 'fb_exchange_token' ? { access_token: 'EAA-long', expires_in: 5_184_000 } : { access_token: 'EAA-short' }),
      '/debug_token': () => debug({ type: 'USER', expires_at: 2_000_000_000 }),
    });
    const api = new UnifiedInstagramApi(APP, SECRET, CONFIG, m.fetchFn);
    assert.deepEqual(await api.longLived('EAA-short'), { accessToken: 'EAA-long', expiresInSeconds: 5_184_000 });
  });

  it('says so when no Instagram account was chosen, and keeps tokens and the secret out of errors', async () => {
    const m = meta({
      '/debug_token': () => debug({ granular_scopes: [] }),
      '/me/accounts': () => ({ data: [] }),
      '/media': () => ({ __status: 400, error: { message: `Invalid OAuth access token EAA-secret-token with ${SECRET}`, code: 190 } }),
    });
    const api = new UnifiedInstagramApi(APP, SECRET, CONFIG, m.fetchFn);
    await assert.rejects(api.account('EAA-secret-token'), /no Instagram professional account was chosen/);
    const err = await api.recentMedia('EAA-secret-token', '1784', 5).catch((e: unknown) => e);
    assert.ok(err instanceof InstagramApiError && err.isAuth);
    assert.ok(!String((err as Error).message).includes('EAA-secret-token') && !String((err as Error).message).includes(SECRET));
  });

  it('reads debug_token defensively', () => {
    assert.deepEqual(parseTokenFacts({}), { scopes: [], instagramIds: [], expiresAt: null, type: null });
    assert.deepEqual(parseTokenFacts({ data: { scopes: ['instagram_basic'], granular_scopes: [{ scope: 'pages_show_list', target_ids: ['1'] }, { scope: 'instagram_basic', target_ids: [178, '179'] }], expires_at: 1900000000, type: 'USER' } }),
      { scopes: ['instagram_basic'], instagramIds: ['178', '179'], expiresAt: 1900000000, type: 'USER' });
  });
});
