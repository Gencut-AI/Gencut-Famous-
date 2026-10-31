import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { METRICS, METRIC_KEYS, type MetricPoint, combineAcrossPlatforms, growthOver } from '../src/index.ts';

const at = new Date('2026-10-31T12:00:00Z');
const p = (source: MetricPoint['source'], metric: MetricPoint['metric'], value: number | null, availability: MetricPoint['availability'] = 'available'): MetricPoint => ({
  source, metric, value, availability, periodStart: null, periodEnd: null, retrievedAt: at,
});

describe('metric registry', () => {
  it('defines every metric key, with a definition', () => {
    for (const k of METRIC_KEYS) assert.ok(METRICS[k].definition.length > 20, k);
  });
  it('never adds reach or accounts engaged across platforms', () => {
    assert.equal(combineAcrossPlatforms('reach', [p('instagram', 'reach', 100), p('youtube', 'reach', 50)]), null);
    assert.equal(combineAcrossPlatforms('accounts_engaged', [p('instagram', 'accounts_engaged', 10)]), null);
  });
  it('adds followers only from available readings, labelled as a platform-reported total, naming what is missing', () => {
    const c = combineAcrossPlatforms('followers', [p('instagram', 'followers', 1200), p('youtube', 'followers', 800), p('tiktok', 'followers', null, 'error')]);
    assert.ok(c);
    assert.equal(c.value, 2000);
    assert.deepEqual(c.sources, ['instagram', 'youtube']);
    assert.deepEqual(c.missing, ['tiktok']);
    assert.match(c.label, /Platform-reported total/);
    assert.match(c.label, /counted on each/);
  });
  it('returns nothing rather than zero when no reading is available', () => {
    assert.equal(combineAcrossPlatforms('followers', [p('instagram', 'followers', null, 'unavailable')]), null);
  });
});

describe('growth', () => {
  const day = (d: number) => new Date(Date.UTC(2026, 9, d, 6));
  it('compares the latest reading with the one about N days earlier', () => {
    const g = growthOver([{ value: 100, at: day(1) }, { value: 120, at: day(24) }, { value: 150, at: day(31) }], 7);
    assert.deepEqual(g && { from: g.from, to: g.to, change: g.change }, { from: 120, to: 150, change: 30 });
  });
  it('is unknown, not zero, when history is shorter than the window', () => {
    assert.equal(growthOver([{ value: 120, at: day(29) }, { value: 150, at: day(31) }], 7), null);
    assert.equal(growthOver([{ value: 150, at: day(31) }], 7), null);
  });
  it('skips missing readings', () => {
    const g = growthOver([{ value: 100, at: day(20) }, { value: null, at: day(24) }, { value: 130, at: day(31) }], 7);
    assert.equal(g?.change, 30);
  });
});
