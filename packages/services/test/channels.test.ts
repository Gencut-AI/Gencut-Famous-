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
  fetchInstagramPhoto,
  isInstagramPhotoUrl,
  listMedia,
  syncAllDue,
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

  it('saves a whole sync in one pass, and post insights arrive in post order', async () => {
    const many = new FakeInstagram();
    many.acct = { ...many.acct, userId: '17841400000000077', username: 'many.posts' };
    many.grant = { ...many.grant, userId: '17841400000000077' };
    many.media = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, caption: `Post ${i}`, mediaType: 'VIDEO', productType: 'REELS', permalink: `https://www.instagram.com/reel/p${i}/`, timestamp: new Date(Date.UTC(2026, 9, 1 + i)), thumbnailUrl: null, likeCount: i, commentsCount: 0 }));
    for (let i = 0; i < 12; i++) many.mediaInsights.set(`p${i}`, { data: [{ name: 'views', values: [{ value: 1000 + i }] }] });
    const u2 = user();
    const ws2 = await creator(h.sql, u2, 'ig.many');
    const id = (await connectInstagram(h.sql, u2, ws2, 'AUTH_CODE_many', 'https://app/cb', deps(many))).id;
    const r = await syncInstagramChannel(h.sql, id, deps(many), 'manual');
    assert.equal(r.status, 'ok');
    assert.equal(r.posts, 12);
    const views = await h.sql<{ external_id: string; value: string }[]>`
      SELECT c.external_id, s.value FROM creator_metric_snapshots s JOIN creator_content c ON c.id = s.content_id
      WHERE s.channel_id = ${id} AND s.metric = 'views' ORDER BY c.external_id`;
    assert.equal(views.length, 12, 'one views reading per post');
    for (const v of views) assert.equal(Number(v.value), 1000 + Number(v.external_id.slice(1)), 'each post keeps its own number');
  });

  it('the first read takes the Instagram picture as the kit photo only when there is none, and only from Instagram hosts', async () => {
    const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const pic = new FakeInstagram();
    pic.acct = { ...pic.acct, userId: '17841400000000088', username: 'has.pic', profilePictureUrl: 'https://scontent.cdninstagram.com/v/pic.jpg' };
    pic.grant = { ...pic.grant, userId: '17841400000000088' };
    const u3 = user();
    const ws3 = await creator(h.sql, u3, 'ig.pic');
    const id = (await connectInstagram(h.sql, u3, ws3, 'AUTH_CODE_pic', 'https://app/cb', deps(pic))).id;
    const asked: string[] = [];
    const withPhoto = { ...deps(pic), fetchPhoto: async (url: string) => { asked.push(url); return PNG; } };
    await syncInstagramChannel(h.sql, id, withPhoto, 'manual');
    const media = await listMedia(h.sql, u3, ws3);
    assert.equal(media.filter((m) => m.kind === 'profile_photo').length, 1);
    assert.deepEqual(asked, ['https://scontent.cdninstagram.com/v/pic.jpg']);
    await syncInstagramChannel(h.sql, id, withPhoto, 'manual');
    assert.equal(asked.length, 1, 'only on the first read');

    // Not an image: nothing stored.
    const u4 = user();
    const ws4 = await creator(h.sql, u4, 'ig.nopic');
    const bad = new FakeInstagram();
    bad.acct = { ...bad.acct, userId: '17841400000000099', username: 'bad.pic', profilePictureUrl: 'https://scontent.cdninstagram.com/v/x.jpg' };
    bad.grant = { ...bad.grant, userId: '17841400000000099' };
    const id4 = (await connectInstagram(h.sql, u4, ws4, 'AUTH_CODE_bad', 'https://app/cb', deps(bad))).id;
    await syncInstagramChannel(h.sql, id4, { ...deps(bad), fetchPhoto: async () => new TextEncoder().encode('<svg onload=alert(1)>') }, 'manual');
    assert.equal((await listMedia(h.sql, u4, ws4)).length, 0);
  });

  it('downloads profile pictures only from Instagram CDN hosts over https', async () => {
    assert.equal(isInstagramPhotoUrl('https://scontent-mia3-1.cdninstagram.com/v/t51/pic.jpg'), true);
    assert.equal(isInstagramPhotoUrl('https://scontent.xx.fbcdn.net/v/pic.jpg'), true);
    assert.equal(isInstagramPhotoUrl('http://scontent.cdninstagram.com/pic.jpg'), false);
    assert.equal(isInstagramPhotoUrl('https://cdninstagram.com.evil.example/pic.jpg'), false);
    assert.equal(isInstagramPhotoUrl('https://169.254.169.254/latest'), false);
    assert.equal(isInstagramPhotoUrl(null), false);
    let called = false;
    const fake = (async () => { called = true; return new Response('x'); }) as typeof fetch;
    assert.equal(await fetchInstagramPhoto('https://evil.example/pic.jpg', fake), null);
    assert.equal(called, false, 'refused before any request');
    const big = (async () => new Response('x', { headers: { 'content-length': String(6 * 1024 * 1024) } })) as typeof fetch;
    assert.equal(await fetchInstagramPhoto('https://scontent.cdninstagram.com/p.jpg', big), null);
    const ok = (async () => new Response(new Uint8Array([1, 2, 3]))) as typeof fetch;
    assert.deepEqual(await fetchInstagramPhoto('https://scontent.cdninstagram.com/p.jpg', ok), new Uint8Array([1, 2, 3]));
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

describe('Scheduled sync at scale', () => {
  let h: Harness;
  const ids: string[] = [];
  const later = new Date('2026-11-02T15:00:00Z');
  before(async () => {
    h = await harness();
    for (let i = 0; i < 5; i++) {
      const ig = new FakeInstagram();
      const igId = `1784140000000100${i}`;
      ig.acct = { ...ig.acct, userId: igId, username: `scale.${i}` };
      ig.grant = { ...ig.grant, userId: igId };
      const u = user();
      const ws = await creator(h.sql, u, `scale.${i}`);
      ids.push((await connectInstagram(h.sql, u, ws, `AUTH_CODE_scale_${i}`, 'https://app/cb', deps(ig))).id);
    }
  });
  after(() => h.close());

  it('two runs at the same moment never read the same channel, and together cover all of them', async () => {
    const ig = new FakeInstagram();
    const [a, b] = await Promise.all([syncAllDue(h.sql, deps(ig, later), { limit: 3 }), syncAllDue(h.sql, deps(ig, later), { limit: 3 })]);
    const seen = [...a, ...b].map((r) => r.channelId);
    assert.equal(new Set(seen).size, seen.length, 'no channel read twice');
    assert.equal(seen.length, 5);
    assert.deepEqual([...seen].sort(), [...ids].sort());
    const claimed = await h.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM creator_channels WHERE sync_claimed_at IS NOT NULL AND id = ANY(${ids})`;
    assert.equal(claimed[0]?.n, 0, 'claims are cleared when a read finishes');
  });

  it('respects the limit and the time budget, and skips channels read in the last 20 hours', async () => {
    const ig = new FakeInstagram();
    assert.equal((await syncAllDue(h.sql, deps(ig, later), { limit: 5 })).length, 0, 'all were read moments ago');
    const nextDay = new Date(later.getTime() + 21 * 3_600_000);
    assert.equal((await syncAllDue(h.sql, deps(ig, nextDay), { limit: 2 })).length, 2);
    assert.equal((await syncAllDue(h.sql, deps(ig, nextDay), { budgetMs: 0 })).length, 0, 'no time left: claims nothing');
    assert.equal((await syncAllDue(h.sql, deps(ig, nextDay))).length, 3, 'the rest');
  });

  it('a claim left by a crashed run is taken over after 10 minutes, not before', async () => {
    const ig = new FakeInstagram();
    const day3 = new Date(later.getTime() + 2 * 86_400_000);
    await h.sql`UPDATE creator_channels SET sync_claimed_at = ${new Date(day3.getTime() - 5 * 60_000)} WHERE id = ${ids[0]!}`;
    await h.sql`UPDATE creator_channels SET sync_claimed_at = ${new Date(day3.getTime() - 11 * 60_000)} WHERE id = ${ids[1]!}`;
    const done = (await syncAllDue(h.sql, deps(ig, day3))).map((r) => r.channelId);
    assert.ok(!done.includes(ids[0]!), 'a fresh claim is left alone');
    assert.ok(done.includes(ids[1]!), 'an abandoned claim is taken over');
    assert.equal(done.length, 4);
  });
});
