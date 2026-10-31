import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeHandle, validateHandle } from '../src/index.ts';

describe('handles', () => {
  it('normalizes what people type', () => {
    assert.equal(normalizeHandle('  @@Maya.Rivera '), 'maya.rivera');
  });
  it('accepts social-style handles', () => {
    for (const h of ['maya', 'maya.rivera', 'maya_rivera_23', 'abc']) assert.deepEqual(validateHandle(h), { ok: true, value: h });
  });
  it('rejects bad shapes with one clear message', () => {
    for (const h of ['ab', '.maya', 'maya.', 'maya..rivera', 'maya__r', 'maya rivera', 'maya-rivera', 'a'.repeat(31), 'máya']) {
      const r = validateHandle(h);
      assert.equal(r.ok, false, h);
      if (!r.ok) assert.equal(r.error, 'invalid_handle');
    }
  });
  it('rejects reserved words that collide with routes or impersonate GenCut', () => {
    for (const h of ['admin', 'privacy', 'GenCut', '@support']) {
      const r = validateHandle(h);
      assert.equal(r.ok ? null : r.error, 'reserved_handle', h);
    }
  });
});
