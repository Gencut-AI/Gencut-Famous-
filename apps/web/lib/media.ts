import type { MediaFile } from '@gencut/services';

/** Serve an image with headers that stop it being treated as anything else. */
export function imageResponse(file: MediaFile, cache: string): Response {
  return new Response(Buffer.from(file.bytes), {
    headers: {
      'content-type': file.contentType,
      'cache-control': cache,
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'",
    },
  });
}
