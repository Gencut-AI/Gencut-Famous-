import type { MetricKey } from '../metrics/registry.ts';
import type { Platform } from '../platforms.ts';

/**
 * What a connector can and cannot do, declared up front. The Channels page
 * shows this to the creator before they connect, and the connection state is
 * computed from it, so a successful sign-in is never mistaken for every
 * capability working.
 */
export interface ConnectorManifest {
  readonly platform: Platform;
  /** `available`: built and wired. `planned`: on the roadmap; cannot be connected yet. */
  readonly build: 'available' | 'planned';
  readonly oauth: string;
  /** Scopes GenCut asks for; all of them are needed for a full connection. */
  readonly requiredScopes: readonly string[];
  /** The minimum scope set that still lets GenCut read the account. */
  readonly basicScopes: readonly string[];
  readonly accountTypes: readonly string[];
  readonly profileInfo: readonly string[];
  readonly analytics: readonly MetricKey[];
  readonly publishing: string;
  readonly tokens: string;
  readonly revocation: string;
  readonly rateLimits: string;
  readonly approval: string;
  readonly unsupported: readonly string[];
}

/** The seven states a creator sees for a connection. */
export const CONNECTION_STATES = [
  'connected',
  'partially_connected',
  'pending_approval',
  'expired',
  'revoked',
  'unsupported',
  'error',
] as const;
export type ConnectionState = (typeof CONNECTION_STATES)[number];

export const CONNECTION_STATE_LABELS: Readonly<Record<ConnectionState, string>> = {
  connected: 'Connected',
  partially_connected: 'Partially connected',
  pending_approval: 'Pending approval',
  expired: 'Expired',
  revoked: 'Disconnected',
  unsupported: 'Unsupported account',
  error: 'Error',
};

export interface ConnectionFacts {
  readonly grantedScopes: readonly string[];
  readonly accountType: string | null;
  readonly accessExpiresAt: Date | null;
  readonly revokedAt: Date | null;
  /** A failure that needs the creator (token refused, permission removed). Rate limits are not errors. */
  readonly authError: string | null;
}

/** The state of one stored connection, from what GenCut actually holds. Order matters: the first match wins. */
export function connectionState(m: ConnectorManifest, f: ConnectionFacts, now: Date): ConnectionState {
  if (f.revokedAt) return 'revoked';
  if (f.accountType !== null && !m.accountTypes.includes(f.accountType)) return 'unsupported';
  if (f.accessExpiresAt && f.accessExpiresAt.getTime() <= now.getTime()) return 'expired';
  if (f.authError) return 'error';
  const granted = new Set(f.grantedScopes);
  if (!m.basicScopes.every((s) => granted.has(s))) return 'error';
  if (!m.requiredScopes.every((s) => granted.has(s))) return 'partially_connected';
  return 'connected';
}

/** Scopes asked for but not granted, so the page can say exactly what is missing. */
export function missingScopes(m: ConnectorManifest, granted: readonly string[]): string[] {
  const have = new Set(granted);
  return m.requiredScopes.filter((s) => !have.has(s));
}
