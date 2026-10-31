import { readFileSync } from 'node:fs';
import type { NextConfig } from 'next';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

const config: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them with the app.
  transpilePackages: ['@gencut/core', '@gencut/services'],
  poweredByHeader: false,
  // Brand images go through a server action; the service caps them at 5 MB.
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
  reactStrictMode: true,
  // Public media kits live at /@handle.
  async rewrites() {
    return [{ source: '/@:handle', destination: '/p/:handle' }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'x-content-type-options', value: 'nosniff' },
          { key: 'referrer-policy', value: 'strict-origin-when-cross-origin' },
          { key: 'x-frame-options', value: 'DENY' },
          { key: 'permissions-policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  env: {
    GENCUT_VERSION: pkg.version,
    GENCUT_COMMIT: process.env.COMMIT_REF ?? process.env.GITHUB_SHA ?? '',
    GENCUT_SITE_URL: process.env.CONTEXT === 'production' ? (process.env.URL ?? '') : (process.env.DEPLOY_PRIME_URL ?? ''),
  },
};

export default config;
