const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const FLakeEngine = require(path.join(ROOT, 'flake-engine.js'));

let appApi = null;

before(() => {
  const code = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  let captured = null;

  const sandbox = {
    console,
    Math,
    Date,
    Number,
    String,
    Array,
    Object,
    Float64Array,
    JSON,
    Map,
    Set,
    RegExp,
    Error,
    isNaN,
    parseFloat,
    parseInt,
    performance,
    FLakeEngine,
    window: { addEventListener: () => {} },
    document: {
      readyState: 'complete',
      getElementById: () => ({
        getContext: () => ({}),
        addEventListener: () => {},
        querySelectorAll: () => []
      }),
      createElement: () => ({}),
      addEventListener: () => {}
    },
    globalThis: {},
    __FLAKE_TEST_HOOK__: (api) => {
      captured = api;
    }
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox, { filename: 'app.js' });
  assert.ok(captured, 'app.js test hook should capture exported helpers');
  appApi = captured;
});

describe('app.js UI & limnological formatting helpers', () => {
  it('escapeHtml escapes HTML meta-characters and handles nullish inputs', () => {
    assert.equal(appApi.escapeHtml(null), '');
    assert.equal(appApi.escapeHtml(undefined), '');
    assert.equal(
      appApi.escapeHtml(`<script>alert("x" & 'y')</script>`),
      '&lt;script&gt;alert(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;'
    );
  });

  it('getClarityInfo classifies all five trophic regimes', () => {
    assert.equal(appApi.getClarityInfo(0.15).badge, 'Ultra-Oligotrophic');
    assert.equal(appApi.getClarityInfo(0.40).badge, 'Oligotrophic (Clear)');
    assert.equal(appApi.getClarityInfo(0.70).badge, 'Mesotrophic (Moderate)');
    assert.equal(appApi.getClarityInfo(1.20).badge, 'Eutrophic (Productive)');
    assert.equal(appApi.getClarityInfo(2.50).badge, 'Dystrophic / Turbid');
    // Clamps non-positive extinction without division by zero
    assert.ok(Number.isFinite(Number(appApi.getClarityInfo(0).secchi)));
  });

  it('getSimulatedDateString formats day-of-year and hour boundaries', () => {
    assert.equal(appApi.getSimulatedDateString(1, 0), 'Day 1 (Jan 01) 00:00');
    assert.equal(appApi.getSimulatedDateString(365, 23), 'Day 365 (Dec 31) 23:00');
    assert.equal(appApi.getSimulatedDateString(null, null), 'Day 1 (Jan 01) 00:00');
  });

  it('getHydrologicalYearDates respects Oct 5 cutoff', () => {
    const beforeCutoff = appApi.getHydrologicalYearDates(new Date(Date.UTC(2026, 9, 4)));
    assert.equal(beforeCutoff.startYear, 2024);
    assert.equal(beforeCutoff.endYear, 2025);

    const afterCutoff = appApi.getHydrologicalYearDates(new Date(Date.UTC(2026, 9, 6)));
    assert.equal(afterCutoff.startYear, 2025);
    assert.equal(afterCutoff.endYear, 2026);
  });

  it('getDepthTickInterval scales monotonically with lake depth', () => {
    const ticks = [5, 12, 30, 60, 150, 400, 900, 1600].map(d => appApi.getDepthTickInterval(d));
    for (let i = 1; i < ticks.length; i++) {
      assert.ok(ticks[i] >= ticks[i - 1]);
    }
  });
});

