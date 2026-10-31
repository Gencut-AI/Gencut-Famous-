import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  InstagramApiError,
  connectInstagram,
  deleteChannelData,
  deletionRequestStatus,
  disconnectChannel,
  getDashboard,
  listChannels,
  listDisconnected,
  metaDataDeletion,
  metaDeauthorized,
  signState,
  syncInstagramChannel,
  syncWorkspace,
  verifyState,
} from '../src/index.ts';
import { FakeInstagram, type Harness, creator, deps, expectService, harness, user } from './helpers.ts';

describe('Instagram connection', () => {
  let h: Harness;
  before(async () => {
    h = await harness();
  });
  after(() => h.close());

  it('connects, stores the token encrypted, and records the granted scopes', async () => {
    const u = user();
    const ws = await creator(h.sql, u, 'ig.connect');
    const ig = new FakeInstagram();
    const ch = await connectInstagram(h.sql, u, ws, 'AUTH_CODE_1234567890#_', 'https://app/cb', deps(ig));
    assert.equal(ch.state, 'connected');
    assert.equal(ch.username, 'maya.cooks');
    const raw = h.db.query(`SELECT encode(ciphertext, 'escape') FROM channel_credentials WHERE channel_id = '${ch.id}'`);
    assert.doesNotMatch(raw, /LONG-TOKEN/);
    const audit = h.db.query(`SELECT detail FROM audit_events WHERE entity_id = '${ch.id}' AND action = 'connected'`);
    assert.match(audit, /instagram_business_manage_insights/);
    assert.doesNotMatch(audit, /TOKEN/);
  });

  it('is partially connected when insights were not granted, and says what is missing', async () => {
    const u = user();
    const ws = await creator(h.sql, u, 'ig.partial');
    const ig = new FakeInstagram();
    ig.grant = { ...ig.grant, permissions: 'instagram_business_basic' };
    ig.acct = { ...ig.acct, userId: '178414000002' };
    const ch = await connectInstagram(h.sql, u, ws, 'AUTH_CODE_partial_1', 'https://app/cb', deps(ig));
    assert.equal(ch.state, 'partially_connected');
    assert.deepEqual(ch.missingScopes, ['instagram_business_manage_insights']);
  });

  it('refuses personal accounts, accounts already connected elsewhere, and keeps tokens out of errors', async () => {
    const u = user();
    const ws = await creator(h.sql, u, 'ig.refuse');
    const ig = new FakeInstagram();
    ig.acct = { ...ig.acct, accountType: 'PERSONAL', userId: '178414000003' };
    await expectService(connectInstagram(h.sql, u, ws, 'AUTH_CODE_personal_1', 'https://app/cb', deps(ig)), 'invalid');
    assert.equal(h.db.query(`SELECT count(*) FROM creator_channels WHERE workspace_id = '${ws}'`), '0');

    const other = new FakeInstagram(); // same account as the first test, connected to another creator
    await expectService(connectInstagram(h.sql, u, ws, 'AUTH_CODE_dupe_12', 'https://app/cb', deps(other)), 'invalid');

    const broken = new FakeInstagram();
    broken.fail.exchange = new InstagramApiError(400, 100, 'Instagram refused the request: code has expired');
    try {
      await connectInstagram(h.sql, u, ws, 'AUTH_CODE_expired_1', 'https://app/cb', deps(broken));
      assert.fail('should throw');
    } catch (e) {
      assert.doesNotMatch(String((e as Error).message), /TOKEN/);
    }
  });

  it('signs OAuth state, and rejects tampering and expiry', () => {
    const s = { platform: 'instagram' as const, workspaceId: 'w', userId: 'u', nonce: 'n', expiresAt: Date.now() + 60_000 };
    const signed = signState('secret', s);
    assert.deepEqual(verifyState('secret', signed), s);
    assert.equal(verifyState('other', signed), null);
    assert.equal(verifyState('secret', `${signed.slice(0, -2)}xx`), null);
    assert.equal(verifyState('secret', signState('secret', { ...s, expiresAt: Date.now() - 1 })), null);
  });
});

