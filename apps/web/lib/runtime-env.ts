/**
 * Environment values the health report needs. Each is read as a literal
 * `process.env.NAME` so Next.js can inline build-time values (GENCUT_VERSION,
 * GENCUT_COMMIT from next.config.ts); passing `process.env` as a whole object
 * would skip that inlining.
 */
export function healthEnv(): Record<string, string | undefined> {
  return {
    DATABASE_URL: process.env.DATABASE_URL,
    GENCUT_VERSION: process.env.GENCUT_VERSION,
    GENCUT_COMMIT: process.env.GENCUT_COMMIT,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    GENCUT_EMAIL_FROM: process.env.GENCUT_EMAIL_FROM,
  };
}
