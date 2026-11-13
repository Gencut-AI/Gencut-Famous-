import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createCreator, ensureUser, listSignups } from '../src/index.ts';
import { type Harness, creator, expectService, harness, user } from './helpers.ts';

const ADMINS = 'paul@gencut.ai';

describe('staff sign-up list', () => {
  let h: Harness;
  const paul = user('paul@gencut.ai');
  const jay = user('jay@star.example');
  const ana = user('ana@example.com');
  const looker = user('looker@example.com');
  before(async () => {
    h = await harness();
    await creator(h.sql, jay, 'jay.star');
    await createCreator(h.sql, ana, { publicName: 'Ana Lopez', handle: 'ana.makes', adult: true }, { referralCode: 'jay.star' });
    await ensureUser(h.sql, looker);
  });
  after(() => h.close());

  it('is for GenCut staff only', async () => {
    await expectService(listSignups(h.sql, jay, ADMINS), 'forbidden');
    await expectService(listSignups(h.sql, paul, undefined), 'forbidden');
  });

  it('without the sign-in provider records, lists known users and says the rest is unavailable', async () => {
    const s = await listSignups(h.sql, paul, ADMINS);
    assert.equal(s.signInRecords, 'unavailable');
    assert.deepEqual(s.people.map((p) => p.email).sort(), ['ana@example.com', 'jay@star.example', 'looker@example.com']);
    assert.ok(s.people.every((p) => p.requestedAt === null && p.lastSignInAt === null), 'unknown times stay null');
    assert.equal(s.people.find((p) => p.email === 'looker@example.com')?.stage, 'signed_in');
    const a = s.people.find((p) => p.email === 'ana@example.com');
    assert.equal(a?.stage, 'onboarded');
    assert.deepEqual(a?.creators, [{ handle: 'ana.makes', publicName: 'Ana Lopez', role: 'owner', referredByHandle: 'jay.star' }]);
  });

  it('with them, also lists people who asked for a sign-in email and never used it', async () => {
    h.db.query(`
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, created_at timestamptz, last_sign_in_at timestamptz);
      INSERT INTO auth.users VALUES
        ('${jay.userId}', 'jay@star.example', '2026-11-01T10:00:00Z', '2026-11-02T10:00:00Z'),
        ('${looker.userId}', 'looker@example.com', '2026-11-03T10:00:00Z', '2026-11-03T10:05:00Z'),
        ('00000000-0000-4000-8000-000000000001', 'Stuck@Example.com', '2026-11-05T10:00:00Z', NULL),
        ('00000000-0000-4000-8000-000000000002', NULL, '2026-11-06T10:00:00Z', NULL);
    `);
    const s = await listSignups(h.sql, paul, ADMINS);
    assert.equal(s.signInRecords, 'available');
    const stuck = s.people.find((p) => p.email === 'stuck@example.com');
    assert.equal(stuck?.stage, 'not_finished');
    assert.equal(stuck?.requestedAt?.toISOString(), '2026-11-05T10:00:00.000Z');
    assert.equal(stuck?.lastSignInAt, null);
    const order = s.people.map((p) => p.email).filter((e) => e !== 'ana@example.com');
    assert.deepEqual(order, ['stuck@example.com', 'looker@example.com', 'jay@star.example'], 'newest request first');
    const j = s.people.find((p) => p.email === 'jay@star.example');
    assert.equal(j?.stage, 'onboarded');
    assert.equal(j?.lastSignInAt?.toISOString(), '2026-11-02T10:00:00.000Z');
    assert.equal(s.people.find((p) => p.email === 'looker@example.com')?.stage, 'signed_in');
    assert.ok(s.people.some((p) => p.email === 'ana@example.com'), 'a user missing from the provider records is still listed');
    assert.equal(s.people.length, 4, 'a provider row with no email and no account is skipped');
  });
});
