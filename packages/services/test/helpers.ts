import { randomBytes } from 'node:crypto';
import { migrateUp } from '../../db/src/migrate.ts';
import { type TestDb, createTestDb } from '../../db/test/helpers.ts';
import {
  type ConnectorDeps,
  type IgAccount,
  type IgLongToken,
  type IgMedia,
  type IgTokenGrant,
  type InstagramApi,
  InstagramApiError,
  type RequestContext,
  type Sql,
  TokenCipher,
  createCreator,
  createDb,
} from '../src/index.ts';

export interface Harness {
  readonly sql: Sql;
  readonly db: TestDb;
  close(): Promise<void>;
}

export async function harness(): Promise<Harness> {
  const db = createTestDb();
  migrateUp(db.url);
  const sql = createDb(db.url, { max: 4 });
  return {
    sql,
    db,
    async close() {
      await sql.end({ timeout: 2 });
      db.drop();
    },
  };
}

let n = 0;
export function user(email?: string): RequestContext {
  n += 1;
  const hex = randomBytes(16).toString('hex');
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  return { userId: id, email: email ?? `user${n}-${hex.slice(0, 4)}@example.com`, via: 'web' };
}

export async function creator(sql: Sql, ctx: RequestContext, handle: string): Promise<string> {
  return createCreator(sql, ctx, { publicName: handle[0]?.toUpperCase() + handle.slice(1), handle, adult: true });
}

export const cipher = new TokenCipher([{ id: 'test', key: Buffer.alloc(32, 7) }]);

/** A scripted Instagram: tests set what it returns and see what it was asked. */
export class FakeInstagram implements InstagramApi {
  grant: IgTokenGrant = { accessToken: 'SHORT-TOKEN-abc', userId: '17841400000000001', permissions: 'instagram_business_basic,instagram_business_manage_insights' };
  long: IgLongToken = { accessToken: 'LONG-TOKEN-secret-123', expiresInSeconds: 5_184_000 };
  acct: IgAccount = { userId: '17841400000000001', username: 'maya.cooks', name: 'Maya', accountType: 'MEDIA_CREATOR', profilePictureUrl: null, followers: 12450, follows: 310, mediaCount: 214 };
  media: IgMedia[] = [];
  accountInsights: unknown = { data: [{ name: 'reach', total_value: { value: 8000 } }, { name: 'views', total_value: { value: 21000 } }, { name: 'total_interactions', total_value: { value: 1900 } }] };
  mediaInsights = new Map<string, unknown>();
  fail: Partial<Record<'exchange' | 'account' | 'insights' | 'media' | 'refresh', InstagramApiError>> = {};
  calls: string[] = [];
  tokensSeen: string[] = [];

  authorizeUrl(redirectUri: string, state: string, scopes: readonly string[]): string {
    return `https://www.instagram.com/oauth/authorize?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${scopes.join(',')}`;
  }
  async exchangeCode(): Promise<IgTokenGrant> {
    this.calls.push('exchange');
    if (this.fail.exchange) throw this.fail.exchange;
    return this.grant;
  }
  async longLived(): Promise<IgLongToken> {
    this.calls.push('long');
    return this.long;
  }
  async refresh(token: string): Promise<IgLongToken> {
    this.calls.push('refresh');
    this.tokensSeen.push(token);
    if (this.fail.refresh) throw this.fail.refresh;
    return { accessToken: 'REFRESHED-TOKEN', expiresInSeconds: 5_184_000 };
  }
  async account(token: string): Promise<IgAccount> {
    this.calls.push('account');
    this.tokensSeen.push(token);
    if (this.fail.account) throw this.fail.account;
    return this.acct;
  }
  async recentMedia(): Promise<IgMedia[]> {
    this.calls.push('media');
    if (this.fail.media) throw this.fail.media;
    return this.media;
  }
  async insights(_token: string, objectId: string): Promise<unknown> {
    this.calls.push(`insights:${objectId}`);
    if (this.fail.insights) throw this.fail.insights;
    if (objectId === this.acct.userId) return this.accountInsights;
    const m = this.mediaInsights.get(objectId);
    if (m instanceof Error) throw m;
    return m ?? { data: [] };
  }
}

export function deps(ig: FakeInstagram, now = new Date('2026-10-31T15:00:00Z')): ConnectorDeps {
  return { instagram: ig, cipher, now: () => now };
}

export async function expectService(p: Promise<unknown>, code: string, field?: string): Promise<Record<string, string>> {
  try {
    await p;
  } catch (e) {
    const err = e as { code?: string; fields?: Record<string, string> };
    if (err.code !== code) throw e;
    if (field && !err.fields?.[field]) throw new Error(`expected a message on field ${field}, got ${JSON.stringify(err.fields)}`);
    return err.fields ?? {};
  }
  throw new Error(`expected ServiceError ${code}`);
}
