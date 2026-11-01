/**
 * The one-time code from the sign-in email, as typed or pasted. Supabase codes
 * are 6 digits by default and configurable up to 10, so accept 6–10 digits and
 * ignore the spaces and dashes people add when copying.
 */
export function normalizeOtpCode(raw: string | null | undefined): string | null {
  const code = String(raw ?? '').replace(/[\s-]/g, '');
  return /^\d{6,10}$/.test(code) ? code : null;
}
