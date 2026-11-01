import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { describeDbError } from '../lib/db-probe.ts';

describe('database probe diagnostics', () => {
  it('reports code, host and user kind, never the password', () => {
    const url = 'postgresql://postgres.abcdefghij:S3cret-Pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres';
    const s = describeDbError(Object.assign(new Error('getaddrinfo ENOTFOUND db.example'), { code: 'ENOTFOUND' }), url);
    assert.match(s, /code=ENOTFOUND host=aws-0-us-east-1\.pooler\.supabase\.com:6543 user=postgres\.<project>/);
    assert.doesNotMatch(s, /S3cret/);
  });
  it('strips connection strings from messages', () => {
    const s = describeDbError(new Error('bad postgresql://u:pw@h/db'), 'not a url');
    assert.doesNotMatch(s, /pw@/);
    assert.match(s, /host=unparseable-url/);
  });
});
