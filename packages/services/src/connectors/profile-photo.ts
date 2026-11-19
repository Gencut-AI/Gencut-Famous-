import { MEDIA_MAX_BYTES } from '@gencut/core';

/** Hosts Instagram serves profile pictures from. Anything else is refused (no fetching arbitrary URLs). */
const PHOTO_HOSTS = ['.cdninstagram.com', '.fbcdn.net'];

/** Whether a profile picture address is an https Instagram or Facebook CDN address. */
export function isInstagramPhotoUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && PHOTO_HOSTS.some((h) => u.hostname.endsWith(h));
  } catch {
    return false;
  }
}

/**
 * Download a profile picture from Instagram's CDN: https only, Instagram hosts
 * only, 10-second timeout, at most MEDIA_MAX_BYTES. Null on any failure; the
 * caller's own image checks (type sniffing) still apply.
 */
export async function fetchInstagramPhoto(url: string, fetchFn: typeof fetch = fetch): Promise<Uint8Array | null> {
  if (!isInstagramPhotoUrl(url)) return null;
  try {
    const res = await fetchFn(url, { signal: AbortSignal.timeout(10_000), redirect: 'error' });
    if (!res.ok) return null;
    const declared = Number(res.headers.get('content-length') ?? '0');
    if (declared > MEDIA_MAX_BYTES) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return bytes.length > 0 && bytes.length <= MEDIA_MAX_BYTES ? bytes : null;
  } catch {
    return null;
  }
}
