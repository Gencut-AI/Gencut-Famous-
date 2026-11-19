/**
 * "Continue with Google" is shown only once the Google provider is switched on
 * in Supabase Auth and GENCUT_GOOGLE_SIGNIN=on is set, so a deploy never shows
 * a button that would fail (D-014).
 */
export function googleSignInEnabled(value: string | undefined = process.env.GENCUT_GOOGLE_SIGNIN): boolean {
  return value?.trim().toLowerCase() === 'on';
}
