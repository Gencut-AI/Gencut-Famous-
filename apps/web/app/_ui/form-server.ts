import 'server-only';
import { isServiceError } from '@gencut/services';
import type { FormState } from './form.ts';

/** Turn an expected service failure into form state; rethrow anything else (a bug). */
export function toFormError(e: unknown): FormState {
  if (isServiceError(e)) return { status: 'error', message: e.message, fields: { ...e.fields } };
  throw e;
}
