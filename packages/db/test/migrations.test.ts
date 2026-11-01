import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { appliedVersions, listMigrations, migrateDown, migrateUp } from '../src/migrate.ts';
import { type TestDb, createTestDb } from './helpers.ts';

function userTables(db: TestDb): string[] {
  const out = db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name <> 'schema_migrations' ORDER BY 1");
  return out ? out.split('\n') : [];
}

describe('migrations', () => {
  let db: TestDb;
  before(() => {
    db = createTestDb();
  });
  after(() => db.drop());

  it('every migration has an up and a down file, numbered without gaps', () => {
    listMigrations().forEach((m, i) => assert.equal(Number(m.version), i + 1, m.name));
  });

  it('apply cleanly to an empty database', () => {
    assert.deepEqual(migrateUp(db.url), listMigrations().map((m) => m.name));
    assert.deepEqual(userTables(db), [
      'audit_events', 'channel_credentials', 'consents', 'creator_channels', 'creator_content', 'creator_inquiries',
      'creator_metric_snapshots', 'creator_partnerships', 'creator_profiles', 'deletion_requests', 'invitations', 'media_assets',
      'memberships', 'model_runs', 'profile_pages', 'profile_visits', 'referral_codes', 'referral_leads', 'referral_visits', 'users', 'workspaces',
    ]);
  });

  it('lock every table against the public Data API (RLS on, no policies)', () => {
    const noRls = db.query("SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity AND relname <> 'schema_migrations'");
    assert.equal(noRls, '');
    assert.equal(db.query("SELECT count(*) FROM pg_policies WHERE schemaname = 'public'"), '0');
  });

  it('roll all the way back and forward again', () => {
    migrateDown(db.url, listMigrations().length);
    assert.deepEqual(userTables(db), []);
    assert.deepEqual(appliedVersions(db.url), []);
    migrateUp(db.url);
    assert.equal(appliedVersions(db.url).length, listMigrations().length);
  });
});
