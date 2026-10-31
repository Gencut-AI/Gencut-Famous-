/** Social platforms GenCut may connect, plus GenCut's own public profile page as a data source. */
export const PLATFORMS = ['instagram', 'youtube', 'tiktok', 'facebook', 'threads', 'linkedin', 'x'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Readonly<Record<Platform, string>> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  threads: 'Threads',
  linkedin: 'LinkedIn',
  x: 'X',
};

/** A data source shown next to every figure: a platform, or GenCut's own records. */
export type MetricSource = Platform | 'gencut';

export const SOURCE_LABELS: Readonly<Record<MetricSource, string>> = { ...PLATFORM_LABELS, gencut: 'GenCut' };

/** Public profile URL for a handle on a platform, for "Follow me everywhere" links. Null when unknown. */
export function platformProfileUrl(platform: Platform, handle: string): string | null {
  const h = encodeURIComponent(handle.replace(/^@/, ''));
  switch (platform) {
    case 'instagram':
      return `https://www.instagram.com/${h}/`;
    case 'youtube':
      return `https://www.youtube.com/@${h}`;
    case 'tiktok':
      return `https://www.tiktok.com/@${h}`;
    case 'threads':
      return `https://www.threads.net/@${h}`;
    case 'x':
      return `https://x.com/${h}`;
    case 'facebook':
      return `https://www.facebook.com/${h}`;
    case 'linkedin':
      return `https://www.linkedin.com/in/${h}`;
  }
}
