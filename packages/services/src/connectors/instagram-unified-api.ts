/**
 * Instagram API with Unified Login (graph.facebook.com), which Meta offers to
 * new apps in place of Instagram Login. The creator signs in with Instagram or
 * Facebook in Meta's dialog, chooses the Instagram professional account, and
 * GenCut receives a code. Which permissions are asked for is set by the login
 * configuration in Meta's dashboard (config_id), not by a scope list here.
 *
 * Meta has not documented every response shape of this setup yet, so the
 * client relies on long-standing Graph API calls: the code exchange, and
 * debug_token, whose granular_scopes name the Instagram account the creator
 * chose. Tokens travel only in headers or the token endpoints, and are removed
 * from every error message.
 */
import { createHmac } from 'node:crypto';
import { type IgAccount, type IgLongToken, type IgMedia, type IgTokenGrant, type InstagramApi, InstagramApiError } from './instagram-api.ts';

export const META_GRAPH_VERSION = 'v26.0';
const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/** The parts of debug_token's answer GenCut uses. */
export interface TokenFacts {
  readonly scopes: string[];
  /** Instagram professional account ids the token may read, from granular_scopes. */
  readonly instagramIds: string[];
  /** Seconds since the epoch; null when the token does not expire (system-user tokens). */
  readonly expiresAt: number | null;
  readonly type: string | null;
}

/** Read debug_token's `data`. Exported for tests. */
export function parseTokenFacts(body: unknown): TokenFacts {
  const d = ((body as { data?: unknown })?.data ?? {}) as Record<string, unknown>;
  const scopes = Array.isArray(d.scopes) ? d.scopes.map(String) : [];
  const ids = new Set<string>();
  const granular = Array.isArray(d.granular_scopes) ? (d.granular_scopes as Array<Record<string, unknown>>) : [];
  for (const g of granular) {
    if (typeof g.scope !== 'string' || !g.scope.startsWith('instagram_')) continue;
    for (const id of Array.isArray(g.target_ids) ? g.target_ids : []) ids.add(String(id));
  }
  const exp = num(d.expires_at) ?? num(d.data_access_expires_at);
  return { scopes, instagramIds: [...ids], expiresAt: exp && exp > 0 ? exp : null, type: str(d.type) };
}

export class UnifiedInstagramApi implements InstagramApi {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly configId: string;
  private readonly fetchFn: typeof fetch;
  private readonly now: () => Date;
  private readonly ids = new Map<string, string>();

  constructor(appId: string, appSecret: string, configId: string, fetchFn: typeof fetch = fetch, now: () => Date = () => new Date()) {
    this.appId = appId;
    this.appSecret = appSecret;
    this.configId = configId;
    this.fetchFn = fetchFn;
    this.now = now;
  }

  /**
   * Meta's dialog with the login configuration; permissions come from the
   * configuration. Same parameters as the Login URL Meta's dashboard generates
   * for GenCut's configuration (13 Nov 2026): prompt=login lets the creator
   * choose Instagram or Facebook sign-in.
   */
  authorizeUrl(redirectUri: string, state: string, _scopes: readonly string[]): string {
    const q = new URLSearchParams({
      client_id: this.appId, config_id: this.configId, display: 'popup', override_default_response_type: 'true',
      redirect_uri: redirectUri, response_type: 'code', state, prompt: 'login',
    });
    return `https://www.facebook.com/dialog/oauth?${q.toString()}`;
  }

  private async call(url: string, init: RequestInit, secrets: readonly string[]): Promise<Record<string, unknown>> {
    const res = await this.fetchFn(url, { ...init, signal: AbortSignal.timeout(15_000) });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const e = body?.error as { message?: string; code?: number; error_user_msg?: string } | undefined;
    if (!res.ok || !body || e) {
      let why = String(e?.error_user_msg ?? e?.message ?? `HTTP ${res.status}`);
      for (const s of [...secrets, this.appSecret]) if (s) why = why.replaceAll(s, '[redacted]');
      throw new InstagramApiError(res.status, typeof e?.code === 'number' ? e.code : null, `Instagram refused the request: ${why.slice(0, 240)}`);
    }
    return body;
  }

  private proof(token: string): string {
    return createHmac('sha256', this.appSecret).update(token).digest('hex');
  }

  private get(token: string, path: string): Promise<Record<string, unknown>> {
    const sep = path.includes('?') ? '&' : '?';
    return this.call(`${GRAPH}${path}${sep}appsecret_proof=${this.proof(token)}`, { method: 'GET', headers: { authorization: `Bearer ${token}` } }, [token]);
  }

