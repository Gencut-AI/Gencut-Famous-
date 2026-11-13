import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { addPartnership, getCreatorProfile, listMedia, listPartnerships, updateProfile, uploadMedia } from '../src/index.ts';
import { type Harness, creator, expectService, harness, user } from './helpers.ts';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

describe('brand profile', () => {
  let h: Harness;
  before(async () => {
    h = await harness();
  });
  after(() => h.close());

  it('saves only the fields sent, normalizes lists and colors, and audits field names only', async () => {
    const u = user();
    const ws = await creator(h.sql, u, 'brand.test');
    await updateProfile(h.sql, u, ws, { bio: 'Chef.', niches: ['food', 'travel'], colors: '#0F6E73, #ef5f82', brandsAvoided: 'Fast Fashion Co, fast fashion co' });
    const p = await updateProfile(h.sql, u, ws, { tone: 'warm' });
    assert.equal(p.bio, 'Chef.');
    assert.deepEqual(p.colors, ['#0f6e73', '#ef5f82']);
    assert.deepEqual(p.brandsAvoided, ['Fast Fashion Co']);
    assert.equal(p.tone, 'warm');
    const detail = h.db.query(`SELECT detail FROM audit_events WHERE workspace_id = '${ws}' AND action = 'updated' ORDER BY id LIMIT 1`);
    assert.match(detail, /"fields"/);
    assert.doesNotMatch(detail, /Chef/);
  });

  it('rejects invalid colors and too many niches with field messages', async () => {
    const u = user();
    const ws = await creator(h.sql, u, 'bad.input');
    await expectService(updateProfile(h.sql, u, ws, { colors: 'teal' }), 'invalid', 'colors');
    await expectService(updateProfile(h.sql, u, ws, { niches: ['food', 'travel', 'tech', 'music', 'gaming', 'pets'] }), 'invalid', 'niches');
  });

  it('keeps the rate card private to the profile record', async () => {
    const u = user();
    const ws = await creator(h.sql, u, 'rate.card');
    const p = await updateProfile(h.sql, u, ws, { rateCard: [{ deliverable: 'Instagram Reel', priceUsd: 2500 }] });
    assert.deepEqual(p.rateCard, [{ deliverable: 'Instagram Reel', priceUsd: 2500 }]);
  });

  it('saves pasted social links and refuses the whole save when a line is not a profile link', async () => {
    const u = user();
    const ws = await creator(h.sql, u, 'links.saver');
    const p = await updateProfile(h.sql, u, ws, { socialLinks: 'https://www.instagram.com/links.saver/?igsh=x\nhttps://www.tiktok.com/@links.saver\nlinks.example.com' });
    assert.deepEqual(p.socialLinks.map((l) => l.kind), ['instagram', 'tiktok', 'website']);
    const fields = await expectService(updateProfile(h.sql, u, ws, { socialLinks: 'https://www.tiktok.com/@links.saver\nhttps://www.instagram.com/p/abc/' }), 'invalid', 'socialLinks');
    assert.match(fields.socialLinks ?? '', /not a profile/);
    assert.equal((await getCreatorProfile(h.sql, u, ws)).socialLinks.length, 3, 'nothing changed on a refused save');
    assert.equal((await updateProfile(h.sql, u, ws, { socialLinks: '' })).socialLinks.length, 0, 'clearing removes them');
    await expectService(updateProfile(h.sql, user(), ws, { socialLinks: 'https://x.com/a' }), 'forbidden');
  });

  it('stores partnerships as self-reported only', async () => {
    const u = user();
    const ws = await creator(h.sql, u, 'partner.ship');
    await addPartnership(h.sql, u, ws, { brandName: 'Acme Kitchens', description: 'Holiday series', period: '2025', url: '' });
    await expectService(addPartnership(h.sql, u, ws, { brandName: 'X', description: '', period: '', url: 'http://insecure.example' }), 'invalid', 'url');
    assert.equal((await listPartnerships(h.sql, ws)).length, 1);
    assert.equal(h.db.query(`SELECT source FROM creator_partnerships WHERE workspace_id = '${ws}'`), 'self_reported');
  });

  it('accepts images by their bytes, replaces the logo, and refuses other files', async () => {
    const u = user();
    const ws = await creator(h.sql, u, 'media.test');
    await uploadMedia(h.sql, u, ws, 'logo', PNG);
    await uploadMedia(h.sql, u, ws, 'logo', PNG);
    await expectService(uploadMedia(h.sql, u, ws, 'profile_photo', new TextEncoder().encode('<svg onload=alert(1)>')), 'invalid');
    assert.deepEqual((await listMedia(h.sql, u, ws)).map((m) => m.kind), ['logo']);
    assert.equal((await getCreatorProfile(h.sql, u, ws)).hasLogo, true);
  });
});
