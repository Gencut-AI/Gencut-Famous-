import type { MetricKey } from '../metrics/registry.ts';
import type { ConnectorManifest } from './manifest.ts';

/**
 * Instagram API with Instagram Login (graph.instagram.com).
 * Sources (read 31 Oct 2026):
 * https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login
 * https://developers.facebook.com/docs/instagram-platform/api-reference/instagram-user/insights
 * https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights/
 */
export const INSTAGRAM_SCOPES = ['instagram_business_basic', 'instagram_business_manage_insights'] as const;

/**
 * Meta names the same permissions differently per login: Instagram Login uses
 * instagram_business_*, Unified Login and Facebook Login use the older names.
 * Granted scopes are stored exactly as Meta returned them; checks read them
 * through this map (Meta's own migration table pairs them one to one).
 */
export const INSTAGRAM_SCOPE_EQUIVALENTS: Readonly<Record<string, (typeof INSTAGRAM_SCOPES)[number]>> = {
  instagram_basic: 'instagram_business_basic',
  instagram_manage_insights: 'instagram_business_manage_insights',
};

/** Granted scopes plus the GenCut names they stand for, so either login's grants pass the same checks. */
export function effectiveInstagramScopes(granted: readonly string[]): string[] {
  const out = new Set(granted);
  for (const s of granted) {
    const same = INSTAGRAM_SCOPE_EQUIVALENTS[s];
    if (same) out.add(same);
  }
  return [...out].sort();
}

/** A missing permission named the way this connection's login names it. */
export function instagramScopeLabel(scope: string, granted: readonly string[]): string {
  const unified = granted.some((s) => s in INSTAGRAM_SCOPE_EQUIVALENTS);
  if (!unified) return scope;
  return Object.entries(INSTAGRAM_SCOPE_EQUIVALENTS).find(([, v]) => v === scope)?.[0] ?? scope;
}

export const INSTAGRAM: ConnectorManifest = {
  platform: 'instagram',
  build: 'available',
  oauth: 'Meta sign-in (OAuth 2.0 code flow). The creator signs in with Instagram or Facebook on Meta\'s own page and chooses the account; GenCut never sees the password.',
  requiredScopes: INSTAGRAM_SCOPES,
  basicScopes: ['instagram_business_basic'],
  accountTypes: ['BUSINESS', 'MEDIA_CREATOR'],
  profileInfo: ['Username', 'Profile picture', 'Account type', 'Followers', 'Following', 'Post count'],
  analytics: ['followers', 'following', 'posts', 'reach', 'views', 'accounts_engaged', 'interactions', 'likes', 'comments', 'shares', 'saves'],
  publishing: 'Not in this version. Publishing needs the separate content-publish permission and Meta App Review.',
  tokens: 'Meta issues a token for the chosen account. Business tokens do not expire; a 60-day token is renewed automatically before it runs out. If renewal fails, the creator reconnects.',
  revocation: 'GenCut deletes its copy of the token at once. The creator can also remove GenCut under Instagram → Settings → Website permissions → Apps and websites, or in Meta Business settings.',
  rateLimits: 'Meta limits calls per account per hour. GenCut reads each account at most every 15 minutes, plus one daily snapshot.',
  approval: 'Until Meta approves GenCut through App Review (Advanced Access), only accounts added as testers on GenCut\'s Meta app can connect.',
  unsupported: [
    'Personal Instagram accounts (switch to a Creator or Business account in Instagram settings)',
    'Insights on carousel posts (Meta returns none; likes and comment counts are shown instead)',
    'Account insights older than the first daily snapshot (growth history starts when you connect)',
    'Audience demographics (Meta returns them only above 100 followers; not read in this version)',
  ],
};

/** Scopes from the token exchange: a comma-separated string or an array. */
export function parseGrantedScopes(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw.map(String) : typeof raw === 'string' ? raw.split(',') : [];
  return [...new Set(list.map((s) => s.trim()).filter(Boolean))].sort();
}

/** Account-level insights read with metric_type=total_value, mapped to GenCut metrics. */
export const IG_ACCOUNT_INSIGHTS: ReadonlyArray<{ api: string; metric: MetricKey }> = [
  { api: 'reach', metric: 'reach' },
  { api: 'views', metric: 'views' },
  { api: 'accounts_engaged', metric: 'accounts_engaged' },
  { api: 'total_interactions', metric: 'interactions' },
];

/** Post-level insights per media product type. Carousels (album media) have none. */
export const IG_MEDIA_INSIGHTS: Readonly<Record<string, ReadonlyArray<{ api: string; metric: MetricKey }>>> = {
  FEED: [
    { api: 'views', metric: 'views' },
    { api: 'reach', metric: 'reach' },
    { api: 'likes', metric: 'likes' },
    { api: 'comments', metric: 'comments' },
    { api: 'shares', metric: 'shares' },
    { api: 'saved', metric: 'saves' },
    { api: 'total_interactions', metric: 'interactions' },
  ],
  REELS: [
    { api: 'views', metric: 'views' },
    { api: 'reach', metric: 'reach' },
    { api: 'likes', metric: 'likes' },
    { api: 'comments', metric: 'comments' },
    { api: 'shares', metric: 'shares' },
    { api: 'saved', metric: 'saves' },
    { api: 'total_interactions', metric: 'interactions' },
  ],
};

/**
 * Read `{ data: [{ name, total_value: { value } }] }` or `{ data: [{ name, values: [{ value }] }] }`
 * into a map. A metric the platform left out is absent from the map, never zero.
 */
export function parseInsights(body: unknown): Map<string, number> {
  const out = new Map<string, number>();
  const data = (body as { data?: unknown })?.data;
  if (!Array.isArray(data)) return out;
  for (const item of data) {
    const name = (item as { name?: unknown }).name;
    if (typeof name !== 'string') continue;
    const total = (item as { total_value?: { value?: unknown } }).total_value?.value;
    const first = (item as { values?: Array<{ value?: unknown }> }).values?.[0]?.value;
    const v = typeof total === 'number' ? total : typeof first === 'number' ? first : null;
    if (v !== null && Number.isFinite(v)) out.set(name, v);
  }
  return out;
}

/** Instagram media product type for insights: FEED, REELS, STORY, or AD; album media is CAROUSEL_ALBUM in media_type. */
export function insightsKind(mediaType: string | null, productType: string | null): 'FEED' | 'REELS' | null {
  if (mediaType === 'CAROUSEL_ALBUM') return null;
  if (productType === 'REELS') return 'REELS';
  if (productType === 'FEED' || productType === null) return 'FEED';
  return null;
}
