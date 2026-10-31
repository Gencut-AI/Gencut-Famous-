
import { getPublishedProfile } from '@gencut/services';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { publicBase } from '../../../lib/connectors.ts';
import { db } from '../../../lib/db.ts';
import { ProfileView } from './profile-view.tsx';
import { VisitBeacon } from './visit-beacon.tsx';

export const dynamic = 'force-dynamic';

const load = cache((handle: string) => getPublishedProfile(db(), decodeURIComponent(handle)));

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const p = await load((await params).handle);
  if (!p) return { title: 'Not found', robots: { index: false } };
  const url = `${await publicBase()}/@${p.handle}`;
  const description = (p.headline ?? p.bio ?? `${p.publicName}'s media kit`).slice(0, 200);
  return {
    title: { absolute: `${p.publicName} (@${p.handle}) · Media kit` },
    description,
    alternates: { canonical: url },
    openGraph: { type: 'profile', url, title: `${p.publicName} · Media kit`, description, siteName: 'GenCut for Creators', username: p.handle },
    twitter: { card: 'summary_large_image', title: `${p.publicName} · Media kit`, description },
  };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const p = await load((await params).handle);
  if (!p) notFound();
  const base = await publicBase();
  // Structured data: only what the page itself shows.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    dateModified: p.updatedAt.toISOString(),
    mainEntity: {
      '@type': 'Person',
      name: p.publicName,
      alternateName: `@${p.handle}`,
      ...(p.bio ? { description: p.bio } : {}),
      ...(p.photoId ? { image: `${base}/public-media/${p.photoId}` } : {}),
      url: `${base}/@${p.handle}`,
      sameAs: p.links.flatMap((l) => (l.url ? [l.url] : [])),
      ...(p.niches.length ? { knowsAbout: p.niches } : {}),
    },
  };
  return (
    <main className="min-h-dvh">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <VisitBeacon handle={p.handle} />
      <ProfileView p={p} />
    </main>
  );
}
