const fs = require('fs');
const path = require('path');
const assert = require('assert');

// 1. Load base64 fallback
require('./wasm-base64.js');
const FLakeEngine = require('./flake-engine.js');

async function runTests() {
  console.log("=== FLake WebAssembly Test Suite (LFortran 0.68.0) ===");

  // Test 1: Instantiate via base64 fallback
  console.log("\n[Test 1] Initializing FLakeEngine with Base64 fallback...");
  const engineB64 = new FLakeEngine();
  await engineB64.init();
  assert.strictEqual(engineB64.isReady, true, "Engine should be ready after init");
  console.log("✓ Engine initialized successfully via Base64.");

  // Test 2: Instantiate directly with binary flake.wasm
  console.log("\n[Test 2] Initializing FLakeEngine directly with flake.wasm buffer...");
  const wasmBuffer = fs.readFileSync(path.join(__dirname, 'flake.wasm'));
  const engineBin = new FLakeEngine();

  // Custom mock init for direct buffer testing
  const imports = {
    env: {
      _lfortran_datan: Math.atan,
      _lfortran_dlog: Math.log,
      _lfortran_get_default_allocator: () => 0,
      exp: Math.exp,
      pow: Math.pow,
      _lcompilers_snprintf_alloc: () => 0,
      _lcompilers_runtime_error_exit: (code) => console.error("FLake WASM runtime error exit:", code),
      _lcompilers_runtime_error: (msg) => console.error("FLake WASM runtime error:", msg),
      exit: (code) => console.warn("FLake WASM exit called with code:", code)
    }
  };
  const { instance } = await WebAssembly.instantiate(wasmBuffer, imports);
  assert.ok(instance.exports.flake_interface, "flake_interface export must exist");
  assert.ok(instance.exports.memory, "memory export must exist");
  console.log("✓ Direct flake.wasm instantiation succeeded with all imports resolved.");

  // Test 3: Diurnal 72-hour simulation run
  console.log("\n[Test 3] Running 72-hour summer diurnal simulation...");
  const engine = new FLakeEngine();
  await engine.init();
  engine.setLakeParameters({ depth: 15.0, fetch: 2000.0, extinWater: 0.8 });

  const initialTsfc = engine.state.Tsfc;
  console.log(`  Initial conditions: Tsfc=${initialTsfc.toFixed(2)}°C, TwML=${engine.state.TwML.toFixed(2)}°C, Tbot=${engine.state.Tbot.toFixed(2)}°C, hML=${engine.state.hML.toFixed(2)}m`);

  const tStart = performance.now();
  for (let hour = 0; hour < 72; hour++) {
    const hourOfDay = hour % 24;
    // Simple diurnal solar radiation curve
    const solar = hourOfDay >= 6 && hourOfDay <= 18
      ? 600 * Math.sin(((hourOfDay - 6) / 12) * Math.PI)
      : 0;
    const airTemp = 18 + 5 * Math.sin(((hourOfDay - 9) / 24) * 2 * Math.PI);
    const wind = 3.5 + 1.5 * Math.cos((hourOfDay / 24) * 2 * Math.PI);

    const res = engine.step({
      T_air: airTemp,
      solar: solar,
      wind: wind,
      snowRate: 0.0
    });

    // Validations
    assert(!Number.isNaN(res.Tsfc), `Tsfc is NaN at hour ${hour}`);
    assert(!Number.isNaN(res.TwML), `TwML is NaN at hour ${hour}`);
    assert(!Number.isNaN(res.Tbot), `Tbot is NaN at hour ${hour}`);
    assert(!Number.isNaN(res.hML), `hML is NaN at hour ${hour}`);
    assert(res.Tsfc > -5 && res.Tsfc < 45, `Tsfc out of bounds: ${res.Tsfc}`);
    assert(res.TwML > -5 && res.TwML < 45, `TwML out of bounds: ${res.TwML}`);
    assert(res.hML >= 0 && res.hML <= 15.1, `hML out of lake depth bounds: ${res.hML}`);
  }
  const totalElapsed = performance.now() - tStart;
  console.log(`  Completed 72 timesteps in ${totalElapsed.toFixed(2)} ms (${(totalElapsed / 72).toFixed(3)} ms/step)`);
  console.log(`  Final state: Tsfc=${engine.state.Tsfc.toFixed(2)}°C, TwML=${engine.state.TwML.toFixed(2)}°C, Tbot=${engine.state.Tbot.toFixed(2)}°C, hML=${engine.state.hML.toFixed(2)}m`);
  console.log("✓ Continuous thermodynamic step simulation passed without NaN or divergences.");

  // Test 4: Vertical profile calculation
  console.log("\n[Test 4] Verifying vertical temperature profile calculation...");
  const resProfile = engine.getVerticalProfile(30);
  assert.ok(resProfile.waterProfile, "waterProfile should exist");
  assert.strictEqual(resProfile.waterProfile.length, 31, "Profile should contain 31 points (0..30)");
  assert.strictEqual(resProfile.waterProfile[0].depth, 0, "Top point depth must be 0");
  assert.strictEqual(resProfile.waterProfile[resProfile.waterProfile.length - 1].depth, 15.0, "Bottom point depth must match lake depth");
  for (const pt of resProfile.waterProfile) {
    assert(!Number.isNaN(pt.temp), `Profile temp at depth ${pt.depth} is NaN`);
  }
  console.log(`  Surface temp: ${resProfile.waterProfile[0].temp.toFixed(2)}°C, Bottom temp: ${resProfile.waterProfile[resProfile.waterProfile.length - 1].temp.toFixed(2)}°C`);
  console.log("✓ Vertical temperature profile generated successfully.");

  // Test 5: Winter ice growth simulation
  console.log("\n[Test 5] Running freezing atmospheric forcing (winter ice test)...");
  const winterEngine = new FLakeEngine();
  await winterEngine.init();
  winterEngine.setLakeParameters({ depth: 8.0, fetch: 1000.0, extinWater: 1.0 });

  // Cool down lake to near freezing
  for (let h = 0; h < 240; h++) {
    winterEngine.step({
      T_air: -12.0,
      solar: 40.0,
      wind: 5.0,
      snowRate: 0.00001
    });
  }
  assert(!Number.isNaN(winterEngine.state.hice), "Ice thickness should not be NaN");
  assert(winterEngine.state.hice >= 0, "Ice thickness must be non-negative");
  console.log(`  After 10 days of subzero forcing: hice=${(winterEngine.state.hice * 100).toFixed(2)} cm, Tsfc=${winterEngine.state.Tsfc.toFixed(2)}°C`);
  console.log("✓ Ice thermodynamics evaluated without error.");

  console.log("\n==========================================");
  console.log(" ALL TESTS PASSED SUCCESSFULLY! ");
  console.log("==========================================");
}

runTests().catch(err => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
