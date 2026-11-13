import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type CreatorProfile, can, normalizeColor, sectionStatus, splitList } from '../src/index.ts';

const empty: CreatorProfile = {
  workspaceId: 'w', publicName: 'Maya', handle: 'maya', legalName: null, bio: null, niches: [], targetAudience: null,
  audienceNotes: null, brandMessage: null, values: [], tone: null, toneNotes: null, colors: [], fonts: [], goals: null,
  growthTarget: null, partnershipKinds: [], brandsWanted: [], brandsAvoided: [], rateCard: [], socialLinks: [], hasLogo: false,
  hasPhoto: false, contentExamples: 0, updatedAt: new Date(0),
};

describe('creator profile', () => {
  it('a new profile has every section open, and filling one marks only that one', () => {
    assert.ok(Object.values(sectionStatus(empty)).every((v) => v === false));
    const s = sectionStatus({ ...empty, bio: 'Chef in Miami', niches: ['food'] });
    assert.equal(s.identity, true);
    assert.equal(s.audience, false);
  });
  it('visual identity needs a photo plus a logo or colors', () => {
    assert.equal(sectionStatus({ ...empty, hasPhoto: true }).visual, false);
    assert.equal(sectionStatus({ ...empty, hasPhoto: true, colors: ['#0f6e73'] }).visual, true);
  });
  it('colors are hex only', () => {
    assert.equal(normalizeColor(' #0F6E73 '), '#0f6e73');
    assert.equal(normalizeColor('#abc'), '#abc');
    assert.equal(normalizeColor('teal'), null);
    assert.equal(normalizeColor('#12345'), null);
  });
  it('lists split on commas and lines, drop duplicates ignoring case, and cap', () => {
    assert.deepEqual(splitList('Nike, nike\nAdidas,, Puma', 2), ['Nike', 'Adidas']);
  });
  it('managers run the work but cannot manage the team or delete data', () => {
    assert.equal(can('manager', 'edit_profile'), true);
    assert.equal(can('manager', 'publish_profile'), true);
    assert.equal(can('manager', 'manage_team'), false);
    assert.equal(can('manager', 'delete_data'), false);
    assert.equal(can('owner', 'delete_data'), true);
  });
});
