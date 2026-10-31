import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Meta's `signed_request` (deauthorize and data-deletion callbacks):
 * base64url(HMAC-SHA256(payload, app secret)) "." base64url(JSON payload).
 * Returns the payload's user id only when the signature checks out.
 */
export function parseSignedRequest(signed: string | null | undefined, appSecret: string): { userId: string } | null {
  if (!signed || signed.length > 4000 || !appSecret) return null;
  const [sig, payload] = signed.split('.');
  if (!sig || !payload) return null;
  const want = createHmac('sha256', appSecret).update(payload).digest();
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { algorithm?: string; user_id?: unknown };
    if (String(data.algorithm ?? '').toUpperCase() !== 'HMAC-SHA256') return null;
    const userId = data.user_id === undefined ? '' : String(data.user_id);
    return /^\d{1,30}$/.test(userId) ? { userId } : null;
  } catch {
    return null;
  }
}