describe('app.js planetary harmonic climatology helpers', () => {
  it('interpolateHarmonics handles exact match, IDW interpolation, antimeridian, and lapse rate', () => {
    const harmonics = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'model/data/climatology_harmonics.json'), 'utf8')
    );

    // Exact grid point (-55, -80)
    const exact = appApi.interpolateHarmonics(-55, -80, harmonics, 0);
    assert.equal(exact.length, 12);
    assert.equal(exact[0], 6.75);

    // Environmental lapse rate: -6.5 C per 1000 m
    const elevated = appApi.interpolateHarmonics(-55, -80, harmonics, 1000);
    assert.ok(Math.abs(elevated[0] - (6.75 - 6.5)) < 1e-9);

    // Interpolated mid-latitude point
    const berlin = appApi.interpolateHarmonics(52.43, 13.63, harmonics, 0);
    assert.equal(berlin.length, 12);
    assert.ok(berlin.every(Number.isFinite));

    // Near antimeridian
    const fiji = appApi.interpolateHarmonics(65.0, 179.9, harmonics, 0);
    assert.equal(fiji.length, 12);
    assert.ok(fiji.every(Number.isFinite));

    assert.equal(appApi.interpolateHarmonics(0, 0, null), null);
  });

  it('generateHarmonicPerpetualSeries emits deterministic 2920-step hydrological-year forcing', () => {
    const harmonics = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'model/data/climatology_harmonics.json'), 'utf8')
    );
    const params = appApi.interpolateHarmonics(52.43, 13.63, harmonics, 40);
    const s1 = appApi.generateHarmonicPerpetualSeries(52.43, 13.63, params);
    const s2 = appApi.generateHarmonicPerpetualSeries(52.43, 13.63, params);

    assert.equal(s1.timeStepSec, 10800);
    assert.equal(s1.steps.length, 2920);
    assert.deepEqual(s1, s2);
    assert.equal(s1.steps[0].dayOfYear, 274); // Oct 1
    assert.equal(s1.steps[0].hourOfDay, 0);

    let solarSum = 0;
    for (const step of s1.steps) {
      assert.ok(step.solar >= 0 && Number.isFinite(step.solar));
      assert.ok(Number.isFinite(step.T_air));
      assert.ok(step.wind >= 0.2 && Number.isFinite(step.wind));
      assert.ok(step.cl >= 0 && step.cl <= 1);
      solarSum += step.solar;
    }
    const meanSolar = solarSum / s1.steps.length;
    assert.ok(Math.abs(meanSolar - params[7]) < 0.2, `Expected annual solar mean ~${params[7]}, got ${meanSolar}`);
  });

  it('generateSynopticClimateSeries builds valid series for recent30 and year modes', () => {
    const recent = appApi.generateSynopticClimateSeries(52.0, 13.0, 'recent30');
    assert.equal(recent.provider, 'Offline Climatology');
    assert.equal(recent.steps.length, 30 * 24);
    assert.ok(recent.steps.every(s => Number.isFinite(s.T_air) && s.solar >= 0 && s.wind >= 0.2));

    const y2024 = appApi.generateSynopticClimateSeries(-33.9, 18.4, '2024');
    assert.equal(y2024.steps.length, 365 * 24);
  });
});

describe('app.js custom meteorological text parser (parseMeteorologicalText)', () => {
  it('parses 6-column FLake .DAT files skipping comments', () => {
    const dat = [
      '! FLake forcing test',
      '# step solar Tair ea wind cloud',
      '1 120.5 14.2 11.0 3.4 0.4',
      '2 0.0   9.8  9.5  0.1 0.8'
    ].join('\n');

    const res = appApi.parseMeteorologicalText(dat, 'test.dat');
    assert.equal(res.detectedFormat, 'FLake 6-col .DAT');
    assert.equal(res.rowCount, 2);
    assert.equal(res.steps[0].solar, 120.5);
    assert.equal(res.steps[0].T_air, 14.2);
    assert.equal(res.steps[0].wind, 3.4);
    assert.equal(res.steps[1].wind, 0.2); // wind floor 0.2 m/s
  });

  it('parses 5-column and 4-column headerless formats', () => {
    const fiveCol = '250 18 12 4.0 0.25\n0 11 9 2.0 0.9';
    const r5 = appApi.parseMeteorologicalText(fiveCol, 'five.dat');
    assert.equal(r5.detectedFormat, 'FLake 5-col .DAT');
    assert.equal(r5.rowCount, 2);
    assert.equal(r5.steps[0].solar, 250);

    const fourCol = '300 20 3.0 0.5\n10 15 1.5 0.2';
    const r4 = appApi.parseMeteorologicalText(fourCol, 'four.txt');
    assert.equal(r4.rowCount, 2);
    assert.equal(r4.steps[0].T_air, 20);
  });

  it('parses CSV with headers, RH percentage, and cloud percentage/oktas', () => {
    const csv = [
      'step,solar,temp,rh,wind,cloud',
      '1,400,20,65,3.0,50',
      '2,200,15,0.8,2.5,4'
    ].join('\n');

    const res = appApi.parseMeteorologicalText(csv, 'custom.csv');
    assert.equal(res.detectedFormat, 'CSV (with header)');
    assert.equal(res.rowCount, 2);
    assert.ok(res.steps[0].q_air > 0.005 && res.steps[0].q_air < 0.02);
    assert.ok(res.steps[0].Q_lw > 200 && res.steps[0].Q_lw < 500);
  });

  it('parses semicolon CSV and TSV files', () => {
    const semi = 'step;solar;tair;ea;wind;cloud\n1;100;12;10;2.0;0.3';
    const rSemi = appApi.parseMeteorologicalText(semi, 'euro.csv');
    assert.equal(rSemi.rowCount, 1);
    assert.equal(rSemi.steps[0].T_air, 12);

    const tsv = '1\t150\t16\t12\t3.2\t0.5';
    const rTsv = appApi.parseMeteorologicalText(tsv, 'tab.tsv');
    assert.equal(rTsv.detectedFormat, 'TSV');
    assert.equal(rTsv.rowCount, 1);
  });

  it('throws descriptive errors on empty or invalid files', () => {
    assert.throws(() => appApi.parseMeteorologicalText('! only comments\n# nothing'), /empty or contains only comments/i);
    assert.throws(() => appApi.parseMeteorologicalText('1,2'), /No numerical forcing records/i);
  });
});
