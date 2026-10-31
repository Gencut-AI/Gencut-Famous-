import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.GENCUT_PUBLIC_URL || process.env.GENCUT_SITE_URL || '').replace(/\/+$/, '');
  return {
    rules: [{ userAgent: '*', allow: ['/', '/@', '/p/'], disallow: ['/home', '/brand', '/channels', '/analytics', '/page', '/inquiries', '/team', '/more', '/invite', '/api', '/media'] }],
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
