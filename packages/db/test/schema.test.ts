import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { AUDIT_ENTITY_TYPES, AVAILABILITY, INQUIRY_KINDS, METRIC_KEYS, NICHES, PARTNERSHIP_KINDS, PLATFORMS, ROLES, TONES } from '../../core/src/index.ts';
import { migrateUp } from '../src/migrate.ts';
import { type TestDb, createTestDb, expectSqlError } from './helpers.ts';

/** Values quoted in a table's CHECK constraints, to compare with the lists in core. */
function checkValues(db: TestDb, table: string, column: string): Set<string> {
  const defs = db.query(`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = '${table}'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%${column}%'`);
  return new Set([...defs.matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1] as string));
}

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';

describe('schema', () => {
  let db: TestDb;
  let ws: string;
  before(() => {
    db = createTestDb();
    migrateUp(db.url);
    db.query(`INSERT INTO users (id, email) VALUES ('${U1}', 'a@example.com'), ('${U2}', 'b@example.com')`);
    ws = db.query("INSERT INTO workspaces (name) VALUES ('Maya') RETURNING id");
  });
  after(() => db.drop());

  it('CHECK lists match the lists in packages/core', () => {
    const same = (table: string, column: string, list: readonly string[]) => {
      const found = checkValues(db, table, column);
      for (const v of list) assert.ok(found.has(v), `${table}.${column} lacks ${v}`);
    };
    same('memberships', 'role', ROLES);
    same('audit_events', 'entity_type', AUDIT_ENTITY_TYPES);
    same('creator_profiles', 'niches', NICHES);
    same('creator_profiles', 'tone', TONES);
    same('creator_profiles', 'partnership_kinds', PARTNERSHIP_KINDS);
    same('creator_channels', 'platform', PLATFORMS);
    same('creator_metric_snapshots', 'metric', METRIC_KEYS);
    same('creator_metric_snapshots', 'availability', AVAILABILITY);
    same('creator_inquiries', 'kind', INQUIRY_KINDS);
  });

  it('allows one owner per workspace', () => {
    db.query(`INSERT INTO memberships (workspace_id, user_id, role) VALUES ('${ws}', '${U1}', 'owner')`);
    assert.match(expectSqlError(db, `INSERT INTO memberships (workspace_id, user_id, role) VALUES ('${ws}', '${U2}', 'owner')`), /memberships_one_owner/);
    db.query(`INSERT INTO memberships (workspace_id, user_id, role) VALUES ('${ws}', '${U2}', 'manager')`);
  });

  it('keeps the audit log append-only, but lets a deleted workspace take its log with it', () => {
    const w2 = db.query("INSERT INTO workspaces (name) VALUES ('Temp') RETURNING id");
    db.query(`INSERT INTO audit_events (workspace_id, actor_type, via, entity_type, entity_id, action) VALUES ('${w2}', 'system', 'worker', 'workspace', '${w2}', 'created')`);
    assert.match(expectSqlError(db, `UPDATE audit_events SET action = 'x' WHERE workspace_id = '${w2}'`), /append-only/);
    assert.match(expectSqlError(db, `DELETE FROM audit_events WHERE workspace_id = '${w2}'`), /append-only/);
    db.query(`DELETE FROM workspaces WHERE id = '${w2}'`);
    assert.equal(db.query(`SELECT count(*) FROM audit_events WHERE workspace_id = '${w2}'`), '0');
  });

  it('requires an adult attestation and a valid, unique handle', () => {
    assert.match(expectSqlError(db, `INSERT INTO creator_profiles (workspace_id, public_name, handle, adult_attested_by) VALUES ('${ws}', 'Maya', 'maya', '${U1}')`), /adult_attested_at/);
    assert.match(expectSqlError(db, `INSERT INTO creator_profiles (workspace_id, public_name, handle, adult_attested_at, adult_attested_by) VALUES ('${ws}', 'Maya', 'Maya!', now(), '${U1}')`), /check/i);
    db.query(`INSERT INTO creator_profiles (workspace_id, public_name, handle, adult_attested_at, adult_attested_by) VALUES ('${ws}', 'Maya', 'maya', now(), '${U1}')`);
  });

  it('never stores a missing metric as a number, and never a number marked missing', () => {
    const ch = db.query(`INSERT INTO creator_channels (workspace_id, platform, external_account_id, username, connected_by) VALUES ('${ws}', 'instagram', '1789', 'maya', '${U1}') RETURNING id`);
    const ins = (value: string, availability: string) =>
      `INSERT INTO creator_metric_snapshots (workspace_id, channel_id, metric, period_kind, as_of, value, availability, retrieved_at, source_endpoint, api_version) VALUES ('${ws}', '${ch}', 'reach', 'instant', current_date, ${value}, '${availability}', now(), '/me', 'v1')`;
    assert.match(expectSqlError(db, ins('0', 'unavailable')), /check/i);
    assert.match(expectSqlError(db, ins('NULL', 'available')), /check/i);
    db.query(ins('NULL', 'below_threshold'));
    assert.match(expectSqlError(db, ins('5', 'available')), /unique/i);
  });

  it('lets one platform account be connected to only one workspace at a time', () => {
    const w3 = db.query("INSERT INTO workspaces (name) VALUES ('Other') RETURNING id");
    assert.match(expectSqlError(db, `INSERT INTO creator_channels (workspace_id, platform, external_account_id, username, connected_by) VALUES ('${w3}', 'instagram', '1789', 'maya', '${U2}')`), /creator_channels_active_account/);
  });

  it('a published page records who published it and when', () => {
    assert.match(expectSqlError(db, `INSERT INTO profile_pages (workspace_id, published) VALUES ('${ws}', true)`), /check/i);
  });
});
