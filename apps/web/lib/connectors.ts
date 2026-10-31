import 'server-only';
import { type ConnectorDeps, GraphInstagramApi, TokenCipher } from '@gencut/services';
import { headers } from 'next/headers';
import { signInRedirectOrigin } from './site-url.ts';

/**
 * Connector settings from the platform secret store. Connecting stays off,
 * and says so, until every one of them is set: GenCut never stores a token
 * unencrypted or signs state with a default secret.
 */
export function connectorDeps(): ConnectorDeps | null {
  const appId = process.env.INSTAGRAM_APP_ID?.trim();
  const appSecret = process.env.INSTAGRAM_APP_SECRET?.trim();
  const cipher = TokenCipher.fromEnv(process.env.GENCUT_TOKEN_KEYS);
  if (!appId || !appSecret || !cipher || !stateSecret()) return null;
  return { instagram: new GraphInstagramApi(appId, appSecret), cipher };
}

export function missingConnectorSettings(): string[] {
  const names = ['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET', 'GENCUT_TOKEN_KEYS', 'GENCUT_STATE_SECRET'] as const;
  return names.filter((n) => !process.env[n]?.trim());
}

export function stateSecret(): string | null {
  const s = process.env.GENCUT_STATE_SECRET?.trim();
  return s && s.length >= 32 ? s : null;
}

/** Instagram app access: 'testers' until Meta App Review approves GenCut, then 'public'. */
export function instagramAccess(): 'testers' | 'public' {
  return process.env.GENCUT_INSTAGRAM_ACCESS === 'public' ? 'public' : 'testers';
}

/** This deployment's own origin (build-time on Netlify, the request's locally). */
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  return signInRedirectOrigin(process.env.GENCUT_SITE_URL, h.get('x-forwarded-host') ?? h.get('host'), h.get('x-forwarded-proto')) ?? '';
}

/** The public base for profile links: the configured public domain, else this deployment. */
export async function publicBase(): Promise<string> {
  return (process.env.GENCUT_PUBLIC_URL?.trim() || (await siteOrigin())).replace(/\/+$/, '');
}
