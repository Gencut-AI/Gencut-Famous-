/** What every form action returns: idle, saved, or an error with field messages. Safe to import in the browser. */
export type FormState =
  | { status: 'idle' }
  | { status: 'saved'; message?: string; at: number }
  | { status: 'error'; message: string; fields: Record<string, string> };

export const idle: FormState = { status: 'idle' };
