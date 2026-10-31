import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CONNECTORS, INSTAGRAM, PLATFORMS, connectionState, insightsKind, missingScopes, parseGrantedScopes, parseInsights } from '../src/index.ts';

const now = new Date('2026-10-31T12:00:00Z');
const facts = {
  grantedScopes: ['instagram_business_basic', 'instagram_business_manage_insights'],
  accountType: 'MEDIA_CREATOR',
  accessExpiresAt: new Date('2026-12-30T00:00:00Z'),
  revokedAt: null,
  authError: null,
};

describe('connector manifests', () => {
  it('cover every platform; only Instagram is built', () => {
    assert.deepEqual(CONNECTORS.map((c) => c.platform).sort(), [...PLATFORMS].sort());
    assert.deepEqual(CONNECTORS.filter((c) => c.build === 'available').map((c) => c.platform), ['instagram']);
  });
  it('a built connector declares every field the directive requires', () => {
    for (const field of ['oauth', 'publishing', 'tokens', 'revocation', 'rateLimits', 'approval'] as const) assert.ok(INSTAGRAM[field].length > 10, field);
    assert.ok(INSTAGRAM.requiredScopes.length && INSTAGRAM.accountTypes.length && INSTAGRAM.analytics.length && INSTAGRAM.unsupported.length);
  });
});

describe('connection state', () => {
  it('is connected only with every required scope', () => {
    assert.equal(connectionState(INSTAGRAM, facts, now), 'connected');
    assert.equal(connectionState(INSTAGRAM, { ...facts, grantedScopes: ['instagram_business_basic'] }, now), 'partially_connected');
    assert.deepEqual(missingScopes(INSTAGRAM, ['instagram_business_basic']), ['instagram_business_manage_insights']);
  });
  it('without the basic scope it is an error, not partially connected', () => {
    assert.equal(connectionState(INSTAGRAM, { ...facts, grantedScopes: ['instagram_business_manage_insights'] }, now), 'error');
  });
  it('revoked beats everything; then unsupported account; then expired; then errors', () => {
    assert.equal(connectionState(INSTAGRAM, { ...facts, revokedAt: now, authError: 'x' }, now), 'revoked');
    assert.equal(connectionState(INSTAGRAM, { ...facts, accountType: 'PERSONAL' }, now), 'unsupported');
    assert.equal(connectionState(INSTAGRAM, { ...facts, accessExpiresAt: now }, now), 'expired');
    assert.equal(connectionState(INSTAGRAM, { ...facts, authError: 'Token refused' }, now), 'error');
  });
});

describe('Instagram parsing', () => {
  it('reads granted scopes from a string or an array', () => {
    assert.deepEqual(parseGrantedScopes('instagram_business_manage_insights, instagram_business_basic'), ['instagram_business_basic', 'instagram_business_manage_insights']);
    assert.deepEqual(parseGrantedScopes(['a', 'a', ' b ']), ['a', 'b']);
    assert.deepEqual(parseGrantedScopes(undefined), []);
  });
  it('reads total_value and values shapes, and leaves out what the platform did not return', () => {
    const m = parseInsights({ data: [
      { name: 'reach', total_value: { value: 812 } },
      { name: 'views', values: [{ value: 2400 }] },
      { name: 'likes', total_value: {} },
    ] });
    assert.equal(m.get('reach'), 812);
    assert.equal(m.get('views'), 2400);
    assert.equal(m.has('likes'), false);
    assert.equal(parseInsights({ error: {} }).size, 0);
  });
  it('carousels have no insights; reels and feed posts do', () => {
    assert.equal(insightsKind('CAROUSEL_ALBUM', 'FEED'), null);
    assert.equal(insightsKind('VIDEO', 'REELS'), 'REELS');
    assert.equal(insightsKind('IMAGE', 'FEED'), 'FEED');
    assert.equal(insightsKind('IMAGE', 'STORY'), null);
  });
});