describe('Instagram sync', () => {
  let h: Harness;
  let u: ReturnType<typeof user>;
  let ws: string;
  let ig: FakeInstagram;
  let channelId: string;
  before(async () => {
    h = await harness();
    u = user();
    ws = await creator(h.sql, u, 'ig.sync');
    ig = new FakeInstagram();
    ig.media = [
      { id: 'm1', caption: 'Ten-minute ceviche', mediaType: 'VIDEO', productType: 'REELS', permalink: 'https://www.instagram.com/reel/m1/', timestamp: new Date('2026-10-20T12:00:00Z'), thumbnailUrl: null, likeCount: 900, commentsCount: 40 },
      { id: 'm2', caption: 'Market haul', mediaType: 'CAROUSEL_ALBUM', productType: 'FEED', permalink: 'https://www.instagram.com/p/m2/', timestamp: new Date('2026-10-22T12:00:00Z'), thumbnailUrl: null, likeCount: 300, commentsCount: 12 },
    ];
    ig.mediaInsights.set('m1', { data: [{ name: 'views', values: [{ value: 45000 }] }, { name: 'reach', values: [{ value: 30000 }] }, { name: 'likes', values: [{ value: 910 }] }] });
    channelId = (await connectInstagram(h.sql, u, ws, 'AUTH_CODE_sync_123', 'https://app/cb', deps(ig))).id;
  });
  after(() => h.close());

  it('stores dated readings with source and period; what Instagram omits is unavailable, never zero', async () => {
    const r = await syncInstagramChannel(h.sql, channelId, deps(ig), 'manual');
    assert.equal(r.status, 'ok');
    assert.equal(r.posts, 2);
    const rows = h.db.query(`SELECT metric || ':' || period_kind || ':' || coalesce(value::text, 'null') || ':' || availability FROM creator_metric_snapshots WHERE content_id IS NULL ORDER BY 1`).split('\n');
    assert.ok(rows.includes('followers:instant:12450:available'));
    assert.ok(rows.includes('accounts_engaged:week:null:unavailable'), 'missing insight stored as unavailable');
    assert.ok(rows.includes('reach:day:8000:available'));
    assert.ok(!rows.some((x) => x.includes(':0:available')));
    assert.equal(h.db.query("SELECT DISTINCT api_version FROM creator_metric_snapshots"), 'v26.0');
  });

  it('a carousel shows its public counts and says views are not offered; a reel shows its insights', async () => {
    const d = await getDashboard(h.sql, u, ws, new Date('2026-10-31T15:00:00Z'));
    const reel = d.topContent.find((c) => c.caption === 'Ten-minute ceviche');
    assert.equal(reel?.rankedBy, 'views');
    assert.equal(reel?.figures.find((f) => f.metric === 'views')?.value, 45000);
    const carousel = (await import('../src/index.ts')).listContent;
    const all = await carousel(h.sql, u, ws);
    const haul = all.find((c) => c.caption === 'Market haul');
    assert.equal(haul?.figures.find((f) => f.metric === 'views')?.availability, 'not_supported');
    assert.equal(haul?.figures.find((f) => f.metric === 'likes')?.value, 300);
  });

  it('a re-sync the same day updates readings instead of duplicating them', async () => {
    const before = h.db.query('SELECT count(*) FROM creator_metric_snapshots');
    ig.acct = { ...ig.acct, followers: 12500 };
    await syncInstagramChannel(h.sql, channelId, deps(ig), 'manual');
    assert.equal(h.db.query('SELECT count(*) FROM creator_metric_snapshots'), before);
    assert.equal(h.db.query("SELECT value FROM creator_metric_snapshots WHERE metric = 'followers'"), '12500');
  });

  it('shows growth only once there is history, from real readings', async () => {
    const d0 = await getDashboard(h.sql, u, ws, new Date('2026-10-31T15:00:00Z'));
    assert.equal(d0.channels[0]?.growth7, null);
    h.db.query(`INSERT INTO creator_metric_snapshots (workspace_id, channel_id, metric, period_kind, as_of, value, availability, retrieved_at, source_endpoint, api_version)
      VALUES ('${ws}', '${channelId}', 'followers', 'instant', '2026-10-24', 12000, 'available', '2026-10-24T09:00:00Z', '/me followers_count', 'v26.0')`);
    const d1 = await getDashboard(h.sql, u, ws, new Date('2026-10-31T15:00:00Z'));
    assert.equal(d1.channels[0]?.growth7?.change, 500);
    assert.equal(d1.combinedFollowers?.value, 12500);
    assert.match(d1.combinedFollowers?.label ?? '', /Platform-reported total/);
  });

  it('refreshes week-old tokens, and marks the channel in error when Instagram refuses the token', async () => {
    const later = new Date('2026-11-09T15:00:00Z');
    await syncInstagramChannel(h.sql, channelId, deps(ig, later), 'daily');
    assert.ok(ig.calls.includes('refresh'));
    assert.ok(ig.tokensSeen.includes('REFRESHED-TOKEN'), 'later calls use the refreshed token');

    ig.fail.account = new InstagramApiError(400, 190, 'Instagram refused the request: Error validating access token');
    const r = await syncInstagramChannel(h.sql, channelId, deps(ig, later), 'manual');
    assert.equal(r.status, 'failed', 'a refused token reads nothing, so nothing else is attempted');
    assert.ok(!ig.calls.slice(-2).includes('media'));
    const [ch] = await listChannels(h.sql, u, ws, later);
    assert.equal(ch?.state, 'error');
    ig.fail = {};
  });

  it('on-demand sync waits 15 minutes between reads unless forced', async () => {
    const results = await syncWorkspace(h.sql, u, ws, deps(ig));
    assert.equal(results.length, 0);
  });

  it('disconnect deletes the token at once; only the owner can delete the data', async () => {
    const stranger = user();
    await expectService(disconnectChannel(h.sql, stranger, ws, channelId), 'forbidden');
    await disconnectChannel(h.sql, u, ws, channelId);
    assert.equal(h.db.query(`SELECT count(*) FROM channel_credentials WHERE channel_id = '${channelId}'`), '0');
    assert.deepEqual((await listChannels(h.sql, u, ws)).length, 0);
    assert.equal((await listDisconnected(h.sql, u, ws)).length, 1);
    assert.ok(Number(h.db.query(`SELECT count(*) FROM creator_metric_snapshots WHERE channel_id = '${channelId}'`)) > 0, 'history kept until deleted');
    await deleteChannelData(h.sql, u, ws, channelId);
    assert.equal(h.db.query(`SELECT count(*) FROM creator_metric_snapshots WHERE channel_id = '${channelId}'`), '0');
    assert.equal(h.db.query(`SELECT count(*) FROM creator_content WHERE channel_id = '${channelId}'`), '0');
  });
});

