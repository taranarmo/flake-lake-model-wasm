/**
 * FLake WebAssembly Simulation Engine
 * Wrapper around FLake (Freshwater Lake model) compiled with LFortran.
 */

class FLakeEngine {
  constructor() {
    this.instance = null;
    this.memory = null;
    this.memView = null;
    this.ptrs = {};
    this.isReady = false;

    // Default lake parameters
    this.lakeDepth = 12.0;       // meters
    this.fetch = 1500.0;         // wind fetch in meters
    this.extinWater = 1.0;       // light extinction coeff (1/m)
    this.timeStepSec = 3600.0;   // 1 hour
    this.simulatedHours = 0;

    // Simulation time tracking
    this.dayOfYear = 150;        // starting ~ end of May
    this.hourOfDay = 12;

    // Current state outputs
    this.state = {
      Tsfc: 14.0,
      TwML: 14.0,
      Tmnw: 9.5,
      Tbot: 4.2,
      hML: 3.5,
      CT: 0.65,
      hice: 0.0,
      Tice: 0.0,
      hsnow: 0.0,
      Tsnow: 0.0
    };
  }

  /**
   * Initializes WASM instance via fetch or base64 fallback.
   */
  async init() {
    const imports = {
      env: {
        _lfortran_datan: Math.atan,
        _lfortran_dlog: Math.log,
        _lfortran_get_default_allocator: () => 0,
        exp: Math.exp,
        pow: Math.pow,
        _lcompilers_snprintf_alloc: () => 0,
        _lcompilers_runtime_error: (msg) => console.error("FLake WASM runtime error:", msg),
        exit: (code) => console.warn("FLake WASM exit called with code:", code)
      }
    };

    let wasmBytes = null;

    // Try fetching flake.wasm (works under HTTP/HTTPS)
    try {
      if (typeof fetch === 'function' && typeof location !== 'undefined' && location.protocol !== 'file:') {
        const response = await fetch('flake.wasm');
        if (response.ok) {
          wasmBytes = await response.arrayBuffer();
        }
      }
    } catch (e) {
      console.warn("Fetch failed, falling back to embedded Base64 WASM:", e);
    }

    // Fallback to embedded Base64 (works under file:// protocol without local server)
    if (!wasmBytes) {
      const b64 = (typeof window !== 'undefined' && window.FLAKE_WASM_BASE64) ||
                  (typeof globalThis !== 'undefined' && globalThis.FLAKE_WASM_BASE64);
      if (!b64) {
        throw new Error("flake.wasm could not be fetched and window.FLAKE_WASM_BASE64 is missing.");
      }
      const binaryStr = atob(b64);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      wasmBytes = bytes.buffer;
    }

    const { instance } = await WebAssembly.instantiate(wasmBytes, imports);
    this.instance = instance;
    this.memory = instance.exports.memory;
    this.memView = new DataView(this.memory.buffer);

    // Call global constructors
    if (instance.exports.__wasm_call_ctors) {
      instance.exports.__wasm_call_ctors();
    }

    this.allocateMemory();
    this.resetState('summer');
    this.isReady = true;
    return true;
  }

