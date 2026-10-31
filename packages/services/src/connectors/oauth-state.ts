import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Platform } from '@gencut/core';

/**
 * The OAuth `state` parameter: signed, short-lived, and tied to the user, the
 * creator workspace and a nonce that the web layer also keeps in an HttpOnly
 * cookie, so a callback can only finish the connection that this browser started.
 */
export interface OAuthState {
  readonly platform: Platform;
  readonly workspaceId: string;
  readonly userId: string;
  readonly nonce: string;
  readonly expiresAt: number;
}

export const OAUTH_STATE_MINUTES = 10;

const b64 = (b: Buffer) => b.toString('base64url');

export function newNonce(): string {
  return b64(randomBytes(18));
}

export function signState(secret: string, s: OAuthState): string {
  const body = b64(Buffer.from(JSON.stringify([s.platform, s.workspaceId, s.userId, s.nonce, s.expiresAt])));
  const sig = b64(createHmac('sha256', secret).update(body).digest());
  return `${body}.${sig}`;
}

/** The state if the signature is right and it has not expired; otherwise null. */
export function verifyState(secret: string, raw: string | null | undefined, now = Date.now()): OAuthState | null {
  if (!raw || raw.length > 1000) return null;
  const [body, sig] = raw.split('.');
  if (!body || !sig) return null;
  const want = createHmac('sha256', secret).update(body).digest();
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const [platform, workspaceId, userId, nonce, expiresAt] = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as [Platform, string, string, string, number];
    if (typeof expiresAt !== 'number' || expiresAt <= now) return null;
    return { platform, workspaceId, userId, nonce, expiresAt };
  } catch {
    return null;
  }
}