describe("Meta's deauthorize and data-deletion callbacks", () => {
  let h: Harness;
  before(async () => {
    h = await harness();
  });
  after(() => h.close());

  it('deauthorize disconnects; deletion erases and returns a code that can be looked up', async () => {
    const u = user();
    const ws = await creator(h.sql, u, 'meta.cb');
    const ig = new FakeInstagram();
    ig.acct = { ...ig.acct, userId: '178414000099' };
    await connectInstagram(h.sql, u, ws, 'AUTH_CODE_meta_123', 'https://app/cb', deps(ig));
    assert.equal(await metaDeauthorized(h.sql, '178414000099'), 1);
    assert.equal((await listChannels(h.sql, u, ws)).length, 0);
    const res = await metaDataDeletion(h.sql, '178414000099');
    assert.equal(res.channelsDeleted, 1);
    assert.equal((await deletionRequestStatus(h.sql, res.confirmationCode))?.channelsDeleted, 1);
    assert.equal(await deletionRequestStatus(h.sql, 'nope-nope-nope'), null);
  });
});

describe('Meta signed requests', () => {
  it('accepts only a correctly signed HMAC-SHA256 payload', async () => {
    const { createHmac } = await import('node:crypto');
    const { parseSignedRequest } = await import('../src/index.ts');
    const payload = Buffer.from(JSON.stringify({ algorithm: 'HMAC-SHA256', user_id: '178414000099', issued_at: 1 })).toString('base64url');
    const sig = createHmac('sha256', 'app-secret').update(payload).digest('base64url');
    assert.deepEqual(parseSignedRequest(`${sig}.${payload}`, 'app-secret'), { userId: '178414000099' });
    assert.equal(parseSignedRequest(`${sig}.${payload}`, 'other-secret'), null);
    assert.equal(parseSignedRequest(`${sig}x.${payload}`, 'app-secret'), null);
    assert.equal(parseSignedRequest(null, 'app-secret'), null);
  });
});
