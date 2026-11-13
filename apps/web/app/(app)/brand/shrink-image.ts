/**
 * Shrink a picked image in the browser before it is uploaded, so phone photos
 * (often 3–8 MB) stay well under the hosting request limit. Logos keep PNG for
 * transparency; everything else becomes JPEG. Returns the original file when it
 * is already small or the browser cannot decode it (the server still checks it).
 */
export const UPLOAD_TARGET_BYTES = 1_500_000;
const MAX_SIDE = 2000;

export async function shrinkImage(file: File, keepPng: boolean): Promise<File> {
  if (file.size <= UPLOAD_TARGET_BYTES && file.type !== 'image/heic') return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const g = canvas.getContext('2d');
  if (!g) return file;
  g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const png = keepPng && file.type === 'image/png';
  for (const quality of [0.86, 0.75, 0.6]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, png ? 'image/png' : 'image/jpeg', quality));
    if (!blob) return file;
    if (blob.size <= UPLOAD_TARGET_BYTES || png || quality === 0.6) {
      const name = file.name.replace(/\.[a-z0-9]+$/i, '') + (png ? '.png' : '.jpg');
      return new File([blob], name, { type: blob.type, lastModified: Date.now() });
    }
  }
  return file;
}
