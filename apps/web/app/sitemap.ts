import { listPublishedHandles } from '@gencut/services';
import type { MetadataRoute } from 'next';
import { db } from '../lib/db.ts';

export const dynamic = 'force-dynamic';

/** Published media kits only. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.GENCUT_PUBLIC_URL || process.env.GENCUT_SITE_URL || '').replace(/\/+$/, '');
  if (!base || !process.env.DATABASE_URL) return [];
  const handles = await listPublishedHandles(db());
  return [{ url: `${base}/`, changeFrequency: 'monthly' }, ...handles.map((h) => ({ url: `${base}/@${h.handle}`, lastModified: h.updatedAt, changeFrequency: 'weekly' as const }))];
}
