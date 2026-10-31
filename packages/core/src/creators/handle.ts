import { type Result, err, ok } from '../result.ts';

/**
 * Public handles: gencut.ai/@handle. Lowercase letters, digits, dots and
 * underscores, like the major social networks, so creators can keep the handle
 * they already use. Reserved words protect app routes and impersonation-prone names.
 */
export const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9._]{1,28}[a-z0-9])$/;

export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  'admin', 'administrator', 'api', 'app', 'auth', 'billing', 'blog', 'brand', 'brands', 'careers', 'channels',
  'contact', 'creator', 'creators', 'dashboard', 'data', 'data-deletion', 'docs', 'gencut', 'gencut.ai', 'gencutai',
  'help', 'home', 'inquiries', 'invite', 'legal', 'login', 'logout', 'media', 'meta', 'news', 'official', 'onboarding',
  'p', 'press', 'pricing', 'privacy', 'profile', 'properties', 'root', 'security', 'settings', 'sign-in', 'signin',
  'signup', 'staff', 'status', 'support', 'system', 'team', 'terms', 'verified', 'www',
]);

/** Normalize what a person typed: trim, drop a leading @, lowercase. */
export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase();
}

export type HandleError = 'invalid_handle' | 'reserved_handle';

export function validateHandle(raw: string): Result<string, HandleError> {
  const handle = normalizeHandle(raw);
  if (!HANDLE_PATTERN.test(handle) || /[._]{2}/.test(handle)) {
    return err('invalid_handle', 'Use 3–30 letters, numbers, dots or underscores, starting and ending with a letter or number.');
  }
  if (RESERVED_HANDLES.has(handle)) return err('reserved_handle', 'That handle is reserved. Try another.');
  return ok(handle);
}
