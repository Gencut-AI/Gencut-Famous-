import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { commandFromModel, inquiryConsentText, normalizeReferral, parseCommand, referrerHost } from '../src/index.ts';

describe('assistant parser', () => {
  const cases: Array<[string, string | null]> = [
    ['How did my week perform?', 'week'],
    ['how am i doing', 'week'],
    ['What content performed best?', 'top_content'],
    ['show me my top posts', 'top_content'],
    ['How many followers do I have?', 'followers'],
    ['which accounts are connected', 'connections'],
    ['send me my media kit', 'profile_link'],
    ['any new inquiries?', 'inquiries'],
    ['help', 'help'],
    ['write me a caption about tacos', null],
    ['', null],
  ];
  for (const [text, want] of cases) it(`"${text}" → ${want}`, () => assert.equal(parseCommand(text), want));

  it('accepts a model choice only when it names a known command', () => {
    assert.equal(commandFromModel({ command: 'week' }), 'week');
    assert.equal(commandFromModel({ command: 'send_dm' }), null);
    assert.equal(commandFromModel('week'), null);
  });
});

describe('inquiry helpers', () => {
  it('names the creator in the consent text', () => assert.match(inquiryConsentText('Maya Rivera'), /Maya Rivera and their team may reply/));
  it('keeps referral tags to short words', () => {
    assert.equal(normalizeReferral('Instagram'), 'instagram');
    assert.equal(normalizeReferral('https://evil.example'), null);
    assert.equal(normalizeReferral(null), null);
  });
  it('stores only the referring host, never our own', () => {
    assert.equal(referrerHost('https://www.instagram.com/p/abc?x=1', 'gencut.ai'), 'instagram.com');
    assert.equal(referrerHost('https://gencut.ai/@maya', 'gencut.ai'), null);
    assert.equal(referrerHost('not a url', null), null);
  });
});
