/** The visitor's network address as the edge reports it; used only inside a one-way hash, never stored. */
export function clientAddress(h: Headers): string {
  return h.get('x-nf-client-connection-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown';
}

/** Secret for visitor hashes. Falls back to a fixed development value only outside production. */
export function visitSecret(): string {
  const s = process.env.GENCUT_VISIT_SECRET?.trim();
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('GENCUT_VISIT_SECRET is not configured.');
  return 'development-only-visit-secret-not-for-production';
}
