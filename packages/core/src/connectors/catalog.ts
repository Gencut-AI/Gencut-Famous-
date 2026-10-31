import type { Platform } from '../platforms.ts';
import { INSTAGRAM } from './instagram.ts';
import type { ConnectorManifest } from './manifest.ts';

const planned = (platform: Platform, oauth: string, approval: string): ConnectorManifest => ({
  platform,
  build: 'planned',
  oauth,
  requiredScopes: [],
  basicScopes: [],
  accountTypes: [],
  profileInfo: [],
  analytics: [],
  publishing: 'Not built yet.',
  tokens: 'Not built yet.',
  revocation: 'Not built yet.',
  rateLimits: 'Not built yet.',
  approval,
  unsupported: ['Everything, until this connector is built'],
});

/** Every platform in the order the Channels page lists them. Only `available` ones can be connected. */
export const CONNECTORS: readonly ConnectorManifest[] = [
  INSTAGRAM,
  planned('youtube', 'Google OAuth 2.0 (YouTube Data and Analytics APIs, read-only).', 'Google OAuth verification before the public can connect.'),
  planned('tiktok', 'TikTok Login Kit.', 'TikTok app review for each scope.'),
  planned('threads', 'Threads API on GenCut\'s Meta app.', 'Meta App Review.'),
  planned('facebook', 'Facebook Login for Business (Pages).', 'Meta App Review and business verification.'),
  planned('linkedin', 'LinkedIn Community Management API.', 'LinkedIn Standard tier review.'),
  planned('x', 'X API OAuth 2.0.', 'Paid API access (billed per call); deferred.'),
];

export function connectorFor(platform: Platform): ConnectorManifest {
  const m = CONNECTORS.find((c) => c.platform === platform);
  if (!m) throw new Error(`No connector manifest for ${platform}`);
  return m;
}
