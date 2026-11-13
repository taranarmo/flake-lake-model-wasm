const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
require(path.join(ROOT, 'wasm-base64.js'));
const FLakeEngine = require(path.join(ROOT, 'flake-engine.js'));

async function createReadyEngine() {
  const engine = new FLakeEngine();
  await engine.init();
  return engine;
}

describe('FLakeEngine WebAssembly initialization & exports', () => {
  it('initializes cleanly via Base64 fallback', async () => {
    const engine = await createReadyEngine();
    assert.equal(engine.isReady, true);
    assert.ok(engine.instance.exports.flake_interface, 'flake_interface export must exist');
    assert.ok(engine.instance.exports.memory, 'memory export must exist');
    assert.ok(engine.instance.exports.__heap_base, '__heap_base export must exist');
  });

  it('instantiates directly from flake.wasm binary buffer', async () => {
    const wasmBytes = fs.readFileSync(path.join(ROOT, 'flake.wasm'));
    const imports = {
      env: {
        _lfortran_datan: Math.atan,
        _lfortran_dlog: Math.log,
        _lfortran_get_default_allocator: () => 0,
        exp: Math.exp,
        pow: Math.pow,
        _lcompilers_snprintf_alloc: () => 0,
        _lcompilers_runtime_error_exit: (code) => {
          throw new Error(`Unexpected runtime error exit: ${code}`);
        },
        _lcompilers_runtime_error: (msg) => {
          throw new Error(`Unexpected runtime error: ${msg}`);
        },
        exit: (code) => {
          throw new Error(`Unexpected exit: ${code}`);
        }
      }
    };
    const { instance } = await WebAssembly.instantiate(wasmBytes, imports);
    assert.equal(typeof instance.exports.flake_interface, 'function');
    assert.equal(typeof instance.exports.__module_sfcflx_sfcflx_spechum, 'function');
    assert.equal(typeof instance.exports.__module_sfcflx_sfcflx_lwradatm, 'function');
  });
});

describe('FLakeEngine parameters, presets, and stepping', () => {
  it('updates lake parameters and syncs linear memory pointers', async () => {
    const engine = await createReadyEngine();
    engine.setLakeParameters({ depth: 22.5, fetch: 3500.0, extinWater: 0.45 });

    assert.equal(engine.lakeDepth, 22.5);
    assert.equal(engine.fetch, 3500.0);
    assert.equal(engine.extinWater, 0.45);
    assert.equal(engine.memView.getFloat64(engine.ptrs.depth_w, true), 22.5);
    assert.equal(engine.memView.getFloat64(engine.ptrs.fetch, true), 3500.0);
    assert.equal(engine.memView.getFloat64(engine.ptrs.opticpar_water + 88, true), 0.45);
  });

  it('resets state across all seasonal presets with consistent clocks', async () => {
    const engine = await createReadyEngine();
    engine.setLakeParameters({ depth: 10.0, fetch: 1500.0, extinWater: 1.0 });

    const expectations = {
      summer: { dayOfYear: 190, minHice: 0, maxHice: 0 },
      autumn: { dayOfYear: 285, minHice: 0, maxHice: 0 },
      winter: { dayOfYear: 15, minHice: 0.01, maxHice: 0.1 },
      spring: { dayOfYear: 100, minHice: 0, maxHice: 0 }
    };

    for (const [preset, exp] of Object.entries(expectations)) {
      engine.resetState(preset);
      assert.equal(engine.simulatedHours, 0);
      assert.equal(engine.hourOfDay, 12);
      assert.equal(engine.dayOfYear, exp.dayOfYear);
      assert.ok(engine.state.hice >= exp.minHice && engine.state.hice <= exp.maxHice);
      assert.ok(engine.state.hML >= 0 && engine.state.hML <= 10.0);
    }
  });

  it('advances clock across day and year boundaries', async () => {
    const engine = await createReadyEngine();
    engine.resetState('summer');
    engine.dayOfYear = 365;
    engine.hourOfDay = 21;

    engine.step({ T_air: 15, solar: 0, wind: 3, del_time: 21600 }); // +6h -> day 1, 03:00
    assert.equal(engine.simulatedHours, 6);
    assert.equal(engine.dayOfYear, 1);
    assert.equal(engine.hourOfDay, 3);
  });

  it('supports 72-hour diurnal summer run without NaN or divergence', async () => {
    const engine = await createReadyEngine();
    engine.setLakeParameters({ depth: 15.0, fetch: 2000.0, extinWater: 0.8 });

    for (let hour = 0; hour < 72; hour++) {
      const hourOfDay = hour % 24;
      const solar = hourOfDay >= 6 && hourOfDay <= 18
        ? 600 * Math.sin(((hourOfDay - 6) / 12) * Math.PI)
        : 0;
      const airTemp = 18 + 5 * Math.sin(((hourOfDay - 9) / 24) * 2 * Math.PI);
      const wind = 3.5 + 1.5 * Math.cos((hourOfDay / 24) * 2 * Math.PI);

      const res = engine.step({ T_air: airTemp, solar, wind, snowRate: 0.0 });
      for (const key of ['Tsfc', 'TwML', 'Tbot', 'Tmnw', 'hML', 'CT', 'hice']) {
        assert.ok(Number.isFinite(res[key]), `${key} must be finite at hour ${hour}`);
      }
      assert.ok(res.Tsfc > -5 && res.Tsfc < 45, `Tsfc out of bounds: ${res.Tsfc}`);
      assert.ok(res.hML >= 0 && res.hML <= 15.0, `hML out of bounds: ${res.hML}`);
    }
  });

  it('handles sub-zero forcing and ice growth cleanly', async () => {
    const engine = await createReadyEngine();
    engine.setLakeParameters({ depth: 8.0, fetch: 1000.0, extinWater: 1.0 });
    engine.resetState('winter');

    for (let h = 0; h < 240; h++) {
      engine.step({ T_air: -12.0, solar: 40.0, wind: 5.0, snowRate: 0.00001 });
    }
    assert.ok(Number.isFinite(engine.state.hice) && engine.state.hice > 0.02);
    assert.ok(engine.state.Tsfc <= 0.01);
  });
});

