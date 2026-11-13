/**
 * Health report for /api/health. Pure: the database probe is injected so the
 * logic is testable without a server. Never includes connection strings or
 * error text — only states.
 */
export type DatabaseState = 'reachable' | 'unreachable' | 'not_configured';

export interface Health {
  readonly status: 'ok' | 'degraded';
  readonly version: string;
  readonly commit: string | null;
  readonly database: DatabaseState;
  /** Whether new-inquiry emails can be sent (RESEND_API_KEY and GENCUT_EMAIL_FROM set). Never the values. */
  readonly inquiryEmail: 'on' | 'off';
  readonly checkedAt: string;
}

export type DatabaseProbe = (url: string) => Promise<boolean>;

export async function getHealth(
  env: Readonly<Record<string, string | undefined>>,
  probe: DatabaseProbe,
  now: () => Date = () => new Date(),
): Promise<Health> {
  const url = env.DATABASE_URL?.trim();
  let database: DatabaseState = 'not_configured';
  if (url) {
    try {
      database = (await probe(url)) ? 'reachable' : 'unreachable';
    } catch {
      database = 'unreachable';
    }
  }
  return {
    status: database === 'unreachable' ? 'degraded' : 'ok',
    version: env.GENCUT_VERSION || '0.0.0',
    commit: env.GENCUT_COMMIT ? env.GENCUT_COMMIT.slice(0, 12) : null,
    database,
    inquiryEmail: env.RESEND_API_KEY?.trim() && env.GENCUT_EMAIL_FROM?.trim() ? 'on' : 'off',
    checkedAt: now().toISOString(),
  };
}
