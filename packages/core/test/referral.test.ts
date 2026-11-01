import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { joinRate, normalizeReferralCode, referralConsentText } from '../src/index.ts';

describe('referral rules', () => {
  it('accepts handle-shaped codes only', () => {
    assert.equal(normalizeReferralCode('@Maya.Cooks'), 'maya.cooks');
    assert.equal(normalizeReferralCode('../etc'), null);
    assert.equal(normalizeReferralCode(''), null);
    assert.equal(normalizeReferralCode(null), null);
  });
  it('tells the lead the referrer sees their name and handle but not their email', () => {
    const t = referralConsentText('Jay Star');
    assert.match(t, /GenCut AI may email me/);
    assert.match(t, /Jay Star will see my name, the handle I enter and whether I join, but not my email address/);
  });
  it('join rate is a whole percent of visitors, unknown without visits', () => {
    assert.equal(joinRate(0, 0), null);
    assert.equal(joinRate(200, 13), 7);
    assert.equal(joinRate(3, 9), 100);
  });
});