  allocateMemory() {
    const heapBase = this.instance.exports.__heap_base
      ? this.instance.exports.__heap_base.value
      : 67344;
    let offset = Math.ceil(heapBase / 8) * 8 + 128;

    const allocDouble = (initialVal = 0.0) => {
      const ptr = offset;
      this.memView.setFloat64(ptr, initialVal, true);
      offset += 8;
      return ptr;
    };

    const allocOptic = (extin0) => {
      const ptr = offset;
      this.memView.setInt32(ptr, 1, true); // nband_optic = 1
      this.memView.setFloat64(ptr + 8, 1.0, true); // frac_optic(1) = 1.0
      for (let i = 1; i < 10; i++) {
        this.memView.setFloat64(ptr + 8 + i * 8, 0.0, true);
      }
      this.memView.setFloat64(ptr + 88, extin0, true); // extincoef_optic(1)
      for (let i = 1; i < 10; i++) {
        this.memView.setFloat64(ptr + 88 + i * 8, 1e7, true);
      }
      offset += 256;
      return ptr;
    };

    this.ptrs = {
      // Atmospheric & forcing
      dMsnowdt_in: allocDouble(0.0),
      I_atm_in: allocDouble(450.0),
      Q_atm_lw_in: allocDouble(310.0),
      height_u_in: allocDouble(10.0),
      height_tq_in: allocDouble(2.0),
      U_a_in: allocDouble(3.5),
      T_a_in: allocDouble(291.15),
      q_a_in: allocDouble(0.007),
      P_a_in: allocDouble(101325.0),

      // Lake basin & constants
      depth_w: allocDouble(this.lakeDepth),
      fetch: allocDouble(this.fetch),
      depth_bs: allocDouble(2.5),
      T_bs: allocDouble(277.15),      // 4 C sediment
      par_Coriolis: allocDouble(1e-4), // ~45 deg N latitude
      del_time: allocDouble(this.timeStepSec),

      // Input prognostic states
      T_snow_in: allocDouble(273.15),
      T_ice_in: allocDouble(273.15),
      T_mnw_in: allocDouble(282.65),  // 9.5 C
      T_wML_in: allocDouble(287.15),  // 14.0 C
      T_bot_in: allocDouble(277.35),  // 4.2 C
      T_B1_in: allocDouble(277.15),
      C_T_in: allocDouble(0.65),
      h_snow_in: allocDouble(0.0),
      h_ice_in: allocDouble(0.0),
      h_ML_in: allocDouble(3.5),
      H_B1_in: allocDouble(1.0),
      T_sfc_p: allocDouble(287.15),

      // Albedos
      albedo_water: allocDouble(0.07),
      albedo_ice: allocDouble(0.60),
      albedo_snow: allocDouble(0.75),

      // Optical parameters
      opticpar_water: allocOptic(this.extinWater),
      opticpar_ice: allocOptic(17.1),
      opticpar_snow: allocOptic(1e7),

      // Output prognostic states
      T_snow_out: allocDouble(0.0),
      T_ice_out: allocDouble(0.0),
      T_mnw_out: allocDouble(0.0),
      T_wML_out: allocDouble(0.0),
      T_bot_out: allocDouble(0.0),
      T_B1_out: allocDouble(0.0),
      C_T_out: allocDouble(0.0),
      h_snow_out: allocDouble(0.0),
      h_ice_out: allocDouble(0.0),
      h_ML_out: allocDouble(0.0),
      H_B1_out: allocDouble(0.0),
      T_sfc_n: allocDouble(0.0)
    };
  }

  setLakeParameters({ depth, fetch, extinWater }) {
    if (depth != null) {
      this.lakeDepth = depth;
      this.memView.setFloat64(this.ptrs.depth_w, depth, true);
    }
    if (fetch != null) {
      this.fetch = fetch;
      this.memView.setFloat64(this.ptrs.fetch, fetch, true);
    }
    if (extinWater != null) {
      this.extinWater = extinWater;
      this.memView.setFloat64(this.ptrs.opticpar_water + 88, extinWater, true);
    }
  }

