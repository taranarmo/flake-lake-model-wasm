/**
 * FLake WebAssembly Dashboard Application
 * Supports both continuous interactive simulation and direct ODE calculator modes.
 */

(function () {
  'use strict';

  // Instantiate FLakeEngine
  const engine = new FLakeEngine();

  // Application State
  const state = {
    activeTab: 'simulation', // 'simulation' | 'calculator'
    isRunning: true,
    speed: 10,               // steps per second
    lastStepTime: 0,
    preset: 'summer',
    diurnalCycle: true,      // day/night variation
    annualCycle: false,      // 365-day seasonal cycle

    // Manual forcing inputs (base values)
    baseAirTemp: 24.0,       // deg C
    baseSolar: 650.0,        // W/m2
    baseWind: 2.5,           // m/s
    snowRate: 0.0,           // kg/m2/s
    qLw: null,               // auto

    // Forcing Mode & Dataset
    forcingMode: 'manual',   // 'manual' | 'curated' | 'api' | 'custom'
    isDatasetMode: false,
    datasetSeries: [],
    datasetResults: [],
    datasetIndex: 0,
    customParsedData: null,

    // Lake geometry
    lakeDepth: 12.0,
    waterClarity: 1.0,

    // Time series history buffer (up to 8760 hours)
    history: [],
    maxHistoryLength: 8760,

    // Latest direct calculation result
    lastCalcResult: null
  };

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DAYS_IN_MONTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const CURATED_BENCHMARKS = {
    heiligensee: {
      id: 'heiligensee',
      name: 'Heiligensee',
      location: 'Berlin, Germany',
      regime: 'Polymictic (Shallow)',
      regimeShort: 'Polymictic',
      regimeColor: '#0284c7',
      depth: 4.5,
      fetch: 2000,
      clarity: 1.5,
      lat: 52.6,
      description: 'Small polymictic urban lake in Berlin with frequent mixing and winter ice cover.',
      source: 'DWD Potsdam Station (1980)',
      file: 'heiligensee.json'
    },
    mueggelsee: {
      id: 'mueggelsee',
      name: 'Müggelsee',
      location: 'Berlin, Germany',
      regime: 'Polymictic (Shallow)',
      regimeShort: 'Polymictic',
      regimeColor: '#0284c7',
      depth: 4.9,
      fetch: 2500,
      clarity: 1.2,
      lat: 52.43,
      description: "Berlin's largest lake: shallow, wind-exposed polymictic basin with intermittent stratification.",
      source: 'DWD Potsdam Station (1980)',
      file: 'mueggelsee.json'
    },
    stechlin: {
      id: 'stechlin',
      name: 'Stechlinsee',
      location: 'Brandenburg, Germany',
      regime: 'Dimictic (Deep, Stratified)',
      regimeShort: 'Dimictic',
      regimeColor: '#7c3aed',
      depth: 22.8,
      fetch: 4000,
      clarity: 0.3,
      lat: 53.15,
      description: 'Deep oligotrophic clear-water lake with strong summer thermal stratification and hypolimnion near 4°C.',
      source: 'IGB Stechlin Station (1994)',
      file: 'stechlin.json'
    },
    geneva: {
      id: 'geneva',
      name: 'Lake Geneva / Lac Léman',
      location: 'Switzerland / France',
      regime: 'Warm Monomictic (Deep Sub-Alpine)',
      regimeShort: 'Monomictic',
      regimeColor: '#d97706',
      depth: 40.0,
      fetch: 15000,
      clarity: 0.4,
      lat: 46.45,
      description: 'Deep sub-alpine lake that stratifies intensely in summer and mixes only in winter without freezing.',
      source: 'ERA5 Reanalysis (2024)',
      file: 'geneva.json'
    },
    baikal: {
      id: 'baikal',
      name: 'Lake Baikal',
      location: 'Siberia, Russia',
      regime: 'Cold Dimictic / Ice-Covered (Rift Lake)',
      regimeShort: 'Cold / Ice',
      regimeColor: '#0891b2',
      depth: 744.0,
      fetch: 25000,
      clarity: 0.2,
      lat: 53.5,
      description: "World's deepest freshwater rift lake (mean depth 744m, max depth 1642m). Depth is fully customizable.",
      source: 'ERA5 Reanalysis (2024)',
      file: 'baikal.json'
    }
  };

  const LAKE_PRESETS = {
    mueggelsee: { name: 'Müggelsee, Berlin', lat: 52.43, lon: 13.63, depth: 4.9, clarity: 1.2 },
    heiligensee: { name: 'Heiligensee, Berlin', lat: 52.60, lon: 13.22, depth: 4.5, clarity: 1.5 },
    stechlin: { name: 'Stechlinsee, Brandenburg', lat: 53.15, lon: 13.03, depth: 22.8, clarity: 0.3 },
    geneva: { name: 'Lake Geneva / Léman', lat: 46.45, lon: 6.60, depth: 40.0, clarity: 0.4 },
    constance: { name: 'Lake Constance / Bodensee', lat: 47.63, lon: 9.38, depth: 45.0, clarity: 0.5 },
    superior: { name: 'Lake Superior', lat: 47.70, lon: -87.50, depth: 50.0, clarity: 0.25 },
    baikal: { name: 'Lake Baikal', lat: 53.50, lon: 108.20, depth: 744.0, clarity: 0.2 },
    tahoe: { name: 'Lake Tahoe', lat: 39.09, lon: -120.03, depth: 50.0, clarity: 0.15 },
    victoria: { name: 'Lake Victoria', lat: -1.00, lon: 33.00, depth: 40.0, clarity: 1.0 }
  };

  function getSimulatedDateString(dayOfYear, hourOfDay) {
    let day = dayOfYear;
    let monthIdx = 0;
    for (let i = 0; i < DAYS_IN_MONTHS.length; i++) {
      if (day <= DAYS_IN_MONTHS[i]) {
        monthIdx = i;
        break;
      }
      day -= DAYS_IN_MONTHS[i];
    }
    const h = hourOfDay.toString().padStart(2, '0');
    return `Day ${dayOfYear} (${MONTHS[monthIdx]} ${day.toString().padStart(2, '0')}) ${h}:00`;
  }

  // DOM Elements
  const UI = {
    // Mode tabs
    tabSimulation: document.getElementById('tab-simulation'),
    tabCalculator: document.getElementById('tab-calculator'),
    viewSimulation: document.getElementById('view-simulation'),
    viewCalculator: document.getElementById('view-calculator'),
    headerSimControls: document.getElementById('header-sim-controls'),

    // Forcing Mode Tabs & Panels
    tabForcingManual: document.getElementById('tab-forcing-manual'),
    tabForcingCurated: document.getElementById('tab-forcing-curated'),
    tabForcingApi: document.getElementById('tab-forcing-api'),
    tabForcingCustom: document.getElementById('tab-forcing-custom'),
    panelForcingManual: document.getElementById('panel-forcing-manual'),
    panelForcingCurated: document.getElementById('panel-forcing-curated'),
    panelForcingApi: document.getElementById('panel-forcing-api'),
    panelForcingCustom: document.getElementById('panel-forcing-custom'),

    // Curated Benchmark Lakes Controls
    curatedLakeSelect: document.getElementById('curated-lake-select'),
    curatedLakeCard: document.getElementById('curated-lake-card'),
    curatedName: document.getElementById('curated-name'),
    curatedRegimePill: document.getElementById('curated-regime-pill'),
    curatedDepth: document.getElementById('curated-depth'),
    curatedFetch: document.getElementById('curated-fetch'),
    curatedClarity: document.getElementById('curated-clarity'),
    curatedLat: document.getElementById('curated-lat'),
    curatedDesc: document.getElementById('curated-desc'),
    curatedSource: document.getElementById('curated-source'),
    btnLoadCurated: document.getElementById('btn-load-curated'),
    curatedStatusBox: document.getElementById('curated-status-box'),
    curatedStatusText: document.getElementById('curated-status-text'),

    // Custom File Drag and Drop Controls
    customDropZone: document.getElementById('custom-drop-zone'),
    customFileInput: document.getElementById('custom-file-input'),
    btnLoadSampleDat: document.getElementById('btn-load-sample-dat'),
    customFileCard: document.getElementById('custom-file-card'),
    customFileName: document.getElementById('custom-file-name'),
    customFileBadge: document.getElementById('custom-file-badge'),
    customRowsCount: document.getElementById('custom-rows-count'),
    customFileSize: document.getElementById('custom-file-size'),
    customStepDetected: document.getElementById('custom-step-detected'),
    customTimestepSelect: document.getElementById('custom-timestep-select'),
    btnRunCustom: document.getElementById('btn-run-custom'),
    customStatusBox: document.getElementById('custom-status-box'),
    customStatusText: document.getElementById('custom-status-text'),

    // API Controls
    apiLakePreset: document.getElementById('api-lake-preset'),
    apiLat: document.getElementById('api-lat'),
    apiLon: document.getElementById('api-lon'),
    apiPeriod: document.getElementById('api-period'),
    btnFetchApi: document.getElementById('btn-fetch-api'),
    apiStatusBox: document.getElementById('api-status-box'),
    apiStatusText: document.getElementById('api-status-text'),
    apiPlaybackBox: document.getElementById('api-playback-box'),
    apiTimePill: document.getElementById('api-time-pill'),
    apiScrubber: document.getElementById('api-scrubber'),
    statTsfcMin: document.getElementById('stat-tsfc-min'),
    statTsfcMax: document.getElementById('stat-tsfc-max'),
    statIceDays: document.getElementById('stat-ice-days'),
    statSimTime: document.getElementById('stat-sim-time'),

    // Simulation Controls
    btnPlay: document.getElementById('btn-play'),
    btnStep: document.getElementById('btn-step'),
    btnDay: document.getElementById('btn-day'),
    btnReset: document.getElementById('btn-reset'),
    speedSelect: document.getElementById('speed-select'),
    clockText: document.getElementById('clock-text'),
    clockDot: document.getElementById('clock-dot'),

    // Presets
    presetSummer: document.getElementById('preset-summer'),
    presetAutumn: document.getElementById('preset-autumn'),
    presetWinter: document.getElementById('preset-winter'),
    presetSpring: document.getElementById('preset-spring'),
    presetAnnual: document.getElementById('preset-annual'),

    // Forcing Sliders & Displays
    sliderAirTemp: document.getElementById('slider-airtemp'),
    valAirTemp: document.getElementById('val-airtemp'),
    sliderSolar: document.getElementById('slider-solar'),
    valSolar: document.getElementById('val-solar'),
    sliderWind: document.getElementById('slider-wind'),
    valWind: document.getElementById('val-wind'),
    sliderSnow: document.getElementById('slider-snow'),
    valSnow: document.getElementById('val-snow'),
    chkDiurnal: document.getElementById('chk-diurnal'),

    // Lake geometry
    sliderDepth: document.getElementById('slider-depth'),
    valDepth: document.getElementById('val-depth'),
    inputDepth: document.getElementById('input-depth'),
    selectClarity: document.getElementById('select-clarity'),

    // Telemetry
    teleTsfc: document.getElementById('tele-tsfc'),
    teleTwML: document.getElementById('tele-twml'),
    teleTbot: document.getElementById('tele-tbot'),
    teleTmnw: document.getElementById('tele-tmnw'),
    teleHml: document.getElementById('tele-hml'),
    teleHice: document.getElementById('tele-hice'),
    teleCt: document.getElementById('tele-ct'),
    regimeBadge: document.getElementById('regime-badge'),
    regimeDesc: document.getElementById('regime-desc'),

    // Canvases
    lakeCanvas: document.getElementById('lake-canvas'),
    profileCanvas: document.getElementById('profile-canvas'),
    historyCanvas: document.getElementById('history-canvas'),
    profileTooltip: document.getElementById('profile-tooltip'),
    historyTooltip: document.getElementById('history-tooltip'),

    // Direct Calculator View
    btnCalcStep: document.getElementById('btn-calc-step'),
    btnCalcNSteps: document.getElementById('btn-calc-n-steps'),
    calcStepsCount: document.getElementById('calc-steps-count'),
    btnCalcCopySim: document.getElementById('btn-calc-copy-sim'),
    btnCalcApplySim: document.getElementById('btn-calc-apply-sim'),
    btnCalcPresetSummer: document.getElementById('btn-calc-preset-summer'),
    btnCalcPresetWinter: document.getElementById('btn-calc-preset-winter'),

    calcInitTsfc: document.getElementById('calc-init-tsfc'),
    calcInitTwml: document.getElementById('calc-init-twml'),
    calcInitTbot: document.getElementById('calc-init-tbot'),
    calcInitTmnw: document.getElementById('calc-init-tmnw'),
    calcInitHml: document.getElementById('calc-init-hml'),
    calcInitCt: document.getElementById('calc-init-ct'),
    calcInitHice: document.getElementById('calc-init-hice'),
    calcInitHsnow: document.getElementById('calc-init-hsnow'),

    calcForceTair: document.getElementById('calc-force-tair'),
    calcForceSolar: document.getElementById('calc-force-solar'),
    calcForceWind: document.getElementById('calc-force-wind'),
    calcForceDeltime: document.getElementById('calc-force-deltime'),
    calcLakeDepth: document.getElementById('calc-lake-depth'),
    calcLakeExtin: document.getElementById('calc-lake-extin'),

    calcStatusBadge: document.getElementById('calc-status-badge'),
    calcTimingBanner: document.getElementById('calc-timing-banner'),
    calcResultsTbody: document.getElementById('calc-results-tbody'),
    calcProfileCanvas: document.getElementById('calc-profile-canvas'),
    calcJsonOutput: document.getElementById('calc-json-output'),
    btnCopyJson: document.getElementById('btn-copy-json')
  };

  // Canvas Contexts
  const ctxLake = UI.lakeCanvas.getContext('2d');
  const ctxProfile = UI.profileCanvas.getContext('2d');
  const ctxHistory = UI.historyCanvas.getContext('2d');
  const ctxCalcProfile = UI.calcProfileCanvas.getContext('2d');

  function setupDpiCanvas(canvas, ctx) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    return { width: rect.width, height: rect.height };
  }

  function getInstantaneousForcing() {
    let airTemp = state.baseAirTemp;
    let solar = state.baseSolar;
    const wind = state.baseWind;
    const snowRate = state.snowRate;

    if (state.annualCycle) {
      const day = engine.dayOfYear;
      const annualPhase = (2 * Math.PI * (day - 110)) / 365;
      airTemp = 10.0 + 15.0 * Math.sin(annualPhase);
      const maxSolarSeason = 300.0 + 350.0 * Math.sin(annualPhase);
      solar = Math.max(0, maxSolarSeason);
    }

    if (state.diurnalCycle) {
      const h = engine.hourOfDay;
      if (h >= 6 && h <= 18) {
        const sunElev = Math.sin((Math.PI * (h - 6)) / 12);
        solar = solar * sunElev * 1.57;
      } else {
        solar = 0.0;
      }
      const tempDiurnal = 4.0 * Math.sin((2 * Math.PI * (h - 9)) / 24);
      airTemp += tempDiurnal;
    }

    let effectiveSnowRate = snowRate;
    if (airTemp < 0 && state.preset === 'winter' && snowRate === 0) {
      effectiveSnowRate = 0.00002;
    }

    return {
      T_air: airTemp,
      solar: Math.max(0, solar),
      wind: Math.max(0.5, wind),
      snowRate: effectiveSnowRate,
      Q_lw: state.qLw
    };
  }

  function stepSimulation() {
    if (state.isDatasetMode) {
      if (state.datasetResults && state.datasetResults.length > 0) {
        let nextIdx = state.datasetIndex + 1;
        if (nextIdx >= state.datasetResults.length) {
          nextIdx = 0; // loop
        }
        applyDatasetStep(nextIdx);
      }
      return;
    }

    const forcing = getInstantaneousForcing();
    const res = engine.step(forcing);

    state.history.push({
      hour: engine.simulatedHours,
      dayOfYear: engine.dayOfYear,
      hourOfDay: engine.hourOfDay,
      Tsfc: res.Tsfc,
      TwML: res.TwML,
      Tbot: res.Tbot,
      Tmnw: res.Tmnw,
      hML: res.hML,
      hice: res.hice,
      hsnow: res.hsnow,
      Tair: forcing.T_air,
      solar: forcing.solar,
      wind: forcing.wind
    });

    if (state.history.length > state.maxHistoryLength) {
      state.history.shift();
    }

    updateTelemetry(res, forcing);
  }

  function showCuratedStatus(msg, type = '') {
    if (!UI.curatedStatusBox || !UI.curatedStatusText) return;
    if (!msg) {
      UI.curatedStatusBox.style.display = 'none';
      return;
    }
    UI.curatedStatusBox.style.display = 'flex';
    UI.curatedStatusBox.className = 'api-status-box' + (type ? ' ' + type : '');
    UI.curatedStatusText.textContent = msg;
  }

  function updateCuratedLakeCard(lakeKey) {
    const info = CURATED_BENCHMARKS[lakeKey];
    if (!info) return;
    if (UI.curatedName) UI.curatedName.textContent = info.name;
    if (UI.curatedRegimePill) {
      UI.curatedRegimePill.textContent = info.regimeShort;
      UI.curatedRegimePill.style.background = info.regimeColor || '#0284c7';
    }
    if (UI.curatedDepth) UI.curatedDepth.textContent = `${info.depth.toFixed(1)} m`;
    if (UI.curatedFetch) UI.curatedFetch.textContent = `${Math.round(info.fetch)} m`;
    if (UI.curatedClarity) UI.curatedClarity.textContent = `${info.clarity.toFixed(1)} m⁻¹`;
    if (UI.curatedLat) UI.curatedLat.textContent = `${info.lat.toFixed(2)}°N`;
    if (UI.curatedDesc) UI.curatedDesc.textContent = info.description;
    if (UI.curatedSource) UI.curatedSource.textContent = `Source: ${info.source}`;
  }

  async function fetchCuratedLake(lakeKey) {
    const info = CURATED_BENCHMARKS[lakeKey];
    if (!info) throw new Error("Unknown curated lake: " + lakeKey);
    const candidatePaths = [
      `data/lakes/${info.file}`,
      `assets/data/lakes/${info.file}`,
      `model/data/lakes/${info.file}`
    ];
    let data = null;
    let lastErr = null;
    for (const p of candidatePaths) {
      try {
        const resp = await fetch(p);
        if (resp.ok) {
          data = await resp.json();
          break;
        }
      } catch (e) {
        lastErr = e;
      }
    }
    if (!data) {
      throw new Error(lastErr ? lastErr.message : `Failed to load benchmark dataset for ${info.name}`);
    }
    return data;
  }

  async function handleLoadCuratedLake() {
    const lakeKey = UI.curatedLakeSelect ? UI.curatedLakeSelect.value : 'heiligensee';
    const lake = CURATED_BENCHMARKS[lakeKey];
    if (!lake) return;

    if (UI.btnLoadCurated) UI.btnLoadCurated.disabled = true;
    showCuratedStatus(`Loading verified benchmark dataset for ${lake.name}...`, "");

    try {
      const dataset = await fetchCuratedLake(lakeKey);
      if (!dataset.steps || dataset.steps.length === 0) {
        throw new Error("Benchmark dataset contains no time steps.");
      }

      showCuratedStatus(`Running FLake WebAssembly simulation across ${dataset.steps.length} timesteps...`, "");

      // Sync lake parameters to sidebar
      state.waterClarity = lake.clarity;
      updateLakeDepth(lake.depth);
      if (UI.selectClarity) {
        UI.selectClarity.value = lake.clarity.toString();
      }

      // Initial conditions on Day 1 (January winter state)
      const firstAirT = dataset.steps[0].T_air;
      const isSubZero = firstAirT <= 0.0;
      const initTsfc = Math.max(0.0, Math.min(firstAirT, 4.0));
      const initState = {
        Tsfc: initTsfc,
        TwML: initTsfc,
        Tbot: 4.0,
        Tmnw: Math.min(initTsfc, 4.0),
        hML: lake.depth,
        CT: 0.5,
        hice: isSubZero ? 0.05 : 0.0,
        Tice: isSubZero ? -1.0 : 0.0,
        hsnow: 0.0,
        Tsnow: 0.0
      };

      const lakeMorph = { depth: lake.depth, fetch: lake.fetch, extinWater: lake.clarity };
      const res = engine.runTimeSeries(dataset.steps, lakeMorph, initState);

      state.isDatasetMode = true;
      state.datasetSeries = dataset.steps;
      state.datasetResults = res.history;
      state.datasetIndex = 0;
      state.history = res.history;

      // Statistics
      let minTsfc = 100, maxTsfc = -100;
      let iceSteps = 0;
      for (const h of res.history) {
        if (h.Tsfc < minTsfc) minTsfc = h.Tsfc;
        if (h.Tsfc > maxTsfc) maxTsfc = h.Tsfc;
        if (h.hice > 0.001) iceSteps++;
      }
      const isDaily = (dataset.timeStepSec || 86400) >= 43200;
      const iceDays = isDaily ? iceSteps : Math.round(iceSteps / 24);

      if (UI.statTsfcMin) UI.statTsfcMin.textContent = `${minTsfc.toFixed(1)} °C`;
      if (UI.statTsfcMax) UI.statTsfcMax.textContent = `${maxTsfc.toFixed(1)} °C`;
      if (UI.statIceDays) UI.statIceDays.textContent = `${iceDays} d`;
      if (UI.statSimTime) UI.statSimTime.textContent = `${res.elapsedMs.toFixed(1)} ms`;

      if (UI.apiScrubber) {
        UI.apiScrubber.max = dataset.steps.length - 1;
        UI.apiScrubber.value = 0;
      }
      if (UI.apiPlaybackBox) {
        UI.apiPlaybackBox.style.display = 'flex';
      }

      showCuratedStatus(`Completed ${dataset.steps.length} timesteps in ${res.elapsedMs.toFixed(1)} ms (${lake.name})`, "success");

      // Pause continuous generator loop and show initial step
      state.isRunning = false;
      if (UI.btnPlay) UI.btnPlay.textContent = 'Run';
      if (UI.clockDot) UI.clockDot.className = 'clock-dot paused';

      applyDatasetStep(0);
    } catch (err) {
      console.error("Failed to load curated lake benchmark:", err);
      showCuratedStatus(`Error: ${err.message}`, "error");
    } finally {
      if (UI.btnLoadCurated) UI.btnLoadCurated.disabled = false;
    }
  }

  function showCustomStatus(msg, type = '') {
    if (!UI.customStatusBox || !UI.customStatusText) return;
    if (!msg) {
      UI.customStatusBox.style.display = 'none';
      return;
    }
    UI.customStatusBox.style.display = 'flex';
    UI.customStatusBox.className = 'api-status-box' + (type ? ' ' + type : '');
    UI.customStatusText.textContent = msg;
  }

  function parseMeteorologicalText(text, filename = '') {
    const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('!') && !l.startsWith('#'));
    if (rawLines.length === 0) {
      throw new Error("File is empty or contains only comments.");
    }

    // Delimiter detection
    const firstLine = rawLines[0];
    let delimiter = /\s+/;
    if (firstLine.includes(',') && !firstLine.includes('\t')) {
      delimiter = ',';
    } else if (firstLine.includes(';') && !firstLine.includes('\t')) {
      delimiter = ';';
    } else if (firstLine.includes('\t')) {
      delimiter = '\t';
    }

    // Header detection
    const hasLetters = /[a-zA-Z]/.test(firstLine);
    let dataStartIdx = 0;
    const headerIndices = {
      step: -1,
      solar: -1,
      tair: -1,
      vapor: -1,
      rh: -1,
      wind: -1,
      cloud: -1,
      snow: -1
    };

    if (hasLetters) {
      dataStartIdx = 1;
      const rawHeaderTokens = firstLine.split(delimiter).map(s => s.trim().toLowerCase());
      rawHeaderTokens.forEach((tok, i) => {
        if (tok.includes('step') || tok.includes('day') || tok === 'd' || tok === 'time' || tok === 'date') headerIndices.step = i;
        else if (tok.includes('sol') || tok.includes('rad') || tok.includes('sw') || tok === 'i_atm') headerIndices.solar = i;
        else if (tok.includes('temp') || tok.includes('tair') || tok === 't' || tok === 't2m' || tok === 't_air') headerIndices.tair = i;
        else if (tok.includes('rh') || tok.includes('humid')) headerIndices.rh = i;
        else if (tok.includes('vap') || tok.includes('ea') || tok.includes('e_a') || tok.includes('press')) headerIndices.vapor = i;
        else if (tok.includes('wind') || tok.includes('wspd') || tok === 'u' || tok === 'u10' || tok === 'spd') headerIndices.wind = i;
        else if (tok.includes('cloud') || tok.includes('cl') || tok === 'n') headerIndices.cloud = i;
        else if (tok.includes('snow') || tok.includes('precip')) headerIndices.snow = i;
      });
    }

    const steps = [];
    const K = 273.15;
    const sigma = 5.670374e-8;

    for (let lineIdx = dataStartIdx; lineIdx < rawLines.length; lineIdx++) {
      const rawTokens = rawLines[lineIdx].split(delimiter).map(s => s.trim()).filter(s => s.length > 0);
      if (rawTokens.length < 4) continue;

      let stepVal = lineIdx - dataStartIdx + 1;
      let solar = 0;
      let tair = 10;
      let ea_hpa = 10;
      let rh_pct = null;
      let wind = 3;
      let cloud = 0.5;
      let snowRate = 0;

      if (hasLetters && headerIndices.solar !== -1 && headerIndices.tair !== -1) {
        if (headerIndices.step !== -1) stepVal = parseFloat(rawTokens[headerIndices.step]) || stepVal;
        if (headerIndices.solar !== -1) solar = parseFloat(rawTokens[headerIndices.solar]) || 0;
        if (headerIndices.tair !== -1) tair = parseFloat(rawTokens[headerIndices.tair]) || 0;
        if (headerIndices.rh !== -1) rh_pct = parseFloat(rawTokens[headerIndices.rh]);
        if (headerIndices.vapor !== -1) ea_hpa = parseFloat(rawTokens[headerIndices.vapor]);
        if (headerIndices.wind !== -1) wind = parseFloat(rawTokens[headerIndices.wind]) || 2;
        if (headerIndices.cloud !== -1) cloud = parseFloat(rawTokens[headerIndices.cloud]);
        if (headerIndices.snow !== -1) snowRate = parseFloat(rawTokens[headerIndices.snow]) || 0;
      } else {
        const nums = rawTokens.map(Number);
        if (nums.length >= 6) {
          stepVal = nums[0];
          solar = nums[1];
          tair = nums[2];
          ea_hpa = nums[3];
          wind = nums[4];
          cloud = nums[5];
        } else if (nums.length === 5) {
          solar = nums[0];
          tair = nums[1];
          ea_hpa = nums[2];
          wind = nums[3];
          cloud = nums[4];
        } else if (nums.length === 4) {
          solar = nums[0];
          tair = nums[1];
          wind = nums[2];
          cloud = nums[3];
        }
      }

      solar = Math.max(0, isNaN(solar) ? 0 : solar);
      tair = isNaN(tair) ? 10.0 : tair;
      wind = Math.max(0.2, isNaN(wind) ? 2.5 : wind);
      cloud = Math.max(0.0, Math.min(1.0, isNaN(cloud) ? 0.5 : (cloud > 1.0 && cloud <= 10.0 ? cloud / 8.0 : (cloud > 10.0 ? cloud / 100.0 : cloud))));

      let e_a_pa = 1000.0;
      if (rh_pct != null && !isNaN(rh_pct)) {
        const rh_frac = Math.max(0.05, Math.min(1.0, rh_pct > 1.0 ? rh_pct / 100.0 : rh_pct));
        const e_sat = 611.2 * Math.exp((17.67 * tair) / (tair + 243.5));
        e_a_pa = rh_frac * e_sat;
      } else if (ea_hpa != null && !isNaN(ea_hpa)) {
        e_a_pa = Math.max(50.0, ea_hpa * 100.0);
      } else {
        const e_sat = 611.2 * Math.exp((17.67 * tair) / (tair + 243.5));
        e_a_pa = 0.70 * e_sat;
      }

      const q_air = (0.622 * e_a_pa) / (101325.0 - 0.378 * e_a_pa);
      const T_k = tair + K;
      const eps_clear = Math.min(0.85, 0.61 + 0.005 * Math.sqrt(Math.min(e_a_pa, 2000)));
      const f_cloud = 1.0 + 0.22 * (cloud * cloud);
      const Q_lw = eps_clear * f_cloud * sigma * Math.pow(T_k, 4);

      const stepIdx = steps.length;
      steps.push({
        timeStr: `Record ${stepIdx + 1}`,
        dateStr: `Record ${stepIdx + 1}`,
        dayOfYear: (stepIdx % 365) + 1,
        hourOfDay: 12,
        T_air: tair,
        solar: solar,
        wind: wind,
        Q_lw: Q_lw,
        q_air: q_air,
        snowRate: snowRate || 0.0,
        del_time: 86400.0
      });
    }

    if (steps.length === 0) {
      throw new Error("No numerical forcing records parsed from file.");
    }

    let detectedFormat = "FLake 6-col .DAT";
    if (hasLetters) detectedFormat = "CSV (with header)";
    else if (firstLine.split(delimiter).length === 5) detectedFormat = "FLake 5-col .DAT";
    else if (delimiter === ',') detectedFormat = "CSV";
    else if (delimiter === '\t') detectedFormat = "TSV";

    return {
      steps,
      detectedFormat,
      rowCount: steps.length,
      filename: filename || "uploaded_data.dat"
    };
  }

  function handleCustomFileSelected(file) {
    if (!file) return;
    showCustomStatus(`Reading ${file.name} (${(file.size / 1024).toFixed(1)} KB)...`, "");

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsed = parseMeteorologicalText(text, file.name);
        state.customParsedData = parsed;

        // Auto detect resolution
        const isHourly = parsed.rowCount > 500;
        const defaultDelTime = isHourly ? 3600 : 86400;
        parsed.steps.forEach((s, idx) => {
          s.del_time = defaultDelTime;
          if (isHourly) {
            s.hourOfDay = idx % 24;
            s.dayOfYear = Math.floor(idx / 24) % 365 + 1;
            s.timeStr = `Day ${s.dayOfYear}, ${s.hourOfDay}:00`;
          } else {
            s.hourOfDay = 12;
            s.dayOfYear = (idx % 365) + 1;
            s.timeStr = `Day ${s.dayOfYear}`;
          }
        });

        // Update UI
        if (UI.customFileName) UI.customFileName.textContent = file.name;
        if (UI.customFileBadge) UI.customFileBadge.textContent = parsed.detectedFormat;
        if (UI.customRowsCount) UI.customRowsCount.textContent = parsed.rowCount.toLocaleString();
        if (UI.customFileSize) UI.customFileSize.textContent = `${(file.size / 1024).toFixed(1)} KB`;
        if (UI.customStepDetected) UI.customStepDetected.textContent = isHourly ? 'Hourly (1h)' : 'Daily (24h)';
        if (UI.customTimestepSelect) UI.customTimestepSelect.value = defaultDelTime.toString();
        if (UI.customFileCard) UI.customFileCard.style.display = 'block';
        if (UI.btnRunCustom) UI.btnRunCustom.disabled = false;

        showCustomStatus(`Successfully parsed ${parsed.rowCount.toLocaleString()} records from ${file.name}. Ready to simulate.`, "success");
      } catch (err) {
        console.error("Custom file parse error:", err);
        showCustomStatus(`Parse error: ${err.message}`, "error");
        if (UI.btnRunCustom) UI.btnRunCustom.disabled = true;
      }
    };
    reader.onerror = () => {
      showCustomStatus("Failed to read file from disk.", "error");
    };
    reader.readAsText(file);
  }

  async function handleLoadSamplePotsdam() {
    showCustomStatus("Fetching Potsdam80-96.dat sample dataset...", "");
    const candidatePaths = [
      'assets/test_run/Potsdam80-96.dat',
      '../assets/test_run/Potsdam80-96.dat',
      '_site/assets/test_run/Potsdam80-96.dat'
    ];
    let text = null;
    let lastErr = null;
    for (const p of candidatePaths) {
      try {
        const resp = await fetch(p);
        if (resp.ok) {
          text = await resp.text();
          break;
        }
      } catch (e) {
        lastErr = e;
      }
    }
    if (!text) {
      showCustomStatus("Could not load sample file: " + (lastErr ? lastErr.message : "Not found"), "error");
      return;
    }

    try {
      const parsed = parseMeteorologicalText(text, "Potsdam80-96.dat");
      state.customParsedData = parsed;
      parsed.steps.forEach((s, idx) => {
        s.del_time = 86400.0;
        s.hourOfDay = 12;
        s.dayOfYear = (idx % 365) + 1;
        s.timeStr = `Day ${idx + 1}`;
      });

      if (UI.customFileName) UI.customFileName.textContent = "Potsdam80-96.dat (Sample)";
      if (UI.customFileBadge) UI.customFileBadge.textContent = parsed.detectedFormat;
      if (UI.customRowsCount) UI.customRowsCount.textContent = parsed.rowCount.toLocaleString();
      if (UI.customFileSize) UI.customFileSize.textContent = `${(text.length / 1024).toFixed(1)} KB`;
      if (UI.customStepDetected) UI.customStepDetected.textContent = "Daily (24h)";
      if (UI.customTimestepSelect) UI.customTimestepSelect.value = "86400";
      if (UI.customFileCard) UI.customFileCard.style.display = 'block';
      if (UI.btnRunCustom) UI.btnRunCustom.disabled = false;

      showCustomStatus(`Loaded ${parsed.rowCount.toLocaleString()} records from Potsdam sample. Click Simulate below.`, "success");
    } catch (err) {
      showCustomStatus(`Sample error: ${err.message}`, "error");
    }
  }

  function handleRunCustomSimulation() {
    if (!state.customParsedData || !state.customParsedData.steps || state.customParsedData.steps.length === 0) {
      showCustomStatus("No parsed file data available. Please select a file first.", "error");
      return;
    }

    const parsed = state.customParsedData;
    const selectedDelTime = parseFloat(UI.customTimestepSelect ? UI.customTimestepSelect.value : 86400);
    parsed.steps.forEach(s => { s.del_time = selectedDelTime; });

    if (UI.btnRunCustom) UI.btnRunCustom.disabled = true;
    showCustomStatus(`Simulating ${parsed.rowCount.toLocaleString()} steps in FLake WebAssembly...`, "");

    try {
      const firstAirT = parsed.steps[0].T_air;
      const isSubZero = firstAirT <= 0.0;
      const initTsfc = Math.max(0.0, Math.min(firstAirT, 4.0));
      const initState = {
        Tsfc: initTsfc,
        TwML: initTsfc,
        Tbot: 4.0,
        Tmnw: Math.min(initTsfc, 4.0),
        hML: state.lakeDepth,
        CT: 0.5,
        hice: isSubZero ? 0.05 : 0.0,
        Tice: isSubZero ? -1.0 : 0.0,
        hsnow: 0.0,
        Tsnow: 0.0
      };

      const lakeMorph = { depth: state.lakeDepth, fetch: 2000.0, extinWater: state.waterClarity };
      const res = engine.runTimeSeries(parsed.steps, lakeMorph, initState);

      state.isDatasetMode = true;
      state.datasetSeries = parsed.steps;
      state.datasetResults = res.history;
      state.datasetIndex = 0;
      state.history = res.history;

      // Statistics
      let minTsfc = 100, maxTsfc = -100;
      let iceSteps = 0;
      for (const h of res.history) {
        if (h.Tsfc < minTsfc) minTsfc = h.Tsfc;
        if (h.Tsfc > maxTsfc) maxTsfc = h.Tsfc;
        if (h.hice > 0.001) iceSteps++;
      }
      const isDaily = selectedDelTime >= 43200;
      const iceDays = isDaily ? iceSteps : Math.round(iceSteps / 24);

      if (UI.statTsfcMin) UI.statTsfcMin.textContent = `${minTsfc.toFixed(1)} °C`;
      if (UI.statTsfcMax) UI.statTsfcMax.textContent = `${maxTsfc.toFixed(1)} °C`;
      if (UI.statIceDays) UI.statIceDays.textContent = `${iceDays} d`;
      if (UI.statSimTime) UI.statSimTime.textContent = `${res.elapsedMs.toFixed(1)} ms`;

      if (UI.apiScrubber) {
        UI.apiScrubber.max = parsed.steps.length - 1;
        UI.apiScrubber.value = 0;
      }
      if (UI.apiPlaybackBox) {
        UI.apiPlaybackBox.style.display = 'flex';
      }

      showCustomStatus(`Simulation complete! Processed ${parsed.rowCount.toLocaleString()} timesteps in ${res.elapsedMs.toFixed(1)} ms.`, "success");

      // Pause continuous loop and show step 0
      state.isRunning = false;
      if (UI.btnPlay) UI.btnPlay.textContent = 'Run';
      if (UI.clockDot) UI.clockDot.className = 'clock-dot paused';

      applyDatasetStep(0);
    } catch (err) {
      console.error("Custom simulation error:", err);
      showCustomStatus(`Simulation error: ${err.message}`, "error");
    } finally {
      if (UI.btnRunCustom) UI.btnRunCustom.disabled = false;
    }
  }

  function showApiStatus(msg, type = '') {
    if (!UI.apiStatusBox || !UI.apiStatusText) return;
    if (!msg) {
      UI.apiStatusBox.style.display = 'none';
      return;
    }
    UI.apiStatusBox.style.display = 'flex';
    UI.apiStatusBox.className = 'api-status-box' + (type ? ' ' + type : '');
    UI.apiStatusText.textContent = msg;
  }

  async function fetchOpenMeteoSeries(lat, lon, period) {
    let url = '';
    const now = new Date();

    const fmt = d => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (period === 'pastYear' || period === 'latestYear') {
      const endD = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const startD = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 365);
      url = `https://archive-api.open-meteo.com/v1/era5?latitude=${lat}&longitude=${lon}&start_date=${fmt(startD)}&end_date=${fmt(endD)}&hourly=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,shortwave_radiation,cloud_cover,snowfall&wind_speed_unit=ms`;
    } else if (period === '2024') {
      url = `https://archive-api.open-meteo.com/v1/era5?latitude=${lat}&longitude=${lon}&start_date=2024-01-01&end_date=2024-12-31&hourly=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,shortwave_radiation,cloud_cover,snowfall&wind_speed_unit=ms`;
    } else if (period === '2023') {
      url = `https://archive-api.open-meteo.com/v1/era5?latitude=${lat}&longitude=${lon}&start_date=2023-01-01&end_date=2023-12-31&hourly=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,shortwave_radiation,cloud_cover,snowfall&wind_speed_unit=ms`;
    } else if (period === 'recent30') {
      const endD = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2);
      const startD = new Date(endD.getFullYear(), endD.getMonth(), endD.getDate() - 30);
      url = `https://archive-api.open-meteo.com/v1/era5?latitude=${lat}&longitude=${lon}&start_date=${fmt(startD)}&end_date=${fmt(endD)}&hourly=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,shortwave_radiation,cloud_cover,snowfall&wind_speed_unit=ms`;
    } else if (period === 'forecast') {
      url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,shortwave_radiation,cloud_cover,snowfall&wind_speed_unit=ms&past_days=7&forecast_days=7`;
    }

    const resp = await fetch(url);
    if (!resp.ok) {
      let reason = `HTTP ${resp.status}`;
      try {
        const j = await resp.json();
        if (j.reason) reason = j.reason;
      } catch (_) {}
      throw new Error(`Open-Meteo API query failed: ${reason}`);
    }

    const data = await resp.json();
    if (!data.hourly || !data.hourly.time || data.hourly.time.length === 0) {
      throw new Error("No hourly meteorological data returned for these coordinates.");
    }

    const hourly = data.hourly;
    const steps = [];
    const K = 273.15;
    const sigma = 5.670374e-8;

    for (let i = 0; i < hourly.time.length; i++) {
      const timeIso = hourly.time[i];
      const parts = timeIso.split('T');
      const datePart = parts[0];
      const timePart = parts[1] || '00:00';
      const [yearStr, monthStr, dayStr] = datePart.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10) - 1;
      const day = parseInt(dayStr, 10);
      const hourOfDay = parseInt(timePart.split(':')[0], 10) || 0;

      const dUtc = Date.UTC(year, month, day);
      const startOfYearUtc = Date.UTC(year, 0, 1);
      const dayOfYear = Math.floor((dUtc - startOfYearUtc) / (24 * 3600 * 1000)) + 1;

      const T_air = hourly.temperature_2m[i] != null ? hourly.temperature_2m[i] : 10.0;
      const solar = Math.max(0, hourly.shortwave_radiation[i] || 0.0);
      const wind = Math.max(0.2, hourly.wind_speed_10m[i] || 2.0);
      const rh = Math.max(0.05, Math.min(1.0, (hourly.relative_humidity_2m[i] != null ? hourly.relative_humidity_2m[i] : 70) / 100.0));
      const p_pa = (hourly.surface_pressure[i] || 1013.25) * 100.0;
      const cloud_pct = hourly.cloud_cover[i] != null ? hourly.cloud_cover[i] : 50;
      const cl_tot = Math.max(0, Math.min(1.0, cloud_pct / 100.0));
      const snow_cm = hourly.snowfall[i] || 0.0;

      // Vapor pressure via Magnus-Teten
      const e_sat = 611.2 * Math.exp((17.67 * T_air) / (T_air + 243.5));
      const e_a = rh * e_sat;
      const q_air = (0.622 * e_a) / (p_pa - 0.378 * e_a);

      // Longwave radiation with water vapor and cloudiness formulation
      const T_k = T_air + K;
      const eps_clear = Math.min(0.85, 0.61 + 0.005 * Math.sqrt(Math.min(e_a, 2000)));
      const f_cloud = 1.0 + 0.22 * (cl_tot * cl_tot);
      const Q_lw = eps_clear * f_cloud * sigma * Math.pow(T_k, 4);

      // Snow rate in kg m^-2 s^-1
      const snowRate = (snow_cm * 0.01 * 100) / 3600;

      steps.push({
        timeStr: timeIso.replace('T', ' '),
        dateStr: timeIso.split('T')[0],
        dayOfYear,
        hourOfDay,
        T_air,
        solar,
        wind,
        Q_lw,
        q_air,
        snowRate,
        del_time: 3600.0
      });
    }

    return { steps, data };
  }

  async function handleFetchApiWeather() {
    const lat = parseFloat(UI.apiLat.value);
    const lon = parseFloat(UI.apiLon.value);
    const period = UI.apiPeriod.value;

    if (isNaN(lat) || lat < -90 || lat > 90) {
      showApiStatus("Please enter a valid latitude (-90 to 90).", "error");
      return;
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      showApiStatus("Please enter a valid longitude (-180 to 180).", "error");
      return;
    }

    showApiStatus(`Requesting Open-Meteo weather data for (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)...`, "");
    UI.btnFetchApi.disabled = true;

    try {
      const { steps } = await fetchOpenMeteoSeries(lat, lon, period);
      showApiStatus(`Received ${steps.length} hours of weather data. Running FLake WebAssembly simulation...`, "");

      // Initial conditions adaptive to starting season and air temperature
      const firstAirT = steps[0].T_air;
      const isSubZero = firstAirT <= 0.0;
      const initTsfc = isSubZero ? 0.0 : Math.min(firstAirT, 20.0);
      const isWarm = initTsfc > 4.0;
      const initState = {
        Tsfc: initTsfc,
        TwML: initTsfc,
        Tbot: 4.0,
        Tmnw: isSubZero ? 2.0 : isWarm ? (initTsfc + 4.0) / 2 : Math.min(initTsfc, 4.0),
        hML: isSubZero ? state.lakeDepth : isWarm ? Math.max(1.5, Math.min(state.lakeDepth * 0.4, 10.0)) : state.lakeDepth,
        CT: 0.5,
        hice: isSubZero ? 0.05 : 0.0,
        Tice: isSubZero ? -1.0 : 0.0,
        hsnow: 0.0,
        Tsnow: 0.0
      };

      const res = engine.runTimeSeries(steps, { depth: state.lakeDepth, extinWater: state.waterClarity }, initState);

      state.isDatasetMode = true;
      state.datasetSeries = steps;
      state.datasetResults = res.history;
      state.datasetIndex = 0;
      state.history = res.history;

      // Calculate statistics
      let minTsfc = 100, maxTsfc = -100;
      let iceHours = 0;
      for (let h of res.history) {
        if (h.Tsfc < minTsfc) minTsfc = h.Tsfc;
        if (h.Tsfc > maxTsfc) maxTsfc = h.Tsfc;
        if (h.hice > 0.001) iceHours++;
      }
      const iceDays = Math.round(iceHours / 24);

      UI.statTsfcMin.textContent = `${minTsfc.toFixed(1)} °C`;
      UI.statTsfcMax.textContent = `${maxTsfc.toFixed(1)} °C`;
      UI.statIceDays.textContent = `${iceDays} d`;
      UI.statSimTime.textContent = `${res.elapsedMs.toFixed(1)} ms`;

      UI.apiScrubber.max = steps.length - 1;
      UI.apiScrubber.value = 0;
      UI.apiPlaybackBox.style.display = 'flex';

      showApiStatus(`Simulation complete! ${steps.length} hours processed in ${res.elapsedMs.toFixed(1)} ms.`, "success");

      // Pause continuous generator loop and display first step
      state.isRunning = false;
      UI.btnPlay.textContent = 'Run';
      UI.clockDot.className = 'clock-dot paused';

      applyDatasetStep(0);

    } catch (err) {
      console.error("Open-Meteo fetch/simulation error:", err);
      showApiStatus(`Error: ${err.message}`, "error");
    } finally {
      UI.btnFetchApi.disabled = false;
    }
  }

  function applyDatasetStep(idx) {
    if (!state.datasetResults || !state.datasetResults[idx]) return;
    const res = state.datasetResults[idx];
    const forcing = state.datasetSeries[idx];

    state.datasetIndex = idx;
    UI.apiScrubber.value = idx;
    UI.apiTimePill.textContent = res.timeStr;

    engine.setState(res);
    engine.simulatedHours = idx;
    engine.dayOfYear = res.dayOfYear;
    engine.hourOfDay = res.hourOfDay;

    updateTelemetry(res, forcing);
    renderLakeColumn();
    renderProfilePlot();
    renderHistoryChart();
  }

  function updateTelemetry(res, forcing) {
    UI.teleTsfc.textContent = res.Tsfc.toFixed(1);
    UI.teleTwML.textContent = res.TwML.toFixed(1);
    UI.teleTbot.textContent = res.Tbot.toFixed(1);
    UI.teleTmnw.textContent = res.Tmnw.toFixed(1);
    UI.teleHml.textContent = res.hML.toFixed(1);
    UI.teleHice.textContent = (res.hice * 100).toFixed(1);
    UI.teleCt.textContent = res.CT.toFixed(3);

    if (state.isDatasetMode && forcing && forcing.timeStr) {
      UI.clockText.textContent = forcing.timeStr;
    } else {
      UI.clockText.textContent = getSimulatedDateString(engine.dayOfYear, engine.hourOfDay);
    }

    const regime = engine.getRegime();
    UI.regimeBadge.textContent = regime.label;
    UI.regimeBadge.className = 'regime-badge ' + regime.badgeClass;
    UI.regimeDesc.textContent = regime.desc;

    UI.valAirTemp.textContent = `${forcing.T_air.toFixed(1)} °C`;
    UI.valSolar.textContent = `${Math.round(forcing.solar)} W/m²`;
  }

  function getDepthTickInterval(D) {
    if (D <= 8) return 1;
    if (D <= 15) return 2;
    if (D <= 35) return 5;
    if (D <= 80) return 10;
    if (D <= 200) return 25;
    if (D <= 500) return 50;
    if (D <= 1000) return 100;
    return 200;
  }

  function updateLakeDepth(depth, updateInput = true, updateSlider = true) {
    const d = Math.max(0.5, Math.min(2500, depth));
    state.lakeDepth = d;
    if (updateInput && UI.inputDepth) {
      UI.inputDepth.value = d.toFixed(1);
    }
    if (UI.valDepth) {
      UI.valDepth.textContent = `${d.toFixed(1)} m`;
    }
    if (updateSlider && UI.sliderDepth) {
      if (d > 100) {
        UI.sliderDepth.max = Math.ceil(d * 1.25);
      } else {
        UI.sliderDepth.max = 100;
      }
      UI.sliderDepth.value = d;
    }
    engine.setLakeParameters({ depth: d });
    renderAll();
  }

  /**
   * Render Canvas 1: Lake Cross-Section Column
   */
  function renderLakeColumn() {
    const { width, height } = setupDpiCanvas(UI.lakeCanvas, ctxLake);
    const { Tsfc, TwML, Tbot, hML, hice, hsnow } = engine.state;
    const D = engine.lakeDepth;

    const rulerWidth = 44;
    const skyHeight = 65;
    const sedimentHeight = 25;
    const waterTop = skyHeight;
    const waterBottom = height - sedimentHeight;
    const waterHeight = waterBottom - waterTop;
    const waterLeft = rulerWidth;
    const waterWidth = width - rulerWidth;

    const isDay = engine.hourOfDay >= 6 && engine.hourOfDay <= 18;
    const skyGrad = ctxLake.createLinearGradient(0, 0, 0, skyHeight);
    if (isDay) {
      const sunRatio = Math.sin((Math.PI * (engine.hourOfDay - 6)) / 12);
      skyGrad.addColorStop(0, `rgb(${20 + 30 * sunRatio}, ${40 + 70 * sunRatio}, ${90 + 130 * sunRatio})`);
      skyGrad.addColorStop(1, `rgb(${40 + 60 * sunRatio}, ${80 + 90 * sunRatio}, ${140 + 90 * sunRatio})`);
    } else {
      skyGrad.addColorStop(0, '#040711');
      skyGrad.addColorStop(1, '#0c1322');
    }
    ctxLake.fillStyle = skyGrad;
    ctxLake.fillRect(waterLeft, 0, waterWidth, skyHeight);

    // Celestial position (sun/moon travels in upper sky, never overlapping lake surface or ice)
    let celestialX, celestialY;
    if (isDay) {
      const dayFrac = (engine.hourOfDay - 6) / 12; // 0 to 1
      celestialX = waterLeft + 25 + dayFrac * (waterWidth - 50);
      celestialY = 16 + (1 - Math.sin(dayFrac * Math.PI)) * 8; // 16 at noon, 24 near horizon
    } else {
      const nightFrac = ((engine.hourOfDay + 6) % 24) / 12;
      celestialX = waterLeft + 25 + (nightFrac % 1) * (waterWidth - 50);
      celestialY = 18;
    }

    ctxLake.save();
    if (isDay) {
      const sunGlow = ctxLake.createRadialGradient(celestialX, celestialY, 2, celestialX, celestialY, 14);
      sunGlow.addColorStop(0, 'rgba(255, 235, 120, 1.0)');
      sunGlow.addColorStop(0.5, 'rgba(255, 180, 50, 0.4)');
      sunGlow.addColorStop(1, 'rgba(255, 160, 0, 0)');
      ctxLake.fillStyle = sunGlow;
      ctxLake.beginPath();
      ctxLake.arc(celestialX, celestialY, 14, 0, Math.PI * 2);
      ctxLake.fill();

      ctxLake.fillStyle = '#fffae0';
      ctxLake.beginPath();
      ctxLake.arc(celestialX, celestialY, 6, 0, Math.PI * 2);
      ctxLake.fill();
    } else {
      ctxLake.fillStyle = '#e2e8f0';
      ctxLake.beginPath();
      ctxLake.arc(celestialX, celestialY, 5, 0, Math.PI * 2);
      ctxLake.fill();
    }
    ctxLake.restore();

    const windSpeed = state.baseWind;
    ctxLake.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctxLake.font = '11px ' + getComputedStyle(document.body).getPropertyValue('--font-mono');
    ctxLake.fillText(`Wind: ${windSpeed.toFixed(1)} m/s →`, waterLeft + 12, 18);

    const bedGrad = ctxLake.createLinearGradient(0, waterBottom, 0, height);
    bedGrad.addColorStop(0, '#2d1f14');
    bedGrad.addColorStop(1, '#150d07');
    ctxLake.fillStyle = bedGrad;
    ctxLake.fillRect(waterLeft, waterBottom, waterWidth, sedimentHeight);

    ctxLake.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctxLake.font = '10px sans-serif';
    ctxLake.fillText('Lake Bed & Sediments', waterLeft + 12, height - 8);

    const depthToY = (z) => waterTop + (z / D) * waterHeight;
    const mixedLayerY = depthToY(Math.min(D, hML));
    const pxPerMeter = waterHeight / D;

    function tempToColor(t) {
      if (t <= 0) return [40, 75, 120];
      if (t <= 4) {
        const r = t / 4;
        return [Math.round(40 - 27 * r), Math.round(75 - 32 * r), Math.round(120 - 38 * r)];
      }
      if (t <= 12) {
        const r = (t - 4) / 8;
        return [Math.round(13 - 5 * r), Math.round(43 + 55 * r), Math.round(82 + 41 * r)];
      }
      if (t <= 20) {
        const r = (t - 12) / 8;
        return [Math.round(8 + 5 * r), Math.round(98 + 44 * r), Math.round(123 + 7 * r)];
      }
      const r = Math.min(1.0, (t - 20) / 10);
      return [Math.round(13 + 181 * r), Math.round(142 - 38 * r), Math.round(130 - 105 * r)];
    }

    const cTwML = tempToColor(TwML);
    const cTbot = tempToColor(Tbot);

    const waterGrad = ctxLake.createLinearGradient(0, waterTop, 0, waterBottom);
    const mlStop = Math.max(0, Math.min(1.0, (mixedLayerY - waterTop) / waterHeight));

    waterGrad.addColorStop(0, `rgb(${cTwML[0]}, ${cTwML[1]}, ${cTwML[2]})`);
    waterGrad.addColorStop(mlStop, `rgb(${cTwML[0]}, ${cTwML[1]}, ${cTwML[2]})`);
    waterGrad.addColorStop(1.0, `rgb(${cTbot[0]}, ${cTbot[1]}, ${cTbot[2]})`);

    ctxLake.fillStyle = waterGrad;
    ctxLake.fillRect(waterLeft, waterTop, waterWidth, waterHeight);

    if (hML > 0.2 && hML < D * 0.95) {
      ctxLake.save();
      ctxLake.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctxLake.setLineDash([4, 4]);
      ctxLake.lineWidth = 1.5;
      ctxLake.beginPath();
      ctxLake.moveTo(waterLeft, mixedLayerY);
      ctxLake.lineTo(waterLeft + waterWidth, mixedLayerY);
      ctxLake.stroke();

      ctxLake.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctxLake.fillRect(waterLeft + waterWidth - 110, mixedLayerY - 18, 100, 16);
      ctxLake.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctxLake.strokeRect(waterLeft + waterWidth - 110, mixedLayerY - 18, 100, 16);
      ctxLake.fillStyle = '#38bdf8';
      ctxLake.font = '10px ' + getComputedStyle(document.body).getPropertyValue('--font-mono');
      ctxLake.fillText(`h_ML: ${hML.toFixed(1)} m`, waterLeft + waterWidth - 102, mixedLayerY - 6);
      ctxLake.restore();
    }

    // Ice cover rendering
    if (hice > 0.0005) {
      // True physical scale on depth ruler (px per meter)
      const rulerIcePx = hice * pxPerMeter;
      // Minimum visual thickness of 3px so thin ice is discernible, but capped to match depth ruler
      const iceThicknessPx = Math.max(3, Math.min(waterHeight * 0.35, rulerIcePx));
      // In physics, ice floats with ~90% submerged below z=0 and ~10% freeboard above
      const freeboardPx = Math.min(2, Math.max(1, Math.round(iceThicknessPx * 0.1)));
      const iceTop = waterTop - freeboardPx;

      const iceGrad = ctxLake.createLinearGradient(0, iceTop, 0, iceTop + iceThicknessPx);
      iceGrad.addColorStop(0, 'rgba(215, 245, 255, 0.95)');
      iceGrad.addColorStop(1, 'rgba(140, 215, 245, 0.85)');
      ctxLake.fillStyle = iceGrad;
      ctxLake.fillRect(waterLeft, iceTop, waterWidth, iceThicknessPx);

      ctxLake.strokeStyle = '#a5f3fc';
      ctxLake.lineWidth = 1.2;
      ctxLake.strokeRect(waterLeft, iceTop, waterWidth, iceThicknessPx);

      // Snow layer on top of ice
      let snowPx = 0;
      if (hsnow > 0.0005) {
        snowPx = Math.max(2, Math.min(8, hsnow * pxPerMeter * 2));
        ctxLake.fillStyle = '#ffffff';
        ctxLake.fillRect(waterLeft, iceTop - snowPx, waterWidth, snowPx);
        ctxLake.strokeStyle = 'rgba(226, 232, 240, 0.8)';
        ctxLake.strokeRect(waterLeft, iceTop - snowPx, waterWidth, snowPx);
      }

      // Elegant ice telemetry badge in the sky above the ice (right-aligned, below sun path)
      ctxLake.save();
      const iceText = `Ice: ${(hice * 100).toFixed(1)} cm${hsnow > 0.001 ? ` | Snow: ${(hsnow * 100).toFixed(1)} cm` : ''}`;
      ctxLake.font = 'bold 10px ' + getComputedStyle(document.body).getPropertyValue('--font-mono');
      const badgeW = ctxLake.measureText(iceText).width + 12;
      const badgeH = 17;
      const badgeX = waterLeft + waterWidth - badgeW - 10;
      const badgeY = Math.max(28, waterTop - badgeH - (snowPx > 0 ? snowPx + 4 : 4));

      ctxLake.fillStyle = 'rgba(8, 51, 68, 0.85)';
      ctxLake.strokeStyle = '#67e8f9';
      ctxLake.lineWidth = 1;
      ctxLake.beginPath();
      if (ctxLake.roundRect) {
        ctxLake.roundRect(badgeX, badgeY, badgeW, badgeH, 3);
      } else {
        ctxLake.rect(badgeX, badgeY, badgeW, badgeH);
      }
      ctxLake.fill();
      ctxLake.stroke();

      ctxLake.fillStyle = '#a5f3fc';
      ctxLake.fillText(iceText, badgeX + 6, badgeY + 12);
      ctxLake.restore();
    } else {
      ctxLake.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctxLake.lineWidth = 1.5;
      ctxLake.beginPath();
      const waveT = Date.now() / 400;
      for (let x = waterLeft; x <= waterLeft + waterWidth; x += 5) {
        const y = waterTop + Math.sin((x / 18) + waveT) * 1.5;
        if (x === waterLeft) ctxLake.moveTo(x, y);
        else ctxLake.lineTo(x, y);
      }
      ctxLake.stroke();
    }

    // Ruler on the left with dynamically spaced ticks
    ctxLake.fillStyle = '#090d16';
    ctxLake.fillRect(0, 0, rulerWidth, height);
    ctxLake.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctxLake.beginPath();
    ctxLake.moveTo(rulerWidth, 0);
    ctxLake.lineTo(rulerWidth, height);
    ctxLake.stroke();

    ctxLake.fillStyle = '#9ca3af';
    ctxLake.font = '10px ' + getComputedStyle(document.body).getPropertyValue('--font-mono');
    ctxLake.textAlign = 'right';

    const tickInterval = getDepthTickInterval(D);
    for (let z = 0; z <= D; z += tickInterval) {
      const y = depthToY(z);
      ctxLake.beginPath();
      ctxLake.moveTo(rulerWidth - 6, y);
      ctxLake.lineTo(rulerWidth, y);
      ctxLake.stroke();
      ctxLake.fillText(`${z}m`, rulerWidth - 8, y + 3);
    }
    if (D % tickInterval !== 0 && (D % tickInterval) > (tickInterval * 0.35)) {
      const y = depthToY(D);
      ctxLake.beginPath();
      ctxLake.moveTo(rulerWidth - 6, y);
      ctxLake.lineTo(rulerWidth, y);
      ctxLake.stroke();
      ctxLake.fillText(`${D.toFixed(0)}m`, rulerWidth - 8, y + 3);
    }
    ctxLake.textAlign = 'left';
  }

  /**
   * Render Canvas 2: Temperature Profile T(z) Plot
   */
  function renderProfilePlot() {
    const { width, height } = setupDpiCanvas(UI.profileCanvas, ctxProfile);
    const { waterProfile, surfaceTemp, mixedLayerTemp, bottomTemp, mixedLayerDepth, lakeDepth, iceThickness } =
      engine.getVerticalProfile(60);

    const D = lakeDepth;
    const padLeft = 45;
    const padRight = 20;
    const padTop = 30;
    const padBottom = 35;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    let tMin = -2.0;
    let tMax = 28.0;
    if (surfaceTemp < tMin) tMin = Math.floor(surfaceTemp - 2);
    if (surfaceTemp > tMax) tMax = Math.ceil(surfaceTemp + 2);

    const tempToX = (t) => padLeft + ((t - tMin) / (tMax - tMin)) * plotW;
    const depthToY = (z) => padTop + (z / D) * plotH;

    ctxProfile.fillStyle = '#060912';
    ctxProfile.fillRect(0, 0, width, height);

    ctxProfile.lineWidth = 1;
    ctxProfile.font = '10px ' + getComputedStyle(document.body).getPropertyValue('--font-mono');
    ctxProfile.textAlign = 'center';

    for (let t = Math.ceil(tMin / 5) * 5; t <= tMax; t += 5) {
      const x = tempToX(t);
      const isFourDeg = Math.abs(t - 4.0) < 0.01;

      ctxProfile.strokeStyle = isFourDeg ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 255, 255, 0.08)';
      ctxProfile.setLineDash(isFourDeg ? [4, 3] : []);
      ctxProfile.beginPath();
      ctxProfile.moveTo(x, padTop);
      ctxProfile.lineTo(x, padTop + plotH);
      ctxProfile.stroke();

      ctxProfile.fillStyle = isFourDeg ? '#38bdf8' : '#6b7280';
      ctxProfile.fillText(`${t}°`, x, height - padBottom + 16);
      if (isFourDeg) {
        ctxProfile.save();
        ctxProfile.font = '8px sans-serif';
        ctxProfile.fillText('ρ_max', x, padTop - 6);
        ctxProfile.restore();
      }
    }
    ctxProfile.setLineDash([]);

    ctxProfile.textAlign = 'right';
    const depthInterval = getDepthTickInterval(D);
    for (let z = 0; z <= D; z += depthInterval) {
      const y = depthToY(z);
      ctxProfile.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctxProfile.beginPath();
      ctxProfile.moveTo(padLeft, y);
      ctxProfile.lineTo(padLeft + plotW, y);
      ctxProfile.stroke();

      ctxProfile.fillStyle = '#6b7280';
      ctxProfile.fillText(`${z}m`, padLeft - 8, y + 4);
    }
    if (D % depthInterval !== 0 && (D % depthInterval) > (depthInterval * 0.35)) {
      const y = depthToY(D);
      ctxProfile.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctxProfile.beginPath();
      ctxProfile.moveTo(padLeft, y);
      ctxProfile.lineTo(padLeft + plotW, y);
      ctxProfile.stroke();
      ctxProfile.fillStyle = '#6b7280';
      ctxProfile.fillText(`${D.toFixed(0)}m`, padLeft - 8, y + 4);
    }

    ctxProfile.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctxProfile.strokeRect(padLeft, padTop, plotW, plotH);

    ctxProfile.fillStyle = '#9ca3af';
    ctxProfile.font = '10px sans-serif';
    ctxProfile.textAlign = 'center';
    ctxProfile.fillText('Water Temperature (°C)', padLeft + plotW / 2, height - 6);

    ctxProfile.save();
    ctxProfile.translate(12, padTop + plotH / 2);
    ctxProfile.rotate(-Math.PI / 2);
    ctxProfile.fillText('Depth (m)', 0, 0);
    ctxProfile.restore();

    ctxProfile.save();
    ctxProfile.lineWidth = 3;
    const curveGrad = ctxProfile.createLinearGradient(0, padTop, 0, padTop + plotH);
    curveGrad.addColorStop(0, '#f97316');
    curveGrad.addColorStop(0.5, '#06b6d4');
    curveGrad.addColorStop(1, '#3b82f6');
    ctxProfile.strokeStyle = curveGrad;

    ctxProfile.beginPath();
    waterProfile.forEach((pt, idx) => {
      const x = tempToX(pt.temp);
      const y = depthToY(pt.depth);
      if (idx === 0) ctxProfile.moveTo(x, y);
      else ctxProfile.lineTo(x, y);
    });
    ctxProfile.stroke();
    ctxProfile.restore();

    if (iceThickness > 0.001) {
      const iceTopY = Math.max(padTop - 20, padTop - iceThickness * 100);
      const sfcX = tempToX(surfaceTemp);
      const freezeX = tempToX(0.0);

      ctxProfile.save();
      ctxProfile.lineWidth = 2.5;
      ctxProfile.strokeStyle = '#a5f3fc';
      ctxProfile.setLineDash([3, 2]);
      ctxProfile.beginPath();
      ctxProfile.moveTo(sfcX, iceTopY);
      ctxProfile.lineTo(freezeX, padTop);
      ctxProfile.stroke();

      ctxProfile.fillStyle = '#e0f2fe';
      ctxProfile.beginPath();
      ctxProfile.arc(sfcX, iceTopY, 4, 0, Math.PI * 2);
      ctxProfile.fill();
      ctxProfile.restore();
    }

    const sfcX = tempToX(surfaceTemp);
    const sfcY = depthToY(0);
    ctxProfile.fillStyle = '#f97316';
    ctxProfile.beginPath();
    ctxProfile.arc(sfcX, sfcY, 5, 0, Math.PI * 2);
    ctxProfile.fill();
    ctxProfile.strokeStyle = '#ffffff';
    ctxProfile.lineWidth = 1.5;
    ctxProfile.stroke();

    if (mixedLayerDepth > 0.1 && mixedLayerDepth < D * 0.98) {
      const mlX = tempToX(mixedLayerTemp);
      const mlY = depthToY(mixedLayerDepth);
      ctxProfile.fillStyle = '#06b6d4';
      ctxProfile.beginPath();
      ctxProfile.arc(mlX, mlY, 5, 0, Math.PI * 2);
      ctxProfile.fill();
      ctxProfile.strokeStyle = '#ffffff';
      ctxProfile.lineWidth = 1.5;
      ctxProfile.stroke();
    }

    const botX = tempToX(bottomTemp);
    const botY = depthToY(D);
    ctxProfile.fillStyle = '#3b82f6';
    ctxProfile.beginPath();
    ctxProfile.arc(botX, botY, 5, 0, Math.PI * 2);
    ctxProfile.fill();
    ctxProfile.strokeStyle = '#ffffff';
    ctxProfile.lineWidth = 1.5;
    ctxProfile.stroke();
  }

  /**
   * Render Canvas 3: Time Series History Chart
   */
  function renderHistoryChart() {
    const { width, height } = setupDpiCanvas(UI.historyCanvas, ctxHistory);
    const history = state.history;

    const padLeft = 45;
    const padRight = 50;
    const padTop = 20;
    const padBottom = 30;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    ctxHistory.fillStyle = '#060912';
    ctxHistory.fillRect(0, 0, width, height);

    if (history.length < 2) {
      ctxHistory.fillStyle = '#4b5563';
      ctxHistory.font = '12px sans-serif';
      ctxHistory.textAlign = 'center';
      ctxHistory.fillText('Accumulating time series data...', width / 2, height / 2);
      return;
    }

    let minT = 0;
    let maxT = 25;
    history.forEach(h => {
      minT = Math.min(minT, h.Tsfc, h.TwML, h.Tbot, h.Tair);
      maxT = Math.max(maxT, h.Tsfc, h.TwML, h.Tbot, h.Tair);
    });
    minT = Math.floor(minT - 2);
    maxT = Math.ceil(maxT + 2);

    const maxDepth = engine.lakeDepth;
    const xPos = (idx) => padLeft + (idx / (history.length - 1)) * chartW;
    const yTemp = (t) => padTop + chartH - ((t - minT) / (maxT - minT)) * chartH;
    const yDepth = (d) => padTop + (d / maxDepth) * chartH;

    ctxHistory.lineWidth = 1;
    ctxHistory.font = '10px ' + getComputedStyle(document.body).getPropertyValue('--font-mono');
    ctxHistory.textAlign = 'right';

    const tStep = (maxT - minT) <= 20 ? 5 : 10;
    for (let t = Math.ceil(minT / tStep) * tStep; t <= maxT; t += tStep) {
      const y = yTemp(t);
      ctxHistory.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctxHistory.beginPath();
      ctxHistory.moveTo(padLeft, y);
      ctxHistory.lineTo(padLeft + chartW, y);
      ctxHistory.stroke();

      ctxHistory.fillStyle = '#6b7280';
      ctxHistory.fillText(`${t}°C`, padLeft - 6, y + 3);
    }

    ctxHistory.textAlign = 'left';
    ctxHistory.fillStyle = '#a855f7';
    ctxHistory.fillText('0m', padLeft + chartW + 6, padTop + 4);
    ctxHistory.fillText(`${(maxDepth / 2).toFixed(0)}m`, padLeft + chartW + 6, padTop + chartH / 2);
    ctxHistory.fillText(`${maxDepth.toFixed(0)}m`, padLeft + chartW + 6, padTop + chartH);

    ctxHistory.textAlign = 'center';
    ctxHistory.fillStyle = '#6b7280';
    if (history.length >= 2000) {
      for (let m = 0; m < 12; m++) {
        const mIdx = Math.min(history.length - 1, Math.floor((m + 0.5) * (history.length / 12)));
        const x = xPos(mIdx);
        ctxHistory.fillText(MONTHS[m], x, height - 10);
      }
    } else {
      const timeTickInterval = Math.max(1, Math.floor(history.length / 6));
      for (let i = 0; i < history.length; i += timeTickInterval) {
        const h = history[i];
        const x = xPos(i);
        ctxHistory.fillText(`D${h.dayOfYear} ${h.hourOfDay}h`, x, height - 10);
      }
    }

    ctxHistory.save();
    let hasIce = false;
    ctxHistory.beginPath();
    for (let i = 0; i < history.length; i++) {
      const x = xPos(i);
      const iceH = history[i].hice;
      if (iceH > 0.001) hasIce = true;
      const icePx = Math.min(chartH, (iceH / 0.5) * chartH);
      const y = padTop + icePx;
      if (i === 0) ctxHistory.moveTo(x, padTop);
      ctxHistory.lineTo(x, y);
    }
    if (hasIce) {
      ctxHistory.lineTo(padLeft + chartW, padTop);
      ctxHistory.closePath();
      ctxHistory.fillStyle = 'rgba(103, 232, 249, 0.25)';
      ctxHistory.fill();
    }
    ctxHistory.restore();

    function drawSeries(getValue, strokeStyle, lineWidth = 2, dash = []) {
      ctxHistory.save();
      ctxHistory.strokeStyle = strokeStyle;
      ctxHistory.lineWidth = lineWidth;
      ctxHistory.setLineDash(dash);
      ctxHistory.beginPath();
      history.forEach((h, idx) => {
        const val = getValue(h);
        const x = xPos(idx);
        const y = yTemp(val);
        if (idx === 0) ctxHistory.moveTo(x, y);
        else ctxHistory.lineTo(x, y);
      });
      ctxHistory.stroke();
      ctxHistory.restore();
    }

    drawSeries(h => h.Tair, 'rgba(156, 163, 175, 0.4)', 1.5, [4, 4]);

    ctxHistory.save();
    ctxHistory.strokeStyle = '#c084fc';
    ctxHistory.lineWidth = 1.8;
    ctxHistory.beginPath();
    history.forEach((h, idx) => {
      const x = xPos(idx);
      const y = yDepth(h.hML);
      if (idx === 0) ctxHistory.moveTo(x, y);
      else ctxHistory.lineTo(x, y);
    });
    ctxHistory.stroke();
    ctxHistory.restore();

    drawSeries(h => h.Tbot, '#38bdf8', 2);
    drawSeries(h => h.TwML, '#fbbf24', 2.2);
    drawSeries(h => h.Tsfc, '#f43f5e', 2.5);

    // Active dataset scrub needle
    if (state.isDatasetMode && state.datasetIndex != null && history.length > 1) {
      const curIdx = Math.min(history.length - 1, state.datasetIndex);
      const curX = xPos(curIdx);
      ctxHistory.save();
      ctxHistory.strokeStyle = '#ffffff';
      ctxHistory.lineWidth = 1.5;
      ctxHistory.setLineDash([3, 3]);
      ctxHistory.beginPath();
      ctxHistory.moveTo(curX, padTop);
      ctxHistory.lineTo(curX, padTop + chartH);
      ctxHistory.stroke();

      const curH = history[curIdx];
      if (curH) {
        const curY = yTemp(curH.Tsfc);
        ctxHistory.fillStyle = '#f43f5e';
        ctxHistory.beginPath();
        ctxHistory.arc(curX, curY, 4, 0, Math.PI * 2);
        ctxHistory.fill();
        ctxHistory.strokeStyle = '#ffffff';
        ctxHistory.lineWidth = 1.5;
        ctxHistory.setLineDash([]);
        ctxHistory.stroke();
      }
      ctxHistory.restore();
    }

    ctxHistory.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctxHistory.strokeRect(padLeft, padTop, chartW, chartH);
  }

  /**
   * Render Canvas 4: Direct Calculator Thermal Profile
   */
  function renderCalcProfilePlot(profileData) {
    if (!profileData || !profileData.waterProfile) return;
    const { width, height } = setupDpiCanvas(UI.calcProfileCanvas, ctxCalcProfile);

    const { waterProfile, surfaceTemp, mixedLayerTemp, bottomTemp, mixedLayerDepth, lakeDepth, iceThickness } = profileData;
    const D = lakeDepth;
    const padLeft = 40;
    const padRight = 15;
    const padTop = 20;
    const padBottom = 25;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    let tMin = -2.0;
    let tMax = 28.0;
    if (surfaceTemp < tMin) tMin = Math.floor(surfaceTemp - 2);
    if (surfaceTemp > tMax) tMax = Math.ceil(surfaceTemp + 2);

    const tempToX = (t) => padLeft + ((t - tMin) / (tMax - tMin)) * plotW;
    const depthToY = (z) => padTop + (z / D) * plotH;

    ctxCalcProfile.fillStyle = '#060912';
    ctxCalcProfile.fillRect(0, 0, width, height);

    ctxCalcProfile.lineWidth = 1;
    ctxCalcProfile.font = '9px ' + getComputedStyle(document.body).getPropertyValue('--font-mono');
    ctxCalcProfile.textAlign = 'center';

    for (let t = Math.ceil(tMin / 5) * 5; t <= tMax; t += 5) {
      const x = tempToX(t);
      const isFourDeg = Math.abs(t - 4.0) < 0.01;

      ctxCalcProfile.strokeStyle = isFourDeg ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255, 255, 255, 0.06)';
      ctxCalcProfile.setLineDash(isFourDeg ? [3, 3] : []);
      ctxCalcProfile.beginPath();
      ctxCalcProfile.moveTo(x, padTop);
      ctxCalcProfile.lineTo(x, padTop + plotH);
      ctxCalcProfile.stroke();

      ctxCalcProfile.fillStyle = isFourDeg ? '#38bdf8' : '#6b7280';
      ctxCalcProfile.fillText(`${t}°`, x, height - padBottom + 12);
    }
    ctxCalcProfile.setLineDash([]);

    ctxCalcProfile.textAlign = 'right';
    const depthInterval = getDepthTickInterval(D);
    for (let z = 0; z <= D; z += depthInterval) {
      const y = depthToY(z);
      ctxCalcProfile.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctxCalcProfile.beginPath();
      ctxCalcProfile.moveTo(padLeft, y);
      ctxCalcProfile.lineTo(padLeft + plotW, y);
      ctxCalcProfile.stroke();

      ctxCalcProfile.fillStyle = '#6b7280';
      ctxCalcProfile.fillText(`${z}m`, padLeft - 6, y + 3);
    }
    if (D % depthInterval !== 0 && (D % depthInterval) > (depthInterval * 0.35)) {
      const y = depthToY(D);
      ctxCalcProfile.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctxCalcProfile.beginPath();
      ctxCalcProfile.moveTo(padLeft, y);
      ctxCalcProfile.lineTo(padLeft + plotW, y);
      ctxCalcProfile.stroke();
      ctxCalcProfile.fillStyle = '#6b7280';
      ctxCalcProfile.fillText(`${D.toFixed(0)}m`, padLeft - 6, y + 3);
    }

    ctxCalcProfile.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctxCalcProfile.strokeRect(padLeft, padTop, plotW, plotH);

    // Profile line
    ctxCalcProfile.save();
    ctxCalcProfile.lineWidth = 2.5;
    const curveGrad = ctxCalcProfile.createLinearGradient(0, padTop, 0, padTop + plotH);
    curveGrad.addColorStop(0, '#f97316');
    curveGrad.addColorStop(0.5, '#06b6d4');
    curveGrad.addColorStop(1, '#3b82f6');
    ctxCalcProfile.strokeStyle = curveGrad;

    ctxCalcProfile.beginPath();
    waterProfile.forEach((pt, idx) => {
      const x = tempToX(pt.temp);
      const y = depthToY(pt.depth);
      if (idx === 0) ctxCalcProfile.moveTo(x, y);
      else ctxCalcProfile.lineTo(x, y);
    });
    ctxCalcProfile.stroke();
    ctxCalcProfile.restore();

    // Ice profile if present
    if (iceThickness > 0.001) {
      const iceTopY = Math.max(padTop - 15, padTop - iceThickness * 100);
      const sfcX = tempToX(surfaceTemp);
      const freezeX = tempToX(0.0);

      ctxCalcProfile.save();
      ctxCalcProfile.lineWidth = 2;
      ctxCalcProfile.strokeStyle = '#a5f3fc';
      ctxCalcProfile.beginPath();
      ctxCalcProfile.moveTo(sfcX, iceTopY);
      ctxCalcProfile.lineTo(freezeX, padTop);
      ctxCalcProfile.stroke();
      ctxCalcProfile.restore();
    }
  }

  function renderAll() {
    if (state.activeTab === 'simulation') {
      renderLakeColumn();
      renderProfilePlot();
      renderHistoryChart();
    } else if (state.activeTab === 'calculator' && state.lastCalcResult) {
      renderCalcProfilePlot(state.lastCalcResult.profile);
    }
  }

  function animationLoop(timestamp) {
    if (state.activeTab === 'simulation' && state.isRunning && engine.isReady) {
      const interval = 1000 / state.speed;
      if (!state.lastStepTime || timestamp - state.lastStepTime >= interval) {
        stepSimulation();
        state.lastStepTime = timestamp;
      }
    }

    renderAll();
    requestAnimationFrame(animationLoop);
  }

  function applyPreset(presetKey) {
    state.preset = presetKey;
    state.annualCycle = (presetKey === 'annual');
    state.isDatasetMode = false;
    if (UI.apiPlaybackBox) UI.apiPlaybackBox.style.display = 'none';
    if (UI.tabForcingManual) {
      UI.tabForcingManual.classList.add('active');
      if (UI.tabForcingCurated) UI.tabForcingCurated.classList.remove('active');
      if (UI.tabForcingApi) UI.tabForcingApi.classList.remove('active');
      if (UI.tabForcingCustom) UI.tabForcingCustom.classList.remove('active');
      UI.panelForcingManual.style.display = 'block';
      if (UI.panelForcingCurated) UI.panelForcingCurated.style.display = 'none';
      if (UI.panelForcingApi) UI.panelForcingApi.style.display = 'none';
      if (UI.panelForcingCustom) UI.panelForcingCustom.style.display = 'none';
    }

    document.querySelectorAll('.preset-chip').forEach(el => el.classList.remove('active'));
    const btn = document.getElementById(`preset-${presetKey}`);
    if (btn) btn.classList.add('active');

    if (presetKey === 'summer') {
      state.baseAirTemp = 24.0;
      state.baseSolar = 650.0;
      state.baseWind = 2.5;
      state.snowRate = 0.0;
      engine.resetState('summer');
    } else if (presetKey === 'autumn') {
      state.baseAirTemp = 6.0;
      state.baseSolar = 120.0;
      state.baseWind = 8.5;
      state.snowRate = 0.0;
      engine.resetState('autumn');
    } else if (presetKey === 'winter') {
      state.baseAirTemp = -10.0;
      state.baseSolar = 30.0;
      state.baseWind = 3.5;
      state.snowRate = 0.00002;
      engine.resetState('winter');
    } else if (presetKey === 'spring') {
      state.baseAirTemp = 13.0;
      state.baseSolar = 450.0;
      state.baseWind = 3.0;
      state.snowRate = 0.0;
      engine.resetState('spring');
    } else if (presetKey === 'annual') {
      state.baseAirTemp = 10.0;
      state.baseSolar = 400.0;
      state.baseWind = 3.5;
      engine.resetState('spring');
    }

    UI.sliderAirTemp.value = state.baseAirTemp;
    UI.valAirTemp.textContent = `${state.baseAirTemp.toFixed(1)} °C`;
    UI.sliderSolar.value = state.baseSolar;
    UI.valSolar.textContent = `${Math.round(state.baseSolar)} W/m²`;
    UI.sliderWind.value = state.baseWind;
    UI.valWind.textContent = `${state.baseWind.toFixed(1)} m/s`;
    UI.sliderSnow.value = (state.snowRate * 3600.0).toFixed(1);
    UI.valSnow.textContent = `${(state.snowRate * 3600.0).toFixed(1)} mm/h`;

    state.history = [];
    stepSimulation();
  }

  /**
   * Reads the Direct Model Calculator inputs and executes the calculation.
   */
  function executeDirectCalculation(numSteps = 1) {
    const initialState = {
      Tsfc: parseFloat(UI.calcInitTsfc.value),
      TwML: parseFloat(UI.calcInitTwml.value),
      Tbot: parseFloat(UI.calcInitTbot.value),
      Tmnw: parseFloat(UI.calcInitTmnw.value),
      hML: parseFloat(UI.calcInitHml.value),
      CT: parseFloat(UI.calcInitCt.value),
      hice: parseFloat(UI.calcInitHice.value) / 100.0, // convert cm to m
      hsnow: parseFloat(UI.calcInitHsnow.value) / 100.0
    };

    const forcing = {
      T_air: parseFloat(UI.calcForceTair.value),
      solar: parseFloat(UI.calcForceSolar.value),
      wind: parseFloat(UI.calcForceWind.value),
      del_time: parseFloat(UI.calcForceDeltime.value)
    };

    const lakeParams = {
      depth: parseFloat(UI.calcLakeDepth.value),
      extinWater: parseFloat(UI.calcLakeExtin.value),
      fetch: 1500.0
    };

    try {
      const result = engine.runDirectCalculation(initialState, forcing, lakeParams, numSteps);
      state.lastCalcResult = result;

      // Update timing & status banner
      UI.calcStatusBadge.textContent = "Computed";
      UI.calcStatusBadge.className = "regime-badge badge-turnover";
      UI.calcTimingBanner.textContent = `Evaluated ${numSteps} timestep(s) in ${result.elapsedMs.toFixed(3)} ms via WebAssembly`;

      // Format delta badge
      function deltaBadge(diff, unit = '', digits = 2) {
        if (Math.abs(diff) < 0.001) {
          return `<span class="delta-badge delta-zero">0.00 ${unit}</span>`;
        }
        const sign = diff > 0 ? '+' : '';
        const cls = diff > 0 ? 'delta-pos' : 'delta-neg';
        return `<span class="delta-badge ${cls}">${sign}${diff.toFixed(digits)} ${unit}</span>`;
      }

      // Populate results table
      const b = result.before;
      const a = result.after;
      const d = result.delta;

      UI.calcResultsTbody.innerHTML = `
        <tr>
          <td>Surface Temp (T_sfc)</td>
          <td>${b.Tsfc.toFixed(2)} °C</td>
          <td><b>${a.Tsfc.toFixed(2)} °C</b></td>
          <td>${deltaBadge(d.Tsfc, '°C')}</td>
        </tr>
        <tr>
          <td>Mixed Layer Temp (T_wML)</td>
          <td>${b.TwML.toFixed(2)} °C</td>
          <td><b>${a.TwML.toFixed(2)} °C</b></td>
          <td>${deltaBadge(d.TwML, '°C')}</td>
        </tr>
        <tr>
          <td>Bottom Temp (T_bot)</td>
          <td>${b.Tbot.toFixed(2)} °C</td>
          <td><b>${a.Tbot.toFixed(2)} °C</b></td>
          <td>${deltaBadge(d.Tbot, '°C')}</td>
        </tr>
        <tr>
          <td>Mean Lake Temp (T_mnw)</td>
          <td>${b.Tmnw.toFixed(2)} °C</td>
          <td><b>${a.Tmnw.toFixed(2)} °C</b></td>
          <td>${deltaBadge(d.Tmnw, '°C')}</td>
        </tr>
        <tr>
          <td>Mixed Layer Depth (h_ML)</td>
          <td>${b.hML.toFixed(2)} m</td>
          <td><b>${a.hML.toFixed(2)} m</b></td>
          <td>${deltaBadge(d.hML, 'm')}</td>
        </tr>
        <tr>
          <td>Ice Thickness (h_ice)</td>
          <td>${(b.hice * 100).toFixed(2)} cm</td>
          <td><b>${(a.hice * 100).toFixed(2)} cm</b></td>
          <td>${deltaBadge(d.hice * 100, 'cm')}</td>
        </tr>
        <tr>
          <td>Thermocline Shape (C_T)</td>
          <td>${b.CT.toFixed(3)}</td>
          <td><b>${a.CT.toFixed(3)}</b></td>
          <td>${deltaBadge(d.CT, '', 3)}</td>
        </tr>
      `;

      // Render profile plot
      renderCalcProfilePlot(result.profile);

      // Fill JSON output
      const jsonExport = {
        timesteps: numSteps,
        elapsedMs: parseFloat(result.elapsedMs.toFixed(4)),
        lakeMorphometry: result.lakeParams,
        atmosphericForcing: result.forcing,
        initialState: b,
        finalState: a,
        delta: d
      };
      UI.calcJsonOutput.value = JSON.stringify(jsonExport, null, 2);

    } catch (err) {
      console.error("Direct calculation error:", err);
      UI.calcTimingBanner.textContent = `Error: ${err.message}`;
    }
  }

  function setupEventListeners() {
    // Mode tabs switching
    UI.tabSimulation.addEventListener('click', () => {
      state.activeTab = 'simulation';
      UI.tabSimulation.classList.add('active');
      UI.tabCalculator.classList.remove('active');
      UI.viewSimulation.style.display = 'block';
      UI.viewCalculator.style.display = 'none';
      UI.headerSimControls.style.display = 'flex';
      renderAll();
    });

    UI.tabCalculator.addEventListener('click', () => {
      state.activeTab = 'calculator';
      UI.tabCalculator.classList.add('active');
      UI.tabSimulation.classList.remove('active');
      UI.viewSimulation.style.display = 'none';
      UI.viewCalculator.style.display = 'block';
      UI.headerSimControls.style.display = 'none';

      // Automatically run one calculation if none has been run yet
      if (!state.lastCalcResult) {
        executeDirectCalculation(1);
      } else {
        renderCalcProfilePlot(state.lastCalcResult.profile);
      }
    });

    // Direct Calculator button events
    UI.btnCalcStep.addEventListener('click', () => {
      executeDirectCalculation(1);
    });

    UI.btnCalcNSteps.addEventListener('click', () => {
      const n = Math.max(1, Math.min(720, parseInt(UI.calcStepsCount.value, 10) || 24));
      executeDirectCalculation(n);
    });

    UI.btnCalcCopySim.addEventListener('click', () => {
      const s = engine.state;
      UI.calcInitTsfc.value = s.Tsfc.toFixed(2);
      UI.calcInitTwml.value = s.TwML.toFixed(2);
      UI.calcInitTbot.value = s.Tbot.toFixed(2);
      UI.calcInitTmnw.value = s.Tmnw.toFixed(2);
      UI.calcInitHml.value = s.hML.toFixed(2);
      UI.calcInitCt.value = s.CT.toFixed(3);
      UI.calcInitHice.value = (s.hice * 100).toFixed(2);
      UI.calcInitHsnow.value = (s.hsnow * 100).toFixed(2);

      UI.calcForceTair.value = state.baseAirTemp.toFixed(1);
      UI.calcForceSolar.value = Math.round(state.baseSolar);
      UI.calcForceWind.value = state.baseWind.toFixed(1);
      UI.calcLakeDepth.value = engine.lakeDepth.toFixed(1);
      UI.calcLakeExtin.value = engine.extinWater.toFixed(1);

      executeDirectCalculation(1);
    });

    UI.btnCalcApplySim.addEventListener('click', () => {
      if (state.lastCalcResult && state.lastCalcResult.after) {
        const a = state.lastCalcResult.after;
        const K = 273.15;
        const mv = engine.memView;
        const p = engine.ptrs;

        engine.state = { ...a };
        mv.setFloat64(p.T_sfc_p, a.Tsfc + K, true);
        mv.setFloat64(p.T_wML_in, a.TwML + K, true);
        mv.setFloat64(p.T_mnw_in, a.Tmnw + K, true);
        mv.setFloat64(p.T_bot_in, a.Tbot + K, true);
        mv.setFloat64(p.h_ML_in, a.hML, true);
        mv.setFloat64(p.C_T_in, a.CT, true);
        mv.setFloat64(p.h_ice_in, a.hice, true);
        mv.setFloat64(p.T_ice_in, a.Tice + K, true);
        mv.setFloat64(p.h_snow_in, a.hsnow, true);
        mv.setFloat64(p.T_snow_in, a.Tsnow + K, true);

        // Switch to simulation view to observe
        UI.tabSimulation.click();
      }
    });

    UI.btnCalcPresetSummer.addEventListener('click', () => {
      UI.calcInitTsfc.value = "18.0";
      UI.calcInitTwml.value = "18.0";
      UI.calcInitTbot.value = "4.2";
      UI.calcInitTmnw.value = "11.0";
      UI.calcInitHml.value = "3.2";
      UI.calcInitCt.value = "0.65";
      UI.calcInitHice.value = "0.0";
      UI.calcInitHsnow.value = "0.0";
      UI.calcForceTair.value = "26.0";
      UI.calcForceSolar.value = "750";
      UI.calcForceWind.value = "2.0";
      executeDirectCalculation(1);
    });

    UI.btnCalcPresetWinter.addEventListener('click', () => {
      UI.calcInitTsfc.value = "-2.0";
      UI.calcInitTwml.value = "0.0";
      UI.calcInitTbot.value = "3.9";
      UI.calcInitTmnw.value = "1.8";
      UI.calcInitHml.value = "10.0";
      UI.calcInitCt.value = "0.55";
      UI.calcInitHice.value = "5.0";
      UI.calcInitHsnow.value = "1.0";
      UI.calcForceTair.value = "-12.0";
      UI.calcForceSolar.value = "30";
      UI.calcForceWind.value = "3.5";
      executeDirectCalculation(1);
    });

    UI.btnCopyJson.addEventListener('click', () => {
      navigator.clipboard.writeText(UI.calcJsonOutput.value).then(() => {
        UI.btnCopyJson.textContent = "Copied!";
        setTimeout(() => { UI.btnCopyJson.textContent = "Copy JSON"; }, 2000);
      });
    });

    // Simulation Controls
    UI.btnPlay.addEventListener('click', () => {
      state.isRunning = !state.isRunning;
      UI.btnPlay.textContent = state.isRunning ? 'Pause' : 'Run';
      UI.clockDot.className = 'clock-dot' + (state.isRunning ? '' : ' paused');
    });

    UI.btnStep.addEventListener('click', () => {
      state.isRunning = false;
      UI.btnPlay.textContent = 'Run';
      UI.clockDot.className = 'clock-dot paused';
      if (state.isDatasetMode && state.datasetResults.length > 0) {
        applyDatasetStep(Math.min(state.datasetResults.length - 1, state.datasetIndex + 1));
      } else {
        stepSimulation();
      }
    });

    UI.btnDay.addEventListener('click', () => {
      if (state.isDatasetMode && state.datasetResults.length > 0) {
        applyDatasetStep(Math.min(state.datasetResults.length - 1, state.datasetIndex + 24));
      } else {
        for (let i = 0; i < 24; i++) stepSimulation();
      }
    });

    UI.btnReset.addEventListener('click', () => {
      if (state.isDatasetMode) {
        applyDatasetStep(0);
      } else {
        applyPreset(state.preset);
      }
    });

    UI.speedSelect.addEventListener('change', (e) => {
      state.speed = parseInt(e.target.value, 10);
    });

    // Forcing Mode switching
    if (UI.tabForcingManual) {
      UI.tabForcingManual.addEventListener('click', () => {
        state.forcingMode = 'manual';
        state.isDatasetMode = false;
        UI.tabForcingManual.classList.add('active');
        if (UI.tabForcingCurated) UI.tabForcingCurated.classList.remove('active');
        if (UI.tabForcingApi) UI.tabForcingApi.classList.remove('active');
        if (UI.tabForcingCustom) UI.tabForcingCustom.classList.remove('active');
        UI.panelForcingManual.style.display = 'block';
        if (UI.panelForcingCurated) UI.panelForcingCurated.style.display = 'none';
        if (UI.panelForcingApi) UI.panelForcingApi.style.display = 'none';
        if (UI.panelForcingCustom) UI.panelForcingCustom.style.display = 'none';
        if (UI.apiPlaybackBox) UI.apiPlaybackBox.style.display = 'none';
        state.isRunning = true;
        UI.btnPlay.textContent = 'Pause';
        UI.clockDot.className = 'clock-dot';
      });
    }

    if (UI.tabForcingCurated) {
      UI.tabForcingCurated.addEventListener('click', () => {
        state.forcingMode = 'curated';
        UI.tabForcingCurated.classList.add('active');
        if (UI.tabForcingManual) UI.tabForcingManual.classList.remove('active');
        if (UI.tabForcingApi) UI.tabForcingApi.classList.remove('active');
        if (UI.tabForcingCustom) UI.tabForcingCustom.classList.remove('active');
        UI.panelForcingCurated.style.display = 'block';
        if (UI.panelForcingManual) UI.panelForcingManual.style.display = 'none';
        if (UI.panelForcingApi) UI.panelForcingApi.style.display = 'none';
        if (UI.panelForcingCustom) UI.panelForcingCustom.style.display = 'none';
        if (state.datasetResults && state.datasetResults.length > 0) {
          state.isDatasetMode = true;
          if (UI.apiPlaybackBox) UI.apiPlaybackBox.style.display = 'flex';
        } else {
          state.isRunning = false;
          UI.btnPlay.textContent = 'Run';
          UI.clockDot.className = 'clock-dot paused';
        }
      });
    }

    if (UI.tabForcingApi) {
      UI.tabForcingApi.addEventListener('click', () => {
        state.forcingMode = 'api';
        UI.tabForcingApi.classList.add('active');
        if (UI.tabForcingManual) UI.tabForcingManual.classList.remove('active');
        if (UI.tabForcingCurated) UI.tabForcingCurated.classList.remove('active');
        if (UI.tabForcingCustom) UI.tabForcingCustom.classList.remove('active');
        UI.panelForcingApi.style.display = 'block';
        if (UI.panelForcingManual) UI.panelForcingManual.style.display = 'none';
        if (UI.panelForcingCurated) UI.panelForcingCurated.style.display = 'none';
        if (UI.panelForcingCustom) UI.panelForcingCustom.style.display = 'none';
        if (state.datasetResults && state.datasetResults.length > 0) {
          state.isDatasetMode = true;
          if (UI.apiPlaybackBox) UI.apiPlaybackBox.style.display = 'flex';
        } else {
          state.isRunning = false;
          UI.btnPlay.textContent = 'Run';
          UI.clockDot.className = 'clock-dot paused';
        }
      });
    }

    if (UI.tabForcingCustom) {
      UI.tabForcingCustom.addEventListener('click', () => {
        state.forcingMode = 'custom';
        UI.tabForcingCustom.classList.add('active');
        if (UI.tabForcingManual) UI.tabForcingManual.classList.remove('active');
        if (UI.tabForcingCurated) UI.tabForcingCurated.classList.remove('active');
        if (UI.tabForcingApi) UI.tabForcingApi.classList.remove('active');
        UI.panelForcingCustom.style.display = 'block';
        if (UI.panelForcingManual) UI.panelForcingManual.style.display = 'none';
        if (UI.panelForcingCurated) UI.panelForcingCurated.style.display = 'none';
        if (UI.panelForcingApi) UI.panelForcingApi.style.display = 'none';
        if (state.datasetResults && state.datasetResults.length > 0) {
          state.isDatasetMode = true;
          if (UI.apiPlaybackBox) UI.apiPlaybackBox.style.display = 'flex';
        } else {
          state.isRunning = false;
          UI.btnPlay.textContent = 'Run';
          UI.clockDot.className = 'clock-dot paused';
        }
      });
    }

    // Curated Lake select change
    if (UI.curatedLakeSelect) {
      UI.curatedLakeSelect.addEventListener('change', (e) => {
        updateCuratedLakeCard(e.target.value);
      });
    }

    // Curated Lake load button
    if (UI.btnLoadCurated) {
      UI.btnLoadCurated.addEventListener('click', handleLoadCuratedLake);
    }

    // Custom File Drag and Drop events
    if (UI.customDropZone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        UI.customDropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          UI.customDropZone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        UI.customDropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          UI.customDropZone.classList.remove('dragover');
        });
      });

      UI.customDropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
          handleCustomFileSelected(files[0]);
        }
      });

      UI.customDropZone.addEventListener('click', () => {
        if (UI.customFileInput) UI.customFileInput.click();
      });

      UI.customDropZone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (UI.customFileInput) UI.customFileInput.click();
        }
      });
    }

    if (UI.customFileInput) {
      UI.customFileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
          handleCustomFileSelected(files[0]);
        }
      });
    }

    if (UI.btnLoadSampleDat) {
      UI.btnLoadSampleDat.addEventListener('click', handleLoadSamplePotsdam);
    }

    if (UI.btnRunCustom) {
      UI.btnRunCustom.addEventListener('click', handleRunCustomSimulation);
    }

    if (UI.customTimestepSelect) {
      UI.customTimestepSelect.addEventListener('change', (e) => {
        const delTime = parseFloat(e.target.value);
        if (state.customParsedData && state.customParsedData.steps) {
          const isHourly = delTime === 3600;
          state.customParsedData.steps.forEach((s, idx) => {
            s.del_time = delTime;
            if (isHourly) {
              s.hourOfDay = idx % 24;
              s.dayOfYear = Math.floor(idx / 24) % 365 + 1;
              s.timeStr = `Day ${s.dayOfYear}, ${s.hourOfDay}:00`;
            } else {
              s.hourOfDay = 12;
              s.dayOfYear = (idx % 365) + 1;
              s.timeStr = `Day ${idx + 1}`;
            }
          });
          if (UI.customStepDetected) {
            UI.customStepDetected.textContent = isHourly ? 'Hourly (1h)' : 'Daily (24h)';
          }
        }
      });
    }

    // Lake Preset Dropdown in API mode
    if (UI.apiLakePreset) {
      UI.apiLakePreset.addEventListener('change', (e) => {
        const pKey = e.target.value;
        if (pKey && LAKE_PRESETS[pKey]) {
          const info = LAKE_PRESETS[pKey];
          UI.apiLat.value = info.lat;
          UI.apiLon.value = info.lon;
          state.waterClarity = info.clarity;
          if (UI.selectClarity) UI.selectClarity.value = info.clarity.toString();
          engine.setLakeParameters({ extinWater: info.clarity });
          updateLakeDepth(info.depth);
        }
      });
    }

    // Fetch API button
    if (UI.btnFetchApi) {
      UI.btnFetchApi.addEventListener('click', handleFetchApiWeather);
    }

    // Scrubber input
    if (UI.apiScrubber) {
      UI.apiScrubber.addEventListener('input', (e) => {
        const idx = parseInt(e.target.value, 10);
        applyDatasetStep(idx);
      });
    }

    UI.presetSummer.addEventListener('click', () => applyPreset('summer'));
    UI.presetAutumn.addEventListener('click', () => applyPreset('autumn'));
    UI.presetWinter.addEventListener('click', () => applyPreset('winter'));
    UI.presetSpring.addEventListener('click', () => applyPreset('spring'));
    UI.presetAnnual.addEventListener('click', () => applyPreset('annual'));

    UI.sliderAirTemp.addEventListener('input', (e) => {
      state.baseAirTemp = parseFloat(e.target.value);
      UI.valAirTemp.textContent = `${state.baseAirTemp.toFixed(1)} °C`;
    });

    UI.sliderSolar.addEventListener('input', (e) => {
      state.baseSolar = parseFloat(e.target.value);
      UI.valSolar.textContent = `${Math.round(state.baseSolar)} W/m²`;
    });

    UI.sliderWind.addEventListener('input', (e) => {
      state.baseWind = parseFloat(e.target.value);
      UI.valWind.textContent = `${state.baseWind.toFixed(1)} m/s`;
    });

    UI.sliderSnow.addEventListener('input', (e) => {
      const mmPerHour = parseFloat(e.target.value);
      state.snowRate = mmPerHour / 3600.0;
      UI.valSnow.textContent = `${mmPerHour.toFixed(1)} mm/h`;
    });

    UI.chkDiurnal.addEventListener('change', (e) => {
      state.diurnalCycle = e.target.checked;
    });

    if (UI.sliderDepth) {
      UI.sliderDepth.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
          updateLakeDepth(val, true, false);
        }
      });
    }

    if (UI.inputDepth) {
      UI.inputDepth.addEventListener('change', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
          updateLakeDepth(val, true, true);
        } else {
          updateLakeDepth(state.lakeDepth, true, true);
        }
      });
      UI.inputDepth.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && val >= 0.5 && val <= 2500) {
          updateLakeDepth(val, false, true);
        }
      });
    }

    UI.selectClarity.addEventListener('change', (e) => {
      const extin = parseFloat(e.target.value);
      state.waterClarity = extin;
      engine.setLakeParameters({ extinWater: extin });
    });

    // Tooltips
    UI.profileCanvas.addEventListener('mousemove', (e) => {
      const rect = UI.profileCanvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const D = engine.lakeDepth;
      const padLeft = 45;
      const padRight = 20;
      const padTop = 30;
      const padBottom = 35;
      const plotW = rect.width - padLeft - padRight;
      const plotH = rect.height - padTop - padBottom;

      if (mouseX >= padLeft && mouseX <= padLeft + plotW && mouseY >= padTop && mouseY <= padTop + plotH) {
        const depth = ((mouseY - padTop) / plotH) * D;
        const { waterProfile } = engine.getVerticalProfile(60);
        let closest = waterProfile[0];
        let minDiff = Infinity;
        waterProfile.forEach(p => {
          const diff = Math.abs(p.depth - depth);
          if (diff < minDiff) {
            minDiff = diff;
            closest = p;
          }
        });

        UI.profileTooltip.style.display = 'block';
        UI.profileTooltip.style.left = `${mouseX + 12}px`;
        UI.profileTooltip.style.top = `${mouseY - 10}px`;
        UI.profileTooltip.innerHTML = `<div>Depth: <b>${closest.depth.toFixed(1)} m</b></div><div>Temp: <b>${closest.temp.toFixed(2)} °C</b></div>`;
      } else {
        UI.profileTooltip.style.display = 'none';
      }
    });

    UI.profileCanvas.addEventListener('mouseleave', () => {
      UI.profileTooltip.style.display = 'none';
    });

    UI.historyCanvas.addEventListener('mousemove', (e) => {
      const rect = UI.historyCanvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const padLeft = 45;
      const padRight = 50;
      const chartW = rect.width - padLeft - padRight;

      if (state.history.length > 1 && mouseX >= padLeft && mouseX <= padLeft + chartW) {
        const ratio = (mouseX - padLeft) / chartW;
        const idx = Math.min(state.history.length - 1, Math.max(0, Math.round(ratio * (state.history.length - 1))));
        const h = state.history[idx];

        UI.historyTooltip.style.display = 'block';
        UI.historyTooltip.style.left = `${Math.min(rect.width - 160, mouseX + 10)}px`;
        UI.historyTooltip.style.top = `${Math.max(10, mouseY - 70)}px`;
        UI.historyTooltip.innerHTML = `
          <div style="font-weight:600; color:#38bdf8;">${h.timeStr ? h.timeStr : `Day ${h.dayOfYear}, ${h.hourOfDay}:00`}</div>
          <div>T_sfc: <b style="color:#f43f5e;">${h.Tsfc.toFixed(1)}°C</b></div>
          <div>T_wML: <b style="color:#fbbf24;">${h.TwML.toFixed(1)}°C</b></div>
          <div>T_bot: <b style="color:#38bdf8;">${h.Tbot.toFixed(1)}°C</b></div>
          <div>h_ML: <b style="color:#c084fc;">${h.hML.toFixed(1)} m</b></div>
          ${h.hice > 0.0005 ? `<div>Ice: <b style="color:#67e8f9;">${(h.hice*100).toFixed(1)} cm</b></div>` : ''}
        `;
      } else {
        UI.historyTooltip.style.display = 'none';
      }
    });

    UI.historyCanvas.addEventListener('mouseleave', () => {
      UI.historyTooltip.style.display = 'none';
    });

    window.addEventListener('resize', () => {
      renderAll();
    });
  }

  async function start() {
    try {
      UI.clockText.textContent = 'Initializing WASM Engine...';
      await engine.init();
      UI.clockText.textContent = 'FLake WASM Ready';

      setupEventListeners();
      updateLakeDepth(state.lakeDepth);
      updateCuratedLakeCard('heiligensee');
      applyPreset('summer');

      requestAnimationFrame(animationLoop);
    } catch (err) {
      console.error("Failed to start FLake simulation:", err);
      UI.clockText.textContent = 'Initialization error';
      alert('Error initializing WebAssembly module: ' + err.message);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
