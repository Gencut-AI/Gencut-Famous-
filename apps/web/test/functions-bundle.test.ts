import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';
import { bundleFunctions } from '../scripts/bundle-functions.ts';

const out = mkdtempSync(join(tmpdir(), 'gencut-functions-'));
after(() => rmSync(out, { recursive: true, force: true }));

describe('Netlify function bundles', () => {
  it('are self-contained: no workspace or TypeScript imports left for the runtime to resolve', async () => {
    const files = await bundleFunctions(out);
    assert.ok(files.some((f) => f.endsWith('creator-daily-sync.mjs')));
    for (const f of files) {
      const code = readFileSync(f, 'utf8');
      assert.doesNotMatch(code, /from\s*["']@gencut\//, `${f} still imports a workspace package`);
      assert.doesNotMatch(code, /from\s*["'][^"']+\.m?ts["']/, `${f} still imports a TypeScript file`);
    }
  });

  it('the daily sync declares its schedule and stays off, naming what is missing, without settings', async () => {
    const mod = (await import(pathToFileURL(join(out, 'creator-daily-sync.mjs')).href)) as { config: { schedule: string }; default: () => Promise<Response> };
    assert.equal(mod.config.schedule, '@hourly');
    const saved = { ...process.env };
    for (const k of ['DATABASE_URL', 'INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET', 'GENCUT_TOKEN_KEYS']) delete process.env[k];
    try {
      const res = await mod.default();
      assert.match(await res.text(), /missing DATABASE_URL, INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, GENCUT_TOKEN_KEYS/);
    } finally {
      Object.assign(process.env, saved);
    }
  });
});