  resetState(preset = 'summer') {
    const mv = this.memView;
    const p = this.ptrs;
    if (!mv || !p.T_sfc_p) return;

    let init = {
      Tsfc: 16.0,
      TwML: 16.0,
      Tbot: 4.2,
      Tmnw: 10.5,
      hML: 3.5,
      CT: 0.65,
      hice: 0.0,
      Tice: 0.0,
      hsnow: 0.0,
      Tsnow: 0.0
    };

    if (preset === 'winter') {
      init = {
        Tsfc: -1.0,
        TwML: 0.2,
        Tbot: 3.9,
        Tmnw: 2.0,
        hML: this.lakeDepth * 0.9,
        CT: 0.55,
        hice: 0.02,
        Tice: -1.0,
        hsnow: 0.005,
        Tsnow: -1.5
      };
      this.dayOfYear = 15;
    } else if (preset === 'autumn') {
      init = {
        Tsfc: 9.0,
        TwML: 9.0,
        Tbot: 4.5,
        Tmnw: 7.2,
        hML: this.lakeDepth * 0.6,
        CT: 0.68,
        hice: 0.0,
        Tice: 0.0,
        hsnow: 0.0,
        Tsnow: 0.0
      };
      this.dayOfYear = 285;
    } else if (preset === 'spring') {
      init = {
        Tsfc: 4.0,
        TwML: 4.0,
        Tbot: 4.0,
        Tmnw: 4.0,
        hML: this.lakeDepth,
        CT: 0.50,
        hice: 0.0,
        Tice: 0.0,
        hsnow: 0.0,
        Tsnow: 0.0
      };
      this.dayOfYear = 100;
    } else {
      this.dayOfYear = 190;
    }

    this.simulatedHours = 0;
    this.hourOfDay = 12;

    const K = 273.15;
    mv.setFloat64(p.T_sfc_p, init.Tsfc + K, true);
    mv.setFloat64(p.T_wML_in, init.TwML + K, true);
    mv.setFloat64(p.T_mnw_in, init.Tmnw + K, true);
    mv.setFloat64(p.T_bot_in, init.Tbot + K, true);
    mv.setFloat64(p.h_ML_in, init.hML, true);
    mv.setFloat64(p.C_T_in, init.CT, true);
    mv.setFloat64(p.h_ice_in, init.hice, true);
    mv.setFloat64(p.T_ice_in, init.Tice + K, true);
    mv.setFloat64(p.h_snow_in, init.hsnow, true);
    mv.setFloat64(p.T_snow_in, init.Tsnow + K, true);
    mv.setFloat64(p.H_B1_in, 1.0, true);
    mv.setFloat64(p.T_B1_in, init.Tbot + K, true);

    this.state = { ...init };
  }

