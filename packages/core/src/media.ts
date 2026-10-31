/** Brand images a creator uploads. Type is decided from the file's bytes, never its name or the browser's claim. */
export const MEDIA_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type MediaContentType = (typeof MEDIA_CONTENT_TYPES)[number];

export const MEDIA_KINDS = ['logo', 'profile_photo', 'content_example'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_MAX_BYTES = 5 * 1024 * 1024;
export const CONTENT_EXAMPLES_MAX = 12;

export function sniffImageType(bytes: Uint8Array): MediaContentType | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}
