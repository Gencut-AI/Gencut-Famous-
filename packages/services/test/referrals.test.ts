import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  createCreator,
  getJoinPage,
  getReferralOverview,
  isAdmin,
  listAllReferralLeads,
  recordReferralVisit,
  submitReferralLead,
  updateProfile,
} from '../src/index.ts';
import { type Harness, creator, expectService, harness, user } from './helpers.ts';

const SECRET = 'visit-secret';
const v = (address: string, src: string | null = 'instagram', ua = 'Mozilla/5.0') => ({ address, userAgent: ua, src });
const lead = (over: Record<string, unknown> = {}) => ({ name: 'Ana Lopez', email: 'Ana@Example.com', socialHandle: '@ana.makes', role: 'content_creator', consent: true, src: 'instagram', ...over });

describe('referrals', () => {
  let h: Harness;
  const jay = user('jay@star.example');
  let jayWs: string;
  before(async () => {
    h = await harness();
    jayWs = await creator(h.sql, jay, 'jay.star');
  });
  after(() => h.close());

  it('every new creator gets a join code equal to their handle, kept if the handle changes', async () => {
    assert.equal((await getJoinPage(h.sql, 'jay.star'))?.publicName, 'Jay.star');
    await updateProfile(h.sql, jay, jayWs, { handle: 'jay.star.official' });
    assert.ok(await getJoinPage(h.sql, 'jay.star'), 'old links keep working');
    assert.equal((await getReferralOverview(h.sql, jay, jayWs)).code, 'jay.star');
    assert.equal(await getJoinPage(h.sql, 'nobody.here'), null);
  });

  it('counts each visitor once a day, keeps the source, and skips crawlers', async () => {
    assert.equal(await recordReferralVisit(h.sql, 'jay.star', v('1.1.1.1'), SECRET), true);
    assert.equal(await recordReferralVisit(h.sql, 'jay.star', v('1.1.1.1'), SECRET), false);
    assert.equal(await recordReferralVisit(h.sql, 'jay.star', v('2.2.2.2', 'tiktok'), SECRET), true);
    assert.equal(await recordReferralVisit(h.sql, 'jay.star', v('3.3.3.3', null, 'facebookexternalhit/1.1'), SECRET), false);
    const o = await getReferralOverview(h.sql, jay, jayWs);
    assert.equal(o.visits7, 2);
    assert.deepEqual(o.bySource.map((s) => s.source).sort(), ['instagram', 'tiktok']);
  });

  it('takes a lead with stored consent; the referrer sees name and handle, never the email', async () => {
    assert.deepEqual(await submitReferralLead(h.sql, 'jay.star', lead(), { address: '9.9.9.9', userAgent: 'Mozilla' }, SECRET), { status: 'sent' });
    await expectService(submitReferralLead(h.sql, 'jay.star', lead({ consent: false }), { address: '9.9.9.9', userAgent: 'Mozilla' }, SECRET), 'invalid', 'consent');
    const o = await getReferralOverview(h.sql, jay, jayWs);
    assert.equal(o.leads.length, 1);
    assert.equal(o.leads[0]?.socialHandle, 'ana.makes');
    assert.ok(!JSON.stringify(o).includes('example.com'), 'no email in the referrer view');
    assert.match(h.db.query("SELECT disclosure_text FROM consents WHERE purpose = 'referral_followup'"), /Jay\.star will see my name/);
  });

  it('limits repeat submissions from one sender', async () => {
    const sender = { address: '8.8.8.8', userAgent: 'Mozilla' };
    for (let i = 0; i < 3; i++) await submitReferralLead(h.sql, 'jay.star', lead({ email: `p${i}@example.com` }), sender, SECRET);
    assert.deepEqual(await submitReferralLead(h.sql, 'jay.star', lead({ email: 'p9@example.com' }), sender, SECRET), { status: 'limited' });
  });

  it('credits a sign-up through the link to the referrer and marks the matching lead as joined', async () => {
    const ana = user('ana@example.com');
    await createCreator(h.sql, ana, { publicName: 'Ana Lopez', handle: 'ana.makes', adult: true }, { referralCode: 'jay.star' });
    const o = await getReferralOverview(h.sql, jay, jayWs);
    assert.deepEqual(o.signups.map((s) => s.handle), ['ana.makes']);
    assert.equal(o.leads.filter((l) => l.joined).length, 1, 'only the lead with the same email is marked joined');
  });

  it('ignores self-referrals and unknown codes', async () => {
    const other = user();
    await createCreator(h.sql, other, { publicName: 'Bo', handle: 'bo.solo', adult: true }, { referralCode: 'not.a.code' });
    const second = await createCreator(h.sql, jay, { publicName: 'Jay Two', handle: 'jay.two', adult: true }, { referralCode: 'jay.star' });
    assert.equal(h.db.query(`SELECT referred_by_workspace_id IS NULL FROM workspaces WHERE id = '${second}'`), 't');
    assert.equal((await getReferralOverview(h.sql, jay, jayWs)).signups.length, 1);
  });

  it('shows every lead with its email to GenCut staff only', async () => {
    assert.equal(isAdmin('Paul@GenCut.ai', 'paul@gencut.ai, ops@gencut.ai'), true);
    assert.equal(isAdmin('x@gencut.ai', 'paul@gencut.ai'), false);
    assert.equal(isAdmin('paul@gencut.ai', undefined), false);
    await expectService(listAllReferralLeads(h.sql, jay, 'paul@gencut.ai'), 'forbidden');
    const all = await listAllReferralLeads(h.sql, user('paul@gencut.ai'), 'paul@gencut.ai');
    assert.ok(all.some((l) => l.email === 'ana@example.com' && l.referrerHandle === 'jay.star.official' && l.joined));
  });
});