  /**
   * Advances the simulation by one timestep.
   * @param {Object} forcing - { T_air, solar, wind, Q_lw, snowRate, del_time }
   */
  step(forcing) {
    if (!this.isReady) return this.state;

    const p = this.ptrs;
    const mv = this.memView;
    const K = 273.15;

    const Tair = Math.max(-50, Math.min(50, forcing.T_air));
    const solar = Math.max(0, forcing.solar);
    const wind = Math.max(0.2, forcing.wind);
    const snowRate = forcing.snowRate || 0.0;
    const delTime = forcing.del_time || this.timeStepSec;

    let Q_lw = forcing.Q_lw;
    if (Q_lw == null) {
      const Tair_K = Tair + K;
      const eps_eff = 0.76;
      const sigma = 5.670374e-8;
      Q_lw = eps_eff * sigma * Math.pow(Tair_K, 4);
    }

    const e_sat = 611.2 * Math.exp((17.67 * Tair) / (Tair + 243.5));
    const rh = 0.70;
    const q_air = (0.622 * (rh * e_sat)) / (101325.0 - 0.378 * (rh * e_sat));

    mv.setFloat64(p.T_a_in, Tair + K, true);
    mv.setFloat64(p.I_atm_in, solar, true);
    mv.setFloat64(p.Q_atm_lw_in, Q_lw, true);
    mv.setFloat64(p.U_a_in, wind, true);
    mv.setFloat64(p.q_a_in, q_air, true);
    mv.setFloat64(p.dMsnowdt_in, snowRate, true);
    mv.setFloat64(p.del_time, delTime, true);

    this.instance.exports.flake_interface(
      p.dMsnowdt_in, p.I_atm_in, p.Q_atm_lw_in, p.height_u_in, p.height_tq_in,
      p.U_a_in, p.T_a_in, p.q_a_in, p.P_a_in,
      p.depth_w, p.fetch, p.depth_bs, p.T_bs, p.par_Coriolis, p.del_time,
      p.T_snow_in, p.T_ice_in, p.T_mnw_in, p.T_wML_in, p.T_bot_in, p.T_B1_in,
      p.C_T_in, p.h_snow_in, p.h_ice_in, p.h_ML_in, p.H_B1_in, p.T_sfc_p,
      p.albedo_water, p.albedo_ice, p.albedo_snow,
      p.opticpar_water, p.opticpar_ice, p.opticpar_snow,
      p.T_snow_out, p.T_ice_out, p.T_mnw_out, p.T_wML_out, p.T_bot_out, p.T_B1_out,
      p.C_T_out, p.h_snow_out, p.h_ice_out, p.h_ML_out, p.H_B1_out, p.T_sfc_n
    );

    const Tsfc = mv.getFloat64(p.T_sfc_n, true) - K;
    const TwML = mv.getFloat64(p.T_wML_out, true) - K;
    const Tmnw = mv.getFloat64(p.T_mnw_out, true) - K;
    const Tbot = mv.getFloat64(p.T_bot_out, true) - K;
    const hML = mv.getFloat64(p.h_ML_out, true);
    const CT = mv.getFloat64(p.C_T_out, true);
    const hice = mv.getFloat64(p.h_ice_out, true);
    const Tice = mv.getFloat64(p.T_ice_out, true) - K;
    const hsnow = mv.getFloat64(p.h_snow_out, true);
    const Tsnow = mv.getFloat64(p.T_snow_out, true) - K;

    if (!Number.isNaN(Tsfc) && Number.isFinite(Tsfc)) {
      this.state = {
        Tsfc,
        TwML,
        Tmnw,
        Tbot,
        hML: Math.min(this.lakeDepth, Math.max(0, hML)),
        CT: Math.min(0.9, Math.max(0.5, CT)),
        hice: Math.max(0, hice),
        Tice: Math.min(0, Tice),
        hsnow: Math.max(0, hsnow),
        Tsnow: Math.min(0, Tsnow)
      };

      mv.setFloat64(p.T_sfc_p, mv.getFloat64(p.T_sfc_n, true), true);
      mv.setFloat64(p.T_wML_in, mv.getFloat64(p.T_wML_out, true), true);
      mv.setFloat64(p.T_mnw_in, mv.getFloat64(p.T_mnw_out, true), true);
      mv.setFloat64(p.T_bot_in, mv.getFloat64(p.T_bot_out, true), true);
      mv.setFloat64(p.h_ML_in, mv.getFloat64(p.h_ML_out, true), true);
      mv.setFloat64(p.C_T_in, mv.getFloat64(p.C_T_out, true), true);
      mv.setFloat64(p.h_ice_in, mv.getFloat64(p.h_ice_out, true), true);
      mv.setFloat64(p.T_ice_in, mv.getFloat64(p.T_ice_out, true), true);
      mv.setFloat64(p.h_snow_in, mv.getFloat64(p.h_snow_out, true), true);
      mv.setFloat64(p.T_snow_in, mv.getFloat64(p.T_snow_out, true), true);
      mv.setFloat64(p.H_B1_in, 1.0, true);
      mv.setFloat64(p.T_B1_in, mv.getFloat64(p.T_B1_out, true), true);
    } else {
      console.error("FLake timestep returned NaN or Inf!");
    }

    this.simulatedHours++;
    this.hourOfDay = (this.hourOfDay + 1) % 24;
    if (this.hourOfDay === 0) {
      this.dayOfYear = (this.dayOfYear % 365) + 1;
    }

    return this.state;
  }

