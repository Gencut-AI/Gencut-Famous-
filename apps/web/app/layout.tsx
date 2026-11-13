import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
// Self-hosted variable font (weight, width and optical-size axes, OFL-1.1): no third-party font requests.
import '@fontsource-variable/bricolage-grotesque/standard.css';
import './globals.css';

/**
 * Absolute base for link-preview images and canonical URLs. Without it, Next
 * writes previews pointing at localhost, so links pasted on social apps show
 * no picture. The public domain if set, else this deployment's address.
 */
const base = (process.env.GENCUT_PUBLIC_URL || process.env.GENCUT_SITE_URL || '').trim();

export const metadata: Metadata = {
  title: { default: 'GenCut Famous', template: '%s · GenCut Famous' },
  description: 'Your AI marketing team: brand, channels, verified analytics and a media kit brands can trust.',
  applicationName: 'GenCut Famous',
  appleWebApp: { capable: true, title: 'GenCut', statusBarStyle: 'default' },
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
  ...(base ? { metadataBase: new URL(base) } : {}),
  openGraph: { siteName: 'GenCut Famous', title: 'GenCut Famous', description: 'Get booked for being you: your brand, your real numbers and a media kit brands can trust.' },
  twitter: { card: 'summary' },
};

export const viewport: Viewport = {
  themeColor: '#5b2be0',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
