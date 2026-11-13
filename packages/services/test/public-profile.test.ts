import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  type ModelRouter,
  askAssistant,
  connectInstagram,
  getDashboard,
  getPublishedProfile,
  listContent,
  listInquiries,
  recordVisit,
  savePageSettings,
  setContentShown,
  setPublished,
  submitInquiry,
  syncInstagramChannel,
  updateProfile,
} from '../src/index.ts';
import { FakeInstagram, type Harness, creator, deps, expectService, harness, user } from './helpers.ts';

const SECRET = 'visit-secret';
const visitor = (address: string, src: string | null = null, ua = 'Mozilla/5.0') => ({ address, userAgent: ua, referrer: 'https://www.instagram.com/', ownHost: 'gencut.ai', src });
const inquiry = (over: Record<string, unknown> = {}) => ({ kind: 'brand_partnership', name: 'Jo Brand', email: 'Jo@Brand.example', organization: 'Brand Co', message: 'We would love to work with you on a spring series.', consent: true, src: 'instagram', ...over });

describe('public profile, visits and inquiries', () => {
  let h: Harness;
  const u = user();
  let ws: string;
  before(async () => {
    h = await harness();
    ws = await creator(h.sql, u, 'maya.public');
    await updateProfile(h.sql, u, ws, { bio: 'Weeknight recipes.', niches: ['food'], rateCard: [{ deliverable: 'Private Reel Rate', priceUsd: 987654 }], brandsAvoided: 'Secret Rival', legalName: 'Maya Q. Rivera' });
    const ig = new FakeInstagram();
    ig.acct = { ...ig.acct, userId: '1784140000777', username: 'maya.public' };
    ig.media = [{ id: 'p1', caption: 'Ceviche', mediaType: 'VIDEO', productType: 'REELS', permalink: 'https://www.instagram.com/reel/p1/', timestamp: new Date('2026-10-20T00:00:00Z'), thumbnailUrl: null, likeCount: 10, commentsCount: 1 }];
    const ch = await connectInstagram(h.sql, u, ws, 'AUTH_CODE_public_1', 'https://app/cb', deps(ig));
    await syncInstagramChannel(h.sql, ch.id, deps(ig), 'manual');
  });
  after(() => h.close());

  it('is not public until published', async () => {
    assert.equal(await getPublishedProfile(h.sql, 'maya.public'), null);
    assert.equal(await recordVisit(h.sql, 'maya.public', visitor('1.1.1.1'), SECRET), false);
    assert.deepEqual(await submitInquiry(h.sql, 'maya.public', inquiry(), visitor('1.1.1.1'), SECRET), { status: 'unavailable' });
  });

  it('shows only what the creator chose, with source and date, and nothing private', async () => {
    await savePageSettings(h.sql, u, ws, { headline: 'Cook with me', workWithMe: 'Recipe series and launches.', showInquiryForm: true, shownMetrics: ['followers', 'reach'] });
    const [post] = await listContent(h.sql, u, ws);
    await setContentShown(h.sql, u, ws, post?.id ?? '', true);
    await setPublished(h.sql, u, ws, true);
    const p = await getPublishedProfile(h.sql, '@Maya.Public');
    assert.ok(p);
    assert.deepEqual(p.metrics.map((m) => m.metric).sort(), ['followers', 'reach']);
    assert.ok(p.metrics.every((m) => m.value !== null && m.source === 'instagram' && m.retrievedAt instanceof Date));
    assert.equal(p.content.length, 1);
    assert.deepEqual(p.links.map((l) => l.url), ['https://www.instagram.com/maya.public/']);
    assert.equal(p.links[0]?.connected, true);
    const json = JSON.stringify(p);
    for (const secret of ['987654', 'Private Reel Rate', 'rateCard', 'Secret Rival', 'Maya Q. Rivera']) assert.ok(!json.includes(secret), `leaked ${secret}`);
  });

  it('adds pasted social links after connected accounts, without repeating a connected one', async () => {
    await updateProfile(h.sql, u, ws, { socialLinks: 'https://www.instagram.com/Maya.Public\nhttps://www.tiktok.com/@maya.cooks\nmaya.example.com' });
    const p = await getPublishedProfile(h.sql, 'maya.public');
    assert.deepEqual(p?.links.map((l) => [l.kind, l.label, l.connected]), [
      ['instagram', '@maya.public', true],
      ['tiktok', '@maya.cooks', false],
      ['website', 'maya.example.com', false],
    ]);
  });

  it('counts a visitor once a day, keeps the source, skips bots, and stores no address', async () => {
    assert.equal(await recordVisit(h.sql, 'maya.public', visitor('9.9.9.9', 'tiktok'), SECRET), true);
    assert.equal(await recordVisit(h.sql, 'maya.public', visitor('9.9.9.9', 'tiktok'), SECRET), false);
    assert.equal(await recordVisit(h.sql, 'maya.public', visitor('8.8.8.8', null, 'facebookexternalhit/1.1'), SECRET), false);
    assert.equal(h.db.query("SELECT count(*) FROM profile_visits WHERE visitor_hash LIKE '%9.9.9.9%' OR referrer_host LIKE '%/%'"), '0');
    const d = await getDashboard(h.sql, u, ws);
    assert.equal(d.visits.last7, 1);
    assert.deepEqual(d.visits.bySource.map((s) => ({ ...s })), [{ source: 'tiktok', visits: 1 }]);
  });

  it('takes an inquiry with the exact consent text, and limits repeat senders', async () => {
    assert.deepEqual(await submitInquiry(h.sql, 'maya.public', inquiry(), visitor('5.5.5.5'), SECRET), { status: 'sent' });
    const consent = h.db.query(`SELECT disclosure_text || '|' || address FROM consents WHERE workspace_id = '${ws}'`);
    assert.match(consent, /Maya\.public and their team may reply.*\|jo@brand\.example/);
    await expectService(submitInquiry(h.sql, 'maya.public', inquiry({ consent: false }), visitor('5.5.5.5'), SECRET), 'invalid', 'consent');
    for (let i = 0; i < 4; i++) await submitInquiry(h.sql, 'maya.public', inquiry(), visitor('5.5.5.5'), SECRET);
    assert.deepEqual(await submitInquiry(h.sql, 'maya.public', inquiry(), visitor('5.5.5.5'), SECRET), { status: 'limited' });
    assert.equal((await listInquiries(h.sql, u, ws)).length, 5);
  });

  it('the assistant answers from stored readings with source and date, and never lets the model write the answer', async () => {
    const r = await askAssistant(h.sql, u, ws, 'How many followers do I have?', null, 'https://gencut.ai');
    assert.equal(r.understoodBy, 'parser');
    assert.match(r.lines.join('\n'), /Followers: 12,450 \(as of .*, Instagram, read /);

    let asked = 0;
    const router = {
      complete: async () => {
        asked += 1;
        return { text: '{"command":"inquiries"}', usage: { inputTokens: 50, outputTokens: 5, cacheReadTokens: 0 }, provider: 'anthropic', model: 'test', latencyMs: 5, costUsd: 0.00001 };
      },
      route: () => ({ provider: 'anthropic', model: 'test' }),
    } as unknown as ModelRouter;
    const m = await askAssistant(h.sql, u, ws, 'did anybody reach out lately', router, 'https://gencut.ai');
    assert.equal(asked, 1);
    assert.equal(m.understoodBy, 'model');
    assert.match(m.lines[0] ?? '', /5 unread inquiries/);
    assert.equal(h.db.query(`SELECT status || ':' || purpose FROM model_runs WHERE workspace_id = '${ws}'`), 'succeeded:assistant_intent');

    const none = await askAssistant(h.sql, u, ws, 'write me a caption', null, 'https://gencut.ai');
    assert.equal(none.command, null);

    const link = await askAssistant(h.sql, u, ws, 'what is my profile link', null, 'https://gencut.ai');
    assert.equal(link.link?.href, 'https://gencut.ai/@maya.public');
  });
});
