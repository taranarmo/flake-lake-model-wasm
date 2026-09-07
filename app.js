/**
 * FLake WebAssembly Dashboard Application
 */

(function () {
  'use strict';

  // Instantiate FLakeEngine
  const engine = new FLakeEngine();

  // Application State
  const state = {
    isRunning: true,
    speed: 10,           // steps per second
    lastStepTime: 0,
    preset: 'summer',
    diurnalCycle: true,  // day/night variation
    annualCycle: false,  // 365-day seasonal cycle

    // Manual forcing inputs (base values)
    baseAirTemp: 24.0,   // deg C
    baseSolar: 650.0,    // W/m2
    baseWind: 2.5,       // m/s
    snowRate: 0.0,       // kg/m2/s
    qLw: null,           // auto

    // Lake geometry
    lakeDepth: 12.0,
    waterClarity: 1.0,

    // Time series history buffer (up to 720 hours = 30 days)
    history: [],
    maxHistoryLength: 720
  };

  // Month names for date formatting
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DAYS_IN_MONTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

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

  // DOM Elements Cache
  const UI = {
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
    historyTooltip: document.getElementById('history-tooltip')
  };

  // Canvas Contexts
  const ctxLake = UI.lakeCanvas.getContext('2d');
  const ctxProfile = UI.profileCanvas.getContext('2d');
  const ctxHistory = UI.historyCanvas.getContext('2d');

  /**
   * Helper to configure high-DPI canvas
   */
  function setupDpiCanvas(canvas, ctx) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    return { width: rect.width, height: rect.height };
  }

  /**
   * Calculates instantaneous meteorological forcing based on base inputs,
   * diurnal cycle, and optional annual cycle.
   */
  function getInstantaneousForcing() {
    let airTemp = state.baseAirTemp;
    let solar = state.baseSolar;
    const wind = state.baseWind;
    const snowRate = state.snowRate;

    // Annual cycle modulation if active
    if (state.annualCycle) {
      // Sinusoidal seasonal wave peaking around Day 200 (mid-July)
      const day = engine.dayOfYear;
      const annualPhase = (2 * Math.PI * (day - 110)) / 365;
      airTemp = 10.0 + 15.0 * Math.sin(annualPhase); // -5C in winter to +25C in summer
      const maxSolarSeason = 300.0 + 350.0 * Math.sin(annualPhase); // 0-650 W/m2 peak
      solar = Math.max(0, maxSolarSeason);
    }

    // Diurnal cycle modulation if active
    if (state.diurnalCycle) {
      const h = engine.hourOfDay;
      // Solar diurnal cycle: peaks at 12:00, 0 at night (6:00 to 18:00)
      if (h >= 6 && h <= 18) {
        const sunElev = Math.sin((Math.PI * (h - 6)) / 12);
        solar = solar * sunElev * 1.57; // scale so average matches base
      } else {
        solar = 0.0;
      }

      // Air temp diurnal cycle: minimum around 06:00, peak around 15:00
      const tempDiurnal = 4.0 * Math.sin((2 * Math.PI * (h - 9)) / 24);
      airTemp += tempDiurnal;
    }

    // Auto calculate snowfall rate if freezing air and high cloud/humidity
    let effectiveSnowRate = snowRate;
    if (airTemp < 0 && state.preset === 'winter' && snowRate === 0) {
      effectiveSnowRate = 0.00002; // light snow (~0.07 mm/hr water equivalent)
    }

    return {
      T_air: airTemp,
      solar: Math.max(0, solar),
      wind: Math.max(0.5, wind),
      snowRate: effectiveSnowRate,
      Q_lw: state.qLw
    };
  }

  /**
   * Executes a single simulation step and records history.
   */
  function stepSimulation() {
    const forcing = getInstantaneousForcing();
    const res = engine.step(forcing);

    // Save to time series buffer
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

  /**
   * Updates all UI labels and telemetry badges.
   */
  function updateTelemetry(res, forcing) {
    UI.teleTsfc.textContent = res.Tsfc.toFixed(1);
    UI.teleTwML.textContent = res.TwML.toFixed(1);
    UI.teleTbot.textContent = res.Tbot.toFixed(1);
    UI.teleTmnw.textContent = res.Tmnw.toFixed(1);
    UI.teleHml.textContent = res.hML.toFixed(1);
    UI.teleHice.textContent = (res.hice * 100).toFixed(1);
    UI.teleCt.textContent = res.CT.toFixed(3);

    // Date & Clock
    UI.clockText.textContent = getSimulatedDateString(engine.dayOfYear, engine.hourOfDay);

    // Dynamic regime badge
    const regime = engine.getRegime();
    UI.regimeBadge.textContent = regime.label;
    UI.regimeBadge.className = 'regime-badge ' + regime.badgeClass;
    UI.regimeDesc.textContent = regime.desc;

    // Show live forcing values
    UI.valAirTemp.textContent = `${forcing.T_air.toFixed(1)} °C`;
    UI.valSolar.textContent = `${Math.round(forcing.solar)} W/m²`;
  }

  /**
   * Render Canvas 1: Lake Cross-Section Column
   */
  function renderLakeColumn() {
    const { width, height } = setupDpiCanvas(UI.lakeCanvas, ctxLake);
    const { Tsfc, TwML, Tbot, hML, hice, hsnow } = engine.state;
    const D = engine.lakeDepth;

    // Dimensions
    const rulerWidth = 44;
    const skyHeight = 65;
    const sedimentHeight = 25;
    const waterTop = skyHeight;
    const waterBottom = height - sedimentHeight;
    const waterHeight = waterBottom - waterTop;
    const waterLeft = rulerWidth;
    const waterWidth = width - rulerWidth;

    // 1. Sky & Atmosphere Background
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

    // Sun or Moon
    const celestialX = waterLeft + (waterWidth * ((engine.hourOfDay + 6) % 24)) / 24;
    const celestialY = 28 + 12 * Math.sin(((engine.hourOfDay % 12) / 12) * Math.PI);
    ctxLake.save();
    if (isDay) {
      // Glowing Sun
      const sunGlow = ctxLake.createRadialGradient(celestialX, celestialY, 2, celestialX, celestialY, 20);
      sunGlow.addColorStop(0, 'rgba(255, 235, 120, 1.0)');
      sunGlow.addColorStop(0.5, 'rgba(255, 180, 50, 0.4)');
      sunGlow.addColorStop(1, 'rgba(255, 160, 0, 0)');
      ctxLake.fillStyle = sunGlow;
      ctxLake.beginPath();
      ctxLake.arc(celestialX, celestialY, 20, 0, Math.PI * 2);
      ctxLake.fill();

      ctxLake.fillStyle = '#fffae0';
      ctxLake.beginPath();
      ctxLake.arc(celestialX, celestialY, 7, 0, Math.PI * 2);
      ctxLake.fill();
    } else {
      // Moon
      ctxLake.fillStyle = '#e2e8f0';
      ctxLake.beginPath();
      ctxLake.arc(celestialX, celestialY, 6, 0, Math.PI * 2);
      ctxLake.fill();
    }
    ctxLake.restore();

    // Wind vector indicator on surface
    const windSpeed = state.baseWind;
    ctxLake.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctxLake.font = '11px ' + getComputedStyle(document.body).getPropertyValue('--font-mono');
    ctxLake.fillText(`Wind: ${windSpeed.toFixed(1)} m/s →`, waterLeft + 12, skyHeight - 12);

    // 2. Lake Sediment (Bed)
    const bedGrad = ctxLake.createLinearGradient(0, waterBottom, 0, height);
    bedGrad.addColorStop(0, '#2d1f14');
    bedGrad.addColorStop(1, '#150d07');
    ctxLake.fillStyle = bedGrad;
    ctxLake.fillRect(waterLeft, waterBottom, waterWidth, sedimentHeight);

    ctxLake.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctxLake.font = '10px sans-serif';
    ctxLake.fillText('Lake Bed & Sediments', waterLeft + 12, height - 8);

    // 3. Water Column Rendering with Thermal Color Gradients
    const depthToY = (z) => waterTop + (z / D) * waterHeight;
    const mixedLayerY = depthToY(Math.min(D, hML));

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

    // Water Column Gradient
    const waterGrad = ctxLake.createLinearGradient(0, waterTop, 0, waterBottom);
    const mlStop = Math.max(0, Math.min(1.0, (mixedLayerY - waterTop) / waterHeight));

    waterGrad.addColorStop(0, `rgb(${cTwML[0]}, ${cTwML[1]}, ${cTwML[2]})`);
    waterGrad.addColorStop(mlStop, `rgb(${cTwML[0]}, ${cTwML[1]}, ${cTwML[2]})`);
    waterGrad.addColorStop(1.0, `rgb(${cTbot[0]}, ${cTbot[1]}, ${cTbot[2]})`);

    ctxLake.fillStyle = waterGrad;
    ctxLake.fillRect(waterLeft, waterTop, waterWidth, waterHeight);

    // Mixed Layer Waves or Boundary Indicator
    if (hML > 0.2 && hML < D * 0.95) {
      ctxLake.save();
      ctxLake.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctxLake.setLineDash([4, 4]);
      ctxLake.lineWidth = 1.5;
      ctxLake.beginPath();
      ctxLake.moveTo(waterLeft, mixedLayerY);
      ctxLake.lineTo(waterLeft + waterWidth, mixedLayerY);
      ctxLake.stroke();

      // Label tag for mixed layer depth
      ctxLake.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctxLake.fillRect(waterLeft + waterWidth - 110, mixedLayerY - 18, 100, 16);
      ctxLake.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctxLake.strokeRect(waterLeft + waterWidth - 110, mixedLayerY - 18, 100, 16);
      ctxLake.fillStyle = '#38bdf8';
      ctxLake.font = '10px ' + getComputedStyle(document.body).getPropertyValue('--font-mono');
      ctxLake.fillText(`h_ML: ${hML.toFixed(1)} m`, waterLeft + waterWidth - 102, mixedLayerY - 6);
      ctxLake.restore();
    }

    // 4. Ice and Snow Layer
    if (hice > 0.0005) {
      const iceThicknessPx = Math.max(4, Math.min(45, hice * 250));
      const iceTop = waterTop - iceThicknessPx;

      const iceGrad = ctxLake.createLinearGradient(0, iceTop, 0, waterTop);
      iceGrad.addColorStop(0, 'rgba(200, 240, 255, 0.95)');
      iceGrad.addColorStop(1, 'rgba(130, 210, 240, 0.85)');
      ctxLake.fillStyle = iceGrad;
      ctxLake.fillRect(waterLeft, iceTop, waterWidth, iceThicknessPx);

      ctxLake.strokeStyle = '#a5f3fc';
      ctxLake.lineWidth = 1.5;
      ctxLake.strokeRect(waterLeft, iceTop, waterWidth, iceThicknessPx);

      ctxLake.fillStyle = '#083344';
      ctxLake.font = 'bold 11px sans-serif';
      ctxLake.fillText(`❄ ICE: ${(hice * 100).toFixed(1)} cm`, waterLeft + 16, iceTop + iceThicknessPx / 2 + 4);

      if (hsnow > 0.0005) {
        const snowPx = Math.max(3, Math.min(25, hsnow * 200));
        ctxLake.fillStyle = '#ffffff';
        ctxLake.fillRect(waterLeft, iceTop - snowPx, waterWidth, snowPx);
        ctxLake.strokeStyle = 'rgba(226, 232, 240, 0.8)';
        ctxLake.strokeRect(waterLeft, iceTop - snowPx, waterWidth, snowPx);
      }
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

    // 5. Depth Ruler on Left
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

    const tickInterval = D <= 10 ? 1 : D <= 25 ? 2 : 5;
    for (let z = 0; z <= D; z += tickInterval) {
      const y = depthToY(z);
      ctxLake.beginPath();
      ctxLake.moveTo(rulerWidth - 6, y);
      ctxLake.lineTo(rulerWidth, y);
      ctxLake.stroke();
      ctxLake.fillText(`${z}m`, rulerWidth - 8, y + 3);
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

    // Background
    ctxProfile.fillStyle = '#060912';
    ctxProfile.fillRect(0, 0, width, height);

    // Grid lines for Temperature
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

    // Grid lines for Depth
    ctxProfile.textAlign = 'right';
    const depthInterval = D <= 10 ? 2 : D <= 25 ? 5 : 10;
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

    // Plot Frame
    ctxProfile.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctxProfile.strokeRect(padLeft, padTop, plotW, plotH);

    // Labels
    ctxProfile.fillStyle = '#9ca3af';
    ctxProfile.font = '10px sans-serif';
    ctxProfile.textAlign = 'center';
    ctxProfile.fillText('Water Temperature (°C)', padLeft + plotW / 2, height - 6);

    ctxProfile.save();
    ctxProfile.translate(12, padTop + plotH / 2);
    ctxProfile.rotate(-Math.PI / 2);
    ctxProfile.fillText('Depth (m)', 0, 0);
    ctxProfile.restore();

    // Plot Thermocline Profile Curve
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

    // If ice is present, plot linear ice temperature profile
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

    // Key points markers
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

    // Left Axis (Temperature) Grid
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

    // Right Axis (Depth) Grid labels
    ctxHistory.textAlign = 'left';
    ctxHistory.fillStyle = '#a855f7';
    ctxHistory.fillText('0m', padLeft + chartW + 6, padTop + 4);
    ctxHistory.fillText(`${(maxDepth / 2).toFixed(0)}m`, padLeft + chartW + 6, padTop + chartH / 2);
    ctxHistory.fillText(`${maxDepth.toFixed(0)}m`, padLeft + chartW + 6, padTop + chartH);

    // Time Axis (X-axis ticks)
    ctxHistory.textAlign = 'center';
    ctxHistory.fillStyle = '#6b7280';
    const timeTickInterval = Math.max(1, Math.floor(history.length / 6));
    for (let i = 0; i < history.length; i += timeTickInterval) {
      const h = history[i];
      const x = xPos(i);
      ctxHistory.fillText(`D${h.dayOfYear} ${h.hourOfDay}h`, x, height - 10);
    }

    // Draw Ice Thickness as shaded region
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

    // Draw Series
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

    // Air Temp (Gray dashed)
    drawSeries(h => h.Tair, 'rgba(156, 163, 175, 0.4)', 1.5, [4, 4]);

    // Mixed Layer Depth (Purple)
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

    // Bottom Temp (Teal)
    drawSeries(h => h.Tbot, '#38bdf8', 2);

    // Mixed Layer Temp (Amber)
    drawSeries(h => h.TwML, '#fbbf24', 2.2);

    // Surface Temp (Coral/Red)
    drawSeries(h => h.Tsfc, '#f43f5e', 2.5);

    // Chart Border
    ctxHistory.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctxHistory.strokeRect(padLeft, padTop, chartW, chartH);
  }

  /**
   * Main Render Loop
   */
  function renderAll() {
    renderLakeColumn();
    renderProfilePlot();
    renderHistoryChart();
  }

  /**
   * Simulation Animation Cycle
   */
  function animationLoop(timestamp) {
    if (state.isRunning && engine.isReady) {
      const interval = 1000 / state.speed;
      if (!state.lastStepTime || timestamp - state.lastStepTime >= interval) {
        stepSimulation();
        state.lastStepTime = timestamp;
      }
    }

    renderAll();
    requestAnimationFrame(animationLoop);
  }

  /**
   * Scenario Presets Configurator
   */
  function applyPreset(presetKey) {
    state.preset = presetKey;
    state.annualCycle = (presetKey === 'annual');

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

    // Sync sliders
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
   * Event Listeners Registration
   */
  function setupEventListeners() {
    // Play / Pause
    UI.btnPlay.addEventListener('click', () => {
      state.isRunning = !state.isRunning;
      UI.btnPlay.textContent = state.isRunning ? '⏸ Pause' : '▶ Run';
      UI.clockDot.className = 'clock-dot' + (state.isRunning ? '' : ' paused');
    });

    // Step (+1h)
    UI.btnStep.addEventListener('click', () => {
      state.isRunning = false;
      UI.btnPlay.textContent = '▶ Run';
      UI.clockDot.className = 'clock-dot paused';
      stepSimulation();
    });

    // Fast-Forward (+24h = 1 Day)
    UI.btnDay.addEventListener('click', () => {
      for (let i = 0; i < 24; i++) {
        stepSimulation();
      }
    });

    // Reset
    UI.btnReset.addEventListener('click', () => {
      applyPreset(state.preset);
    });

    // Speed selector
    UI.speedSelect.addEventListener('change', (e) => {
      state.speed = parseInt(e.target.value, 10);
    });

    // Presets
    UI.presetSummer.addEventListener('click', () => applyPreset('summer'));
    UI.presetAutumn.addEventListener('click', () => applyPreset('autumn'));
    UI.presetWinter.addEventListener('click', () => applyPreset('winter'));
    UI.presetSpring.addEventListener('click', () => applyPreset('spring'));
    UI.presetAnnual.addEventListener('click', () => applyPreset('annual'));

    // Forcing Sliders
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

    // Lake geometry controls
    UI.sliderDepth.addEventListener('input', (e) => {
      const depth = parseFloat(e.target.value);
      state.lakeDepth = depth;
      UI.valDepth.textContent = `${depth.toFixed(1)} m`;
      engine.setLakeParameters({ depth });
    });

    UI.selectClarity.addEventListener('change', (e) => {
      const extin = parseFloat(e.target.value);
      state.waterClarity = extin;
      engine.setLakeParameters({ extinWater: extin });
    });

    // Profile Canvas Tooltip Hover
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

    // History Canvas Tooltip Hover
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
          <div style="font-weight:600; color:#38bdf8;">Day ${h.dayOfYear}, ${h.hourOfDay}:00</div>
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

    // Handle Window Resize
    window.addEventListener('resize', () => {
      renderAll();
    });
  }

  /**
   * Application Entry Point
   */
  async function start() {
    try {
      UI.clockText.textContent = 'Initializing WASM Engine...';
      await engine.init();
      UI.clockText.textContent = 'FLake WASM Ready';

      setupEventListeners();
      applyPreset('summer');

      // Kick off render and simulation loop
      requestAnimationFrame(animationLoop);
    } catch (err) {
      console.error("Failed to start FLake simulation:", err);
      UI.clockText.textContent = 'Initialization error';
      alert('Error initializing WebAssembly module: ' + err.message);
    }
  }

  // Launch when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