describe('FLakeEngine profiles, regimes, and isolated runners', () => {
  it('computes valid self-similarity vertical temperature profiles', async () => {
    const engine = await createReadyEngine();
    engine.setLakeParameters({ depth: 20.0, fetch: 2000.0, extinWater: 0.6 });
    engine.setState({
      Tsfc: 18.0, TwML: 18.0, Tbot: 5.0, Tmnw: 12.0,
      hML: 5.0, CT: 0.65, hice: 0.0, Tice: 0.0, hsnow: 0.0, Tsnow: 0.0
    });

    const prof = engine.getVerticalProfile(40);
    assert.equal(prof.waterProfile.length, 41);
    assert.equal(prof.waterProfile[0].depth, 0);
    assert.equal(prof.waterProfile[40].depth, 20.0);
    assert.equal(prof.waterProfile[0].temp, 18.0);
    assert.ok(Math.abs(prof.waterProfile[40].temp - 5.0) < 1e-9);
    // All points inside mixed layer (z <= 5m) must equal TwML
    for (const pt of prof.waterProfile) {
      assert.ok(Number.isFinite(pt.temp));
      if (pt.depth <= 5.0) {
        assert.equal(pt.temp, 18.0);
      }
    }
  });

  it('classifies thermal regimes accurately', async () => {
    const engine = await createReadyEngine();
    engine.setLakeParameters({ depth: 15.0, fetch: 2000.0, extinWater: 1.0 });

    engine.setState({ Tsfc: -2, TwML: 0.5, Tbot: 3.9, Tmnw: 2.0, hML: 2.0, CT: 0.55, hice: 0.1, Tice: -2, hsnow: 0, Tsnow: 0 });
    assert.equal(engine.getRegime().label, 'Ice-Covered');

    engine.setState({ Tsfc: 6, TwML: 6.0, Tbot: 5.9, Tmnw: 5.95, hML: 15.0, CT: 0.5, hice: 0, Tice: 0, hsnow: 0, Tsnow: 0 });
    assert.equal(engine.getRegime().label, 'Full Homothermy (Turnover)');

    engine.setState({ Tsfc: 20, TwML: 20.0, Tbot: 6.0, Tmnw: 13.0, hML: 4.0, CT: 0.65, hice: 0, Tice: 0, hsnow: 0, Tsnow: 0 });
    assert.equal(engine.getRegime().label, 'Direct Stratification');

    engine.setState({ Tsfc: 1, TwML: 1.0, Tbot: 3.8, Tmnw: 2.4, hML: 3.0, CT: 0.55, hice: 0, Tice: 0, hsnow: 0, Tsnow: 0 });
    assert.equal(engine.getRegime().label, 'Inverse Stratification');
  });

  it('runDirectCalculation isolates state and restores live simulation', async () => {
    const engine = await createReadyEngine();
    engine.setLakeParameters({ depth: 12.0, fetch: 1500.0, extinWater: 1.0 });
    engine.resetState('summer');
    engine.step({ T_air: 22, solar: 500, wind: 3 });

    const beforeState = { ...engine.state };
    const beforeHours = engine.simulatedHours;
    const beforeDay = engine.dayOfYear;
    const beforeHour = engine.hourOfDay;

    const calc = engine.runDirectCalculation(
      { Tsfc: 8.0, TwML: 8.0, Tbot: 4.0, Tmnw: 6.0, hML: 2.0, CT: 0.5 },
      { T_air: 25.0, solar: 700.0, wind: 2.0, del_time: 3600.0 },
      { depth: 30.0, fetch: 5000.0, extinWater: 0.3 },
      4
    );

    assert.equal(calc.numSteps, 4);
    assert.equal(calc.stepHistory.length, 4);
    assert.equal(calc.profile.waterProfile.length, 61);
    assert.equal(calc.profile.lakeDepth, 30.0);
    assert.ok(Number.isFinite(calc.delta.Tsfc));

    // Live state and lake parameters must be restored
    assert.deepEqual(engine.state, beforeState);
    assert.equal(engine.lakeDepth, 12.0);
    assert.equal(engine.fetch, 1500.0);
    assert.equal(engine.extinWater, 1.0);
    assert.equal(engine.simulatedHours, beforeHours);
    assert.equal(engine.dayOfYear, beforeDay);
    assert.equal(engine.hourOfDay, beforeHour);
  });

  it('runTimeSeries runs multi-step series and returns complete history', async () => {
    const engine = await createReadyEngine();
    const series = Array.from({ length: 12 }, (_, i) => ({
      T_air: 15 + i * 0.2,
      solar: 300,
      wind: 4.0,
      del_time: 3600,
      dayOfYear: 180,
      hourOfDay: i
    }));

    const out = engine.runTimeSeries(series, { depth: 10.0, fetch: 1000.0, extinWater: 0.9, lat: 48.0 });
    assert.equal(out.totalSteps, 12);
    assert.equal(out.history.length, 12);
    assert.ok(out.history.every(h => Number.isFinite(h.Tsfc) && Number.isFinite(h.hML)));
  });

  it('runPerpetualYear converges on Müggelsee and restores par_Coriolis', async () => {
    const perpPath = path.join(ROOT, 'model/data/perpetual/mueggelsee.json');
    const perpData = JSON.parse(fs.readFileSync(perpPath, 'utf8'));
    const engine = await createReadyEngine();
    const origCoriolis = engine.memView.getFloat64(engine.ptrs.par_Coriolis, true);

    const res = engine.runPerpetualYear(perpData.steps, {
      depth: 7.5,
      fetch: 2000.0,
      extinWater: 1.0,
      lat: 52.0
    }, { maxIterations: 5, tol: 0.05 });

    assert.equal(res.converged, true);
    assert.ok(res.cycles <= 5);
    assert.equal(res.history.length, 2920);
    assert.ok(res.diagnostics.minTsfc <= res.diagnostics.meanTsfc);
    assert.ok(res.diagnostics.meanTsfc <= res.diagnostics.maxTsfc);
    assert.equal(engine.memView.getFloat64(engine.ptrs.par_Coriolis, true), origCoriolis);
  });

  it('matches IGB Berlin CGI reference (01460140) when local benchmark fixture is present', async (t) => {
    const cgiMeteoPath = path.join(ROOT, 'igb-flake-setup/000flake/flake/cgi-bin/01460140');
    const cgiRsltPath = path.join(ROOT, 'igb-flake-setup/000flake/flake/cgi-bin/01460140.rslt');
    if (!fs.existsSync(cgiMeteoPath) || !fs.existsSync(cgiRsltPath)) {
      t.skip('igb-flake-setup external fixture not present in this environment');
      return;
    }

    const meteoLines = fs.readFileSync(cgiMeteoPath, 'utf8').trim().split('\n');
    const rsltLines = fs.readFileSync(cgiRsltPath, 'utf8').trim().split('\n');
    const engine = await createReadyEngine();
    engine.setLakeParameters({ depth: 7.5, fetch: 2000.0, extinWater: 1.0 });

    const K = 273.15;
    const mv = engine.memView;
    const p = engine.ptrs;
    mv.setFloat64(p.par_Coriolis, 2.0 * 7.292115e-5 * Math.sin((49.0 * Math.PI) / 180.0), true);
    mv.setFloat64(p.depth_bs, 3.0, true);
    mv.setFloat64(p.T_bs, 4.0 + K, true);
    mv.setFloat64(p.del_time, 10800.0, true);

    const T0 = 3.17869863013699;
    engine.setState({ Tsfc: T0, TwML: T0, Tbot: T0, Tmnw: T0, hML: 0.0, CT: 0.5, hice: 0.0, Tice: 0.0, hsnow: 0.0, Tsnow: 0.0 });
    mv.setFloat64(p.H_B1_in, 3.0, true);
    mv.setFloat64(p.T_B1_in, 4.0 + K, true);

    let sumDiffTs = 0;
    let maxDiffHice = 0;
    let nSteps = 0;
    for (let step = 1; step <= 2919; step++) {
      const parts = meteoLines[step].trim().split(/\s+/).map(Number);
      if (parts.length < 5) continue;
      const [solar, Tair, ea, wind, cl] = parts;
      const res = engine.step({ T_air: Tair, solar: Math.max(0.0, solar), wind, ea, cl, del_time: 10800.0 });

      const refParts = rsltLines[step + 2].trim().split(/\s+/).map(Number);
      const expectedTs = refParts[19] > 0.0 ? refParts[21] : refParts[2];
      sumDiffTs += Math.abs(res.Tsfc - expectedTs);
      maxDiffHice = Math.max(maxDiffHice, Math.abs(res.hice - refParts[19]));
      nSteps++;
    }

    assert.ok(sumDiffTs / nSteps < 1.5);
    assert.ok(maxDiffHice < 0.15);
  });
});
