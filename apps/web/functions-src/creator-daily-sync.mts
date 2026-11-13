/**
 * Hourly: take the daily snapshot for up to 3 connected channels not read in
 * the last 20 hours. Several runs a day cover every channel; growth history
 * depends on these snapshots (Instagram keeps account insights only 90 days).
 * Scheduled functions have a short time limit, hence the small batch.
 */
import { GraphInstagramApi, TokenCipher, UnifiedInstagramApi, createDb, syncAllDue } from '@gencut/services';

export const config = { schedule: '@hourly' };

export default async function handler(): Promise<Response> {
  const url = process.env.DATABASE_URL;
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const missing = ['DATABASE_URL', 'INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET', 'GENCUT_TOKEN_KEYS'].filter((k) => !process.env[k]);
  if (missing.length || !url || !appId || !appSecret) {
    return new Response(`Daily sync is off: missing ${missing.join(', ')}`, { status: 200 });
  }
  const cipher = TokenCipher.fromEnv(process.env.GENCUT_TOKEN_KEYS);
  if (!cipher) return new Response('Daily sync is off: no token key', { status: 200 });
  const sql = createDb(url, { max: 1 });
  try {
    const configId = process.env.INSTAGRAM_CONFIG_ID?.trim();
    const instagram = configId ? new UnifiedInstagramApi(appId, appSecret, configId) : new GraphInstagramApi(appId, appSecret);
    const results = await syncAllDue(sql, { instagram, cipher }, 3);
    return Response.json({ synced: results.map((r) => ({ status: r.status, readings: r.readings })) });
  } finally {
    await sql.end({ timeout: 5 });
  }
}