  /**
   * Evaluates an isolated direct ODE calculation without disturbing ongoing live simulation.
   */
  runDirectCalculation(initialState, forcing, lakeParams, numSteps = 1) {
    if (!this.isReady) throw new Error("FLake WASM engine is not ready");

    const tStart = performance.now();
    const mv = this.memView;
    const p = this.ptrs;
    const K = 273.15;

    // Backup current engine state and lake parameters
    const backupState = { ...this.state };
    const backupDepth = this.lakeDepth;
    const backupFetch = this.fetch;
    const backupExtin = this.extinWater;
    const backupDelTime = this.timeStepSec;
    const backupHours = this.simulatedHours;
    const backupDay = this.dayOfYear;
    const backupHourOfDay = this.hourOfDay;

    // Apply direct calculation lake parameters
    const depth = lakeParams.depth != null ? lakeParams.depth : this.lakeDepth;
    const fetch = lakeParams.fetch != null ? lakeParams.fetch : this.fetch;
    const extin = lakeParams.extinWater != null ? lakeParams.extinWater : this.extinWater;
    this.setLakeParameters({ depth, fetch, extinWater: extin });

    const delTime = forcing.del_time || 3600.0;
    this.timeStepSec = delTime;
    mv.setFloat64(p.del_time, delTime, true);

    // Populate initial conditions
    const init = {
      Tsfc: initialState.Tsfc != null ? initialState.Tsfc : 16.0,
      TwML: initialState.TwML != null ? initialState.TwML : 16.0,
      Tbot: initialState.Tbot != null ? initialState.Tbot : 4.0,
      Tmnw: initialState.Tmnw != null ? initialState.Tmnw : 10.0,
      hML: initialState.hML != null ? initialState.hML : 3.5,
      CT: initialState.CT != null ? initialState.CT : 0.65,
      hice: initialState.hice != null ? initialState.hice : 0.0,
      Tice: initialState.Tice != null ? initialState.Tice : 0.0,
      hsnow: initialState.hsnow != null ? initialState.hsnow : 0.0,
      Tsnow: initialState.Tsnow != null ? initialState.Tsnow : 0.0
    };

    mv.setFloat64(p.T_sfc_p, init.Tsfc + K, true);
    mv.setFloat64(p.T_wML_in, init.TwML + K, true);
    mv.setFloat64(p.T_mnw_in, init.Tmnw + K, true);
    mv.setFloat64(p.T_bot_in, init.Tbot + K, true);
    mv.setFloat64(p.h_ML_in, init.hML, true);
    mv.setFloat64(p.C_T_in, init.CT, true);
    mv.setFloat64(p.h_ice_in, init.hice, true);
    mv.setFloat64(p.T_ice_in, init.Tice + K, true);
    mv.setFloat64(p.h_snow_in, init.hsnow, true);
    mv.setFloat64(p.T_snow_in, init.Tsnow + K, true);
    mv.setFloat64(p.H_B1_in, 1.0, true);
    mv.setFloat64(p.T_B1_in, init.Tbot + K, true);

    const stepHistory = [];
    let currentState = null;

    for (let s = 0; s < numSteps; s++) {
      currentState = this.step(forcing);
      stepHistory.push({ ...currentState, step: s + 1 });
    }

    const elapsedMs = performance.now() - tStart;
    const finalProfile = this.getVerticalProfile(60);

    const delta = {
      Tsfc: currentState.Tsfc - init.Tsfc,
      TwML: currentState.TwML - init.TwML,
      Tbot: currentState.Tbot - init.Tbot,
      Tmnw: currentState.Tmnw - init.Tmnw,
      hML: currentState.hML - init.hML,
      CT: currentState.CT - init.CT,
      hice: currentState.hice - init.hice
    };

    // Restore live simulation state
    this.setLakeParameters({ depth: backupDepth, fetch: backupFetch, extinWater: backupExtin });
    this.timeStepSec = backupDelTime;
    mv.setFloat64(p.del_time, backupDelTime, true);
    this.simulatedHours = backupHours;
    this.dayOfYear = backupDay;
    this.hourOfDay = backupHourOfDay;
    this.state = backupState;

    mv.setFloat64(p.T_sfc_p, backupState.Tsfc + K, true);
    mv.setFloat64(p.T_wML_in, backupState.TwML + K, true);
    mv.setFloat64(p.T_mnw_in, backupState.Tmnw + K, true);
    mv.setFloat64(p.T_bot_in, backupState.Tbot + K, true);
    mv.setFloat64(p.h_ML_in, backupState.hML, true);
    mv.setFloat64(p.C_T_in, backupState.CT, true);
    mv.setFloat64(p.h_ice_in, backupState.hice, true);
    mv.setFloat64(p.T_ice_in, backupState.Tice + K, true);
    mv.setFloat64(p.h_snow_in, backupState.hsnow, true);
    mv.setFloat64(p.T_snow_in, backupState.Tsnow + K, true);
    mv.setFloat64(p.H_B1_in, 1.0, true);
    mv.setFloat64(p.T_B1_in, backupState.Tbot + K, true);

    return {
      before: init,
      after: currentState,
      delta,
      lakeParams: { depth, fetch, extinWater: extin },
      forcing,
      numSteps,
      stepHistory,
      profile: finalProfile,
      elapsedMs
    };
  }

