import postgres from 'postgres';

/**
 * Open one short-lived connection and run `select 1`. On failure, log only the
 * error's code and kind (e.g. ENOTFOUND, ENETUNREACH, 28P01) so a broken
 * DATABASE_URL can be diagnosed from the function logs without printing it.
 */
export async function probeDatabase(url: string): Promise<boolean> {
  const sql = postgres(url, { max: 1, connect_timeout: 3, idle_timeout: 1, prepare: false });
  try {
    const rows = await sql`select 1 as ok`;
    return rows[0]?.ok === 1;
  } catch (e) {
    console.error(`gencut: database probe failed: ${describeDbError(e, url)}`);
    throw e;
  } finally {
    await sql.end({ timeout: 1 }).catch(() => undefined);
  }
}

/** Code, kind and host of a connection failure. Never the password or full URL. */
export function describeDbError(e: unknown, url: string): string {
  const err = e as { code?: unknown; errno?: unknown; message?: unknown };
  let host = 'unparseable-url';
  try {
    const u = new URL(url);
    host = `${u.hostname}:${u.port || '5432'} user=${u.username.split('.')[0]}${u.username.includes('.') ? '.<project>' : ''}`;
  } catch {
    // keep the placeholder
  }
  const code = typeof err.code === 'string' ? err.code : 'no-code';
  // Postgres auth and tenant errors carry a short, secret-free message; network errors do too.
  const message = typeof err.message === 'string' ? err.message.replace(/postgres(ql)?:\/\/\S+/g, '[url]').slice(0, 160) : '';
  return `code=${code} host=${host} message=${message}`;
}