  /** What Meta says about a token: scopes, the Instagram account(s) it covers, expiry. */
  async tokenFacts(token: string): Promise<TokenFacts> {
    const q = new URLSearchParams({ input_token: token, access_token: `${this.appId}|${this.appSecret}` });
    return parseTokenFacts(await this.call(`${GRAPH}/debug_token?${q.toString()}`, { method: 'GET' }, [token]));
  }

  private async instagramId(token: string): Promise<string> {
    const known = this.ids.get(token);
    if (known) return known;
    const facts = await this.tokenFacts(token);
    let id = facts.instagramIds[0] ?? null;
    if (!id) {
      // A token from a configuration with Pages: the Instagram account linked to the first Page.
      const b = await this.get(token, '/me/accounts?fields=instagram_business_account&limit=25').catch(() => null);
      const pages = Array.isArray(b?.data) ? (b.data as Array<{ instagram_business_account?: { id?: unknown } }>) : [];
      const linked = pages.find((p) => p.instagram_business_account?.id !== undefined);
      id = linked ? String(linked.instagram_business_account?.id) : null;
    }
    if (!id) throw new InstagramApiError(400, null, 'Instagram refused the request: no Instagram professional account was chosen in Meta\'s sign-in');
    this.ids.set(token, id);
    return id;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<IgTokenGrant> {
    const q = new URLSearchParams({ client_id: this.appId, client_secret: this.appSecret, redirect_uri: redirectUri, code: code.replace(/#_$/, '') });
    const b = await this.call(`${GRAPH}/oauth/access_token?${q.toString()}`, { method: 'GET' }, [code]);
    const accessToken = str(b.access_token);
    if (!accessToken) throw new InstagramApiError(502, null, 'Instagram returned no token.');
    const facts = await this.tokenFacts(accessToken);
    const userId = await this.instagramId(accessToken);
    return { accessToken, userId, permissions: facts.scopes };
  }

  /** System-user tokens do not expire and are kept as they are; a user token is exchanged for a 60-day one. */
  async longLived(token: string): Promise<IgLongToken> {
    const facts = await this.tokenFacts(token);
    if (facts.expiresAt === null) return { accessToken: token, expiresInSeconds: 0 };
    const q = new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: this.appId, client_secret: this.appSecret, fb_exchange_token: token });
    const b = await this.call(`${GRAPH}/oauth/access_token?${q.toString()}`, { method: 'GET' }, [token]);
    const accessToken = str(b.access_token);
    if (!accessToken) throw new InstagramApiError(502, null, 'Instagram returned no long-lived token.');
    const id = this.ids.get(token);
    if (id) this.ids.set(accessToken, id);
    const expiresIn = num(b.expires_in) ?? Math.max(0, facts.expiresAt - Math.floor(this.now().getTime() / 1000));
    return { accessToken, expiresInSeconds: expiresIn };
  }

  refresh(token: string): Promise<IgLongToken> {
    return this.longLived(token);
  }

  async account(token: string): Promise<IgAccount> {
    const id = await this.instagramId(token);
    const b = await this.get(token, `/${encodeURIComponent(id)}?fields=id,username,name,profile_picture_url,followers_count,follows_count,media_count`);
    const username = str(b.username);
    if (!username) throw new InstagramApiError(502, null, 'Instagram did not return the account.');
    return {
      // Only professional accounts can be chosen in this sign-in; the Graph API does not return the type.
      userId: id, username, name: str(b.name), accountType: null, profilePictureUrl: str(b.profile_picture_url),
      followers: num(b.followers_count), follows: num(b.follows_count), mediaCount: num(b.media_count),
    };
  }

  async recentMedia(token: string, userId: string, limit: number): Promise<IgMedia[]> {
    const fields = 'id,caption,media_type,media_product_type,permalink,timestamp,thumbnail_url,like_count,comments_count';
    const b = await this.get(token, `/${encodeURIComponent(userId)}/media?fields=${fields}&limit=${Math.min(limit, 50)}`);
    const data = Array.isArray(b.data) ? (b.data as Record<string, unknown>[]) : [];
    return data.map((m) => {
      const ts = str(m.timestamp);
      const at = ts ? new Date(ts) : null;
      return {
        id: String(m.id), caption: str(m.caption), mediaType: str(m.media_type), productType: str(m.media_product_type),
        permalink: str(m.permalink), timestamp: at && !Number.isNaN(at.getTime()) ? at : null, thumbnailUrl: str(m.thumbnail_url),
        likeCount: num(m.like_count), commentsCount: num(m.comments_count),
      };
    });
  }

  insights(token: string, objectId: string, params: Readonly<Record<string, string>>): Promise<unknown> {
    return this.get(token, `/${encodeURIComponent(objectId)}/insights?${new URLSearchParams(params).toString()}`);
  }
}
