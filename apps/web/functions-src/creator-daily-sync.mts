/**
 * Every 15 minutes: take the daily snapshot for connected channels not read in
 * the last 20 hours. Growth history depends on these snapshots (Instagram keeps
 * account insights only 90 days). Scheduled functions stop at 30 seconds, so a
 * run stops claiming new channels after 18 seconds; one channel takes a few
 * seconds, so 96 runs a day cover several hundred channels. Runs that overlap
 * never take the same channel (syncAllDue claims each one).
 */
import { GraphInstagramApi, TokenCipher, UnifiedInstagramApi, createDb, fetchInstagramPhoto, syncAllDue } from '@gencut/services';

export const config = { schedule: '*/15 * * * *' };

/** Stop claiming new channels after this long, leaving room under the 30-second limit. */
const BUDGET_MS = 18_000;

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
    const results = await syncAllDue(sql, { instagram, cipher, fetchPhoto: (u) => fetchInstagramPhoto(u) }, { budgetMs: BUDGET_MS });
    return Response.json({ synced: results.map((r) => ({ status: r.status, readings: r.readings })) });
  } finally {
    await sql.end({ timeout: 5 });
  }
}
