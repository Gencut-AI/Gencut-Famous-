import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LINK_KINDS, LINK_KIND_LABELS, PLATFORMS, SOCIAL_LINKS_MAX, parseSocialLink, parseSocialLinks } from '../src/index.ts';

const ok = (raw: string) => {
  const r = parseSocialLink(raw);
  if (!r.ok) throw new Error(`expected ${raw} to parse: ${r.message}`);
  return r.link;
};
const bad = (raw: string) => {
  const r = parseSocialLink(raw);
  assert.equal(r.ok, false, `expected ${raw} to be refused`);
  return r.ok ? '' : r.message;
};

describe('pasted social links', () => {
  it('reads profile links as people copy them from each app', () => {
    assert.deepEqual(ok('https://www.instagram.com/christian.esd/?igsh=MWx4Y2'), { kind: 'instagram', url: 'https://www.instagram.com/christian.esd/', label: '@christian.esd' });
    assert.deepEqual(ok('instagram.com/christian.esd'), { kind: 'instagram', url: 'https://www.instagram.com/christian.esd/', label: '@christian.esd' });
    assert.deepEqual(ok('https://www.tiktok.com/@christian.esd?_t=8abc&_r=1'), { kind: 'tiktok', url: 'https://www.tiktok.com/@christian.esd', label: '@christian.esd' });
    assert.deepEqual(ok('https://m.youtube.com/@ChristianESD/videos'), { kind: 'youtube', url: 'https://www.youtube.com/@ChristianESD', label: '@ChristianESD' });
    assert.equal(ok('https://www.youtube.com/channel/UC1234567890abcdefghij').url, 'https://www.youtube.com/channel/UC1234567890abcdefghij');
    assert.deepEqual(ok('https://twitter.com/christian_esd'), { kind: 'x', url: 'https://x.com/christian_esd', label: '@christian_esd' });
    assert.equal(ok('https://www.threads.com/@christian.esd').url, 'https://www.threads.net/@christian.esd');
    assert.equal(ok('https://www.facebook.com/christian.esd').url, 'https://www.facebook.com/christian.esd');
    assert.equal(ok('https://www.facebook.com/profile.php?id=100012345678').url, 'https://www.facebook.com/profile.php?id=100012345678');
    assert.equal(ok('https://www.linkedin.com/in/christian-esd/').url, 'https://www.linkedin.com/in/christian-esd');
    assert.equal(ok('https://www.linkedin.com/company/esd/').label, 'esd');
  });

  it('keeps any other https site as a website link, labelled by its host', () => {
    assert.deepEqual(ok('esd.me'), { kind: 'website', url: 'https://esd.me/', label: 'esd.me' });
    assert.deepEqual(ok('http://linktr.ee/christian#top'), { kind: 'website', url: 'https://linktr.ee/christian', label: 'linktr.ee' });
  });

  it('refuses posts, share links and bare @names, saying what to paste instead', () => {
    assert.match(bad('https://www.instagram.com/p/C1abcDEF/'), /profile link, like https:\/\/www\.instagram\.com/);
    assert.match(bad('https://www.instagram.com/reel/C1abc/'), /not a profile/);
    assert.match(bad('https://www.tiktok.com/t/ZTabc/'), /not a profile/);
    assert.match(bad('https://vm.tiktok.com/ZMabc/'), /not a profile/);
    assert.match(bad('https://youtu.be/dQw4w9WgXcQ'), /not a profile/);
    assert.match(bad('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), /not a profile/);
    assert.match(bad('https://x.com/i/status/123'), /not a profile/);
    assert.match(bad('https://www.facebook.com/sharer/sharer.php?u=x'), /not a profile/);
    assert.match(bad('@christian'), /full link/);
    assert.match(bad('hello'), /not a link/);
    assert.match(bad('javascript:alert(1)'), /not a link/);
    assert.match(bad('https://user:pass@example.com'), /not a link/);
  });

  it('reads a pasted list in order, one per line, dropping repeats and naming each line it cannot use', () => {
    const r = parseSocialLinks('https://instagram.com/maya\n\nhttps://www.instagram.com/maya/, https://www.tiktok.com/@maya\nhttps://www.instagram.com/p/x/');
    assert.deepEqual(r.links.map((l) => l.kind), ['instagram', 'tiktok']);
    assert.equal(r.problems.length, 1);
    assert.equal(parseSocialLinks('').links.length, 0);
    const many = Array.from({ length: SOCIAL_LINKS_MAX + 1 }, (_, i) => `https://site${i}.example.com`).join('\n');
    assert.match(parseSocialLinks(many).problems.join(' '), /Up to 10/);
  });

  it('has a label for every kind, and the kinds are the platforms plus website', () => {
    assert.deepEqual([...LINK_KINDS], [...PLATFORMS, 'website']);
    for (const k of LINK_KINDS) assert.ok(LINK_KIND_LABELS[k]);
  });
});
