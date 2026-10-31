/**
 * Instagram API with Instagram Login, over fetch. Tokens travel only in
 * request headers or the token endpoints' bodies, and are removed from every
 * error message before it can reach a log, the database or a page.
 */
export const INSTAGRAM_API_VERSION = 'v26.0';
const GRAPH = `https://graph.instagram.com/${INSTAGRAM_API_VERSION}`;

export class InstagramApiError extends Error {
  readonly status: number;
  readonly code: number | null;
  constructor(status: number, code: number | null, message: string) {
    super(message);
    this.name = 'InstagramApiError';
    this.status = status;
    this.code = code;
  }
  /** The token is invalid, expired or lacks permission: only the creator can fix it. */
  get isAuth(): boolean {
    return this.code === 190 || this.code === 102 || this.code === 10 || this.code === 200 || this.status === 401;
  }
  get isRateLimit(): boolean {
    return this.code === 4 || this.code === 17 || this.code === 32 || this.code === 613 || this.status === 429;
  }
}

export interface IgTokenGrant {
  readonly accessToken: string;
  readonly userId: string;
  readonly permissions: unknown;
}
export interface IgLongToken {
  readonly accessToken: string;
  readonly expiresInSeconds: number;
}
export interface IgAccount {
  readonly userId: string;
  readonly username: string;
  readonly name: string | null;
  readonly accountType: string | null;
  readonly profilePictureUrl: string | null;
  readonly followers: number | null;
  readonly follows: number | null;
  readonly mediaCount: number | null;
}
export interface IgMedia {
  readonly id: string;
  readonly caption: string | null;
  readonly mediaType: string | null;
  readonly productType: string | null;
  readonly permalink: string | null;
  readonly timestamp: Date | null;
  readonly thumbnailUrl: string | null;
  readonly likeCount: number | null;
  readonly commentsCount: number | null;
}

/** Everything the services need from Instagram; tests supply a fake. */
export interface InstagramApi {
  authorizeUrl(redirectUri: string, state: string, scopes: readonly string[]): string;
  exchangeCode(code: string, redirectUri: string): Promise<IgTokenGrant>;
  longLived(shortToken: string): Promise<IgLongToken>;
  refresh(token: string): Promise<IgLongToken>;
  account(token: string): Promise<IgAccount>;
  recentMedia(token: string, userId: string, limit: number): Promise<IgMedia[]>;
  /** Raw insights body for an account (`metric_type=total_value`) or a post. */
  insights(token: string, objectId: string, params: Readonly<Record<string, string>>): Promise<unknown>;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

export class GraphInstagramApi implements InstagramApi {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly fetchFn: typeof fetch;

  constructor(appId: string, appSecret: string, fetchFn: typeof fetch = fetch) {
    this.appId = appId;
    this.appSecret = appSecret;
    this.fetchFn = fetchFn;
  }

  authorizeUrl(redirectUri: string, state: string, scopes: readonly string[]): string {
    const q = new URLSearchParams({ client_id: this.appId, redirect_uri: redirectUri, response_type: 'code', scope: scopes.join(','), state, enable_fb_login: 'false' });
    return `https://www.instagram.com/oauth/authorize?${q.toString()}`;
  }

  private async call(url: string, init: RequestInit, secrets: readonly string[]): Promise<Record<string, unknown>> {
    const res = await this.fetchFn(url, { ...init, signal: AbortSignal.timeout(15_000) });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const e = body?.error as { message?: string; code?: number } | undefined;
    if (!res.ok || !body || e || body.error_message) {
      let why = String(e?.message ?? body?.error_message ?? `HTTP ${res.status}`);
      for (const s of [...secrets, this.appSecret]) if (s) why = why.replaceAll(s, '[redacted]');
      throw new InstagramApiError(res.status, typeof e?.code === 'number' ? e.code : num(body?.code), `Instagram refused the request: ${why.slice(0, 240)}`);
    }
    return body;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<IgTokenGrant> {
    const form = new URLSearchParams({ client_id: this.appId, client_secret: this.appSecret, grant_type: 'authorization_code', redirect_uri: redirectUri, code: code.replace(/#_$/, '') });
    const b = await this.call('https://api.instagram.com/oauth/access_token', { method: 'POST', body: form }, [code]);
    // Documented as { data: [{ access_token, user_id, permissions }] }; older responses were flat.
    const first = (Array.isArray(b.data) ? b.data[0] : b) as Record<string, unknown> | undefined;
    const accessToken = str(first?.access_token);
    const userId = first?.user_id !== undefined ? String(first.user_id) : null;
    if (!accessToken || !userId) throw new InstagramApiError(502, null, 'Instagram returned no token.');
    return { accessToken, userId, permissions: first?.permissions };
  }

  async longLived(shortToken: string): Promise<IgLongToken> {
    const q = new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: this.appSecret, access_token: shortToken });
    const b = await this.call(`https://graph.instagram.com/access_token?${q.toString()}`, { method: 'GET' }, [shortToken]);
    const accessToken = str(b.access_token);
    if (!accessToken) throw new InstagramApiError(502, null, 'Instagram returned no long-lived token.');
    return { accessToken, expiresInSeconds: num(b.expires_in) ?? 0 };
  }

  async refresh(token: string): Promise<IgLongToken> {
    const q = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token });
    const b = await this.call(`https://graph.instagram.com/refresh_access_token?${q.toString()}`, { method: 'GET' }, [token]);
    const accessToken = str(b.access_token);
    if (!accessToken) throw new InstagramApiError(502, null, 'Instagram returned no refreshed token.');
    return { accessToken, expiresInSeconds: num(b.expires_in) ?? 0 };
  }

  private get(token: string, path: string): Promise<Record<string, unknown>> {
    return this.call(`${GRAPH}${path}`, { method: 'GET', headers: { authorization: `Bearer ${token}` } }, [token]);
  }

  async account(token: string): Promise<IgAccount> {
    const b = await this.get(token, '/me?fields=user_id,username,name,account_type,profile_picture_url,followers_count,follows_count,media_count');
    const userId = str(b.user_id) ?? (b.id !== undefined ? String(b.id) : null);
    const username = str(b.username);
    if (!userId || !username) throw new InstagramApiError(502, null, 'Instagram did not return the account.');
    return {
      userId, username, name: str(b.name), accountType: str(b.account_type), profilePictureUrl: str(b.profile_picture_url),
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
