import type { SVGProps } from 'react';

/** GenCut Famous line icons: 24px grid, 1.8 stroke, round joins. Drawn for this app. */
const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props,
});

export const Icons = {
  home: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" /></svg>
  ),
  brand: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M12 3.5c.6 3.8 2.1 5.9 6.5 6.6-4.4.7-5.9 2.8-6.5 6.6-.6-3.8-2.1-5.9-6.5-6.6 4.4-.7 5.9-2.8 6.5-6.6z" /><path d="M18 16.5c.3 1.6.9 2.4 2.5 2.7-1.6.3-2.2 1.1-2.5 2.7" /></svg>
  ),
  channels: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><circle cx="7" cy="12" r="3.5" /><circle cx="17" cy="7" r="3" /><circle cx="17" cy="17" r="3" /><path d="m10.2 10.5 3.9-2.1M10.2 13.5l3.9 2.1" /></svg>
  ),
  analytics: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M5 20V12M10 20V6M15 20v-9M20 20V9" /></svg>
  ),
  kit: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><circle cx="9" cy="10.5" r="2.2" /><path d="M5.8 16.5c.7-1.7 1.8-2.5 3.2-2.5s2.5.8 3.2 2.5M14.5 9.5h3.5M14.5 13h3.5" /></svg>
  ),
  inbox: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="m4 7 8 6 8-6" /></svg>
  ),
  team: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19c.8-3.1 2.8-4.7 5.5-4.7s4.7 1.6 5.5 4.7" /><path d="M15.5 6a3 3 0 0 1 0 5.6M17.5 14.6c1.6.6 2.6 2 3 4.4" /></svg>
  ),
  more: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><circle cx="5.5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="18.5" cy="12" r="1.3" /></svg>
  ),
  plus: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
  ),
  external: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base({ width: 16, height: 16, ...p })}><path d="M9 5H5.5A1.5 1.5 0 0 0 4 6.5v12A1.5 1.5 0 0 0 5.5 20h12a1.5 1.5 0 0 0 1.5-1.5V15M14 4h6v6M20 4l-9 9" /></svg>
  ),
  send: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M20 4 9.5 14.5M20 4l-6.5 16-4-5.5L4 10.5z" /></svg>
  ),
};

/** The GenCut Famous mark: a royal-purple tile with a sparkle and a pink dot. */
export function Mark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="120" fill="#5b2be0" />
      <path d="M236 120c10 62 34 96 104 108-70 12-94 46-104 108-10-62-34-96-104-108 70-12 94-46 104-108z" fill="#fff" />
      <circle cx="350" cy="352" r="34" fill="#ff4f9a" />
    </svg>
  );
}

export function Wordmark({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Mark size={size} />
      <span className="display text-[1.35rem] font-bold tracking-[-0.03em]">
        GenCut <span className="text-royal">Famous</span>
      </span>
    </span>
  );
}
