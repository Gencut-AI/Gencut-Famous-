import { PLATFORMS, PLATFORM_LABELS, type Platform, platformProfileUrl } from '../platforms.ts';

/**
 * Links a creator pastes to their own profiles elsewhere. They are links only:
 * no numbers come from them, and an account connected through the platform's
 * own sign-in takes their place on the media kit.
 */
export const LINK_KINDS = [...PLATFORMS, 'website'] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

export const SOCIAL_LINKS_MAX = 10;

export const LINK_KIND_LABELS: Readonly<Record<LinkKind, string>> = { ...PLATFORM_LABELS, website: 'Website' };

export interface SocialLink {
  readonly kind: LinkKind;
  /** Canonical https URL. */
  readonly url: string;
  /** What the button says after the platform name: "@name", or the site's host. */
  readonly label: string;
}

export type SocialLinkResult = { ok: true; link: SocialLink } | { ok: false; message: string };

const HOSTS: ReadonlyArray<[RegExp, Platform]> = [
  // Subdomains count too (vm.tiktok.com, business.facebook.com), so their share links are refused, not kept as websites.
  [/(^|\.)(instagram\.com|instagr\.am)$/, 'instagram'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)(x\.com|twitter\.com)$/, 'x'],
  [/(^|\.)threads\.(net|com)$/, 'threads'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'facebook'],
  [/(^|\.)linkedin\.com$/, 'linkedin'],
];

const RESERVED: Partial<Record<Platform, readonly string[]>> = {
  instagram: ['p', 'reel', 'reels', 'stories', 'explore', 'tv', 'accounts', 'direct', 'about'],
  x: ['home', 'i', 'intent', 'share', 'search', 'explore', 'hashtag', 'settings', 'messages', 'notifications'],
  facebook: ['sharer', 'sharer.php', 'share', 'watch', 'events', 'groups', 'marketplace', 'gaming', 'login', 'photo', 'photo.php', 'story.php', 'reel'],
};

const USERNAME: Partial<Record<Platform, RegExp>> = {
  instagram: /^[a-z0-9._]{1,30}$/i,
  tiktok: /^[a-z0-9._]{2,24}$/i,
  youtube: /^[a-z0-9._-]{3,30}$/i,
  x: /^[a-z0-9_]{1,15}$/i,
  threads: /^[a-z0-9._]{1,30}$/i,
  facebook: /^[a-z0-9.-]{2,50}$/i,
};

const PROFILE_HINT: Record<Platform, string> = {
  instagram: 'https://www.instagram.com/yourname',
  tiktok: 'https://www.tiktok.com/@yourname',
  youtube: 'https://www.youtube.com/@yourname',
  x: 'https://x.com/yourname',
  threads: 'https://www.threads.net/@yourname',
  facebook: 'https://www.facebook.com/yourname',
  linkedin: 'https://www.linkedin.com/in/yourname',
};

const notProfile = (p: Platform): SocialLinkResult => ({ ok: false, message: `That looks like a post or share link, not a profile. Use your profile link, like ${PROFILE_HINT[p]}` });

function handleLink(p: Platform, raw: string): SocialLinkResult {
  const name = decodeURIComponent(raw).replace(/^@/, '');
  const re = USERNAME[p];
  if (!name || (re && !re.test(name)) || RESERVED[p]?.includes(name.toLowerCase())) return notProfile(p);
  const url = platformProfileUrl(p, name);
  return url ? { ok: true, link: { kind: p, url, label: `@${name}` } } : notProfile(p);
}

function platformLink(p: Platform, u: URL): SocialLinkResult {
  const parts = u.pathname.split('/').filter(Boolean);
  const first = parts[0] ?? '';
  switch (p) {
    case 'instagram':
      return parts.length >= 1 && !u.hostname.endsWith('instagr.am') ? handleLink(p, first) : notProfile(p);
    case 'tiktok':
    case 'threads':
      return first.startsWith('@') ? handleLink(p, first) : notProfile(p);
    case 'x':
      return handleLink(p, first);
    case 'youtube': {
      if (u.hostname.endsWith('youtu.be')) return notProfile(p);
      if (first.startsWith('@')) return handleLink(p, first);
      if (['channel', 'c', 'user'].includes(first) && parts[1]) {
        const id = decodeURIComponent(parts[1]);
        if (!/^[a-z0-9._-]{2,64}$/i.test(id)) return notProfile(p);
        return { ok: true, link: { kind: p, url: `https://www.youtube.com/${first}/${encodeURIComponent(id)}`, label: first === 'channel' ? 'channel' : id } };
      }
      return notProfile(p);
    }
    case 'facebook': {
      if (first === 'profile.php') {
        const id = u.searchParams.get('id') ?? '';
        return /^\d{5,20}$/.test(id) ? { ok: true, link: { kind: p, url: `https://www.facebook.com/profile.php?id=${id}`, label: 'profile' } } : notProfile(p);
      }
      if (first === 'pages' && parts.length >= 2) {
        return { ok: true, link: { kind: p, url: `https://www.facebook.com/${parts.map(encodeURIComponent).join('/')}`, label: decodeURIComponent(parts[1] ?? 'page') } };
      }
      return handleLink(p, first);
    }
    case 'linkedin': {
      const name = decodeURIComponent(parts[1] ?? '');
      if (!['in', 'company'].includes(first) || !/^[a-z0-9%_-]{2,100}$/i.test(name)) return notProfile(p);
      return { ok: true, link: { kind: p, url: `https://www.linkedin.com/${first}/${encodeURIComponent(name)}`, label: name } };
    }
  }
}

/** Read one pasted profile link. Accepts links with or without https://; rejects posts, share links and bare @names. */
export function parseSocialLink(input: string): SocialLinkResult {
  let raw = input.trim().replace(/[),.;]+$/, '');
  if (!raw) return { ok: false, message: 'Paste a link.' };
  if (raw.startsWith('@')) return { ok: false, message: `Paste the full link to your profile, not just ${raw}. For example https://www.tiktok.com/${raw}` };
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, message: `"${input.trim().slice(0, 60)}" is not a link.` };
  }
  if (!['http:', 'https:'].includes(u.protocol) || !u.hostname.includes('.') || u.username || u.password) {
    return { ok: false, message: `"${input.trim().slice(0, 60)}" is not a link.` };
  }
  const host = u.hostname.toLowerCase().replace(/^(www|m|mobile|web)\./, '');
  const platform = HOSTS.find(([re]) => re.test(host))?.[1];
  if (platform) return platformLink(platform, u);
  u.protocol = 'https:';
  u.hash = '';
  const url = u.toString();
  if (url.length > 300) return { ok: false, message: 'That link is too long.' };
  return { ok: true, link: { kind: 'website', url, label: host } };
}

/**
 * Read a pasted list, one link per line (commas and spaces also separate).
 * Keeps the creator's order, drops repeats, and reports each line it could not use.
 */
export function parseSocialLinks(text: string): { links: SocialLink[]; problems: string[] } {
  const links: SocialLink[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const part of text.split(/[\s,]+/)) {
    if (!part.trim()) continue;
    const r = parseSocialLink(part);
    if (!r.ok) {
      problems.push(r.message);
      continue;
    }
    const key = r.link.url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    links.push(r.link);
  }
  if (links.length > SOCIAL_LINKS_MAX) problems.push(`Up to ${SOCIAL_LINKS_MAX} links.`);
  return { links, problems };
}