  /**
   * Computes the vertical temperature profile T(z) according to FLake self-similarity.
   */
  getVerticalProfile(numPoints = 60) {
    const { TwML, Tbot, hML, CT, hice, Tsfc } = this.state;
    const D = this.lakeDepth;
    const profile = [];

    for (let i = 0; i <= numPoints; i++) {
      const z = (i / numPoints) * D;
      let T = TwML;

      if (z <= hML) {
        T = TwML;
      } else if (D > hML) {
        const zeta = Math.min(1.0, Math.max(0.0, (z - hML) / (D - hML)));
        const c1 = (40.0 / 3.0) * CT - (20.0 / 3.0);
        const c2 = 18.0 - 30.0 * CT;
        const c3 = 20.0 * CT - 12.0;
        const c4 = (5.0 / 3.0) - (10.0 / 3.0) * CT;
        const phi = ((c4 * zeta + c3) * zeta + c2) * zeta + c1;
        const phiT = zeta * phi;

        T = TwML - (TwML - Tbot) * phiT;
      }

      profile.push({ depth: z, temp: T });
    }

    return {
      waterProfile: profile,
      surfaceTemp: Tsfc,
      mixedLayerTemp: TwML,
      bottomTemp: Tbot,
      mixedLayerDepth: hML,
      lakeDepth: D,
      iceThickness: hice,
      snowThickness: this.state.hsnow
    };
  }

  getRegime() {
    const { hice, TwML, Tbot, hML } = this.state;
    const D = this.lakeDepth;

    if (hice > 0.001) {
      return {
        label: "Ice-Covered",
        desc: "Surface is frozen with inverse thermal stratification under ice.",
        badgeClass: "badge-ice"
      };
    }
    if (Math.abs(TwML - Tbot) < 0.25 || hML >= D * 0.95) {
      return {
        label: "Full Homothermy (Turnover)",
        desc: "Complete vertical mixing throughout the entire water column.",
        badgeClass: "badge-turnover"
      };
    }
    if (TwML > Tbot) {
      return {
        label: "Direct Stratification",
        desc: "Warm epilimnion floating on a colder, denser hypolimnion.",
        badgeClass: "badge-stratified"
      };
    }
    return {
      label: "Inverse Stratification",
      desc: "Cold water (< 4°C) resting on denser, relatively warmer bottom water.",
      badgeClass: "badge-inverse"
    };
  }
}

if (typeof module !== 'undefined') {
  module.exports = FLakeEngine;
}
