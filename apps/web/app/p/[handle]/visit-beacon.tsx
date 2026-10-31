'use client';

import { useEffect } from 'react';

/** Counts one visit after the page loads in a real browser. Crawlers that do not run scripts are not counted. */
export function VisitBeacon({ handle }: { handle: string }) {
  useEffect(() => {
    const body = JSON.stringify({ handle, src: new URLSearchParams(window.location.search).get('src'), referrer: document.referrer || null });
    if (!navigator.sendBeacon?.('/api/visit', new Blob([body], { type: 'application/json' }))) {
      fetch('/api/visit', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => undefined);
    }
  }, [handle]);
  return null;
}
