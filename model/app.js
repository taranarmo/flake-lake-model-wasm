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
    isRunning: false,
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
    forcingMode: 'api',      // 'api' | 'curated' | 'custom' | 'manual'
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
    },
    constance: {
      id: 'constance',
      name: 'Lake Constance / Bodensee',
      location: 'Germany / Switzerland / Austria',
      regime: 'Warm Monomictic (Deep Pre-Alpine)',
      regimeShort: 'Monomictic',
      regimeColor: '#2563eb',
      depth: 45.0,
      fetch: 15000,
      clarity: 0.5,
      lat: 47.63,
      description: 'Large sub-alpine lake that stratifies intensely in summer and mixes throughout winter with rare freezing events.',
      source: 'ERA5 Reanalysis (2024)',
      file: 'constance.json'
    },
    superior: {
      id: 'superior',
      name: 'Lake Superior',
      location: 'USA / Canada',
      regime: 'Cold Dimictic (Laurentian Great Lake)',
      regimeShort: 'Cold Dimictic',
      regimeColor: '#0284c7',
      depth: 50.0,
      fetch: 35000,
      clarity: 0.25,
      lat: 47.70,
      description: 'Largest freshwater lake by surface area, displaying strong spring thermal bars and winter ice dynamics.',
      source: 'ERA5 Reanalysis (2024)',
      file: 'superior.json'
    },
    tahoe: {
      id: 'tahoe',
      name: 'Lake Tahoe',
      location: 'California / Nevada, USA',
      regime: 'Ultra-Oligotrophic Monomictic (Subalpine)',
      regimeShort: 'Deep Alpine',
      regimeColor: '#4f46e5',
      depth: 50.0,
      fetch: 18000,
      clarity: 0.15,
      lat: 39.09,
      description: 'Renowned for exceptional optical clarity and immense thermal volume; does not freeze in winter.',
      source: 'ERA5 Reanalysis (2024)',
      file: 'tahoe.json'
    },
    victoria: {
      id: 'victoria',
      name: 'Lake Victoria',
      location: 'Uganda / Kenya / Tanzania',
      regime: 'Tropical Monomictic / Polymictic (Equatorial)',
      regimeShort: 'Tropical',
      regimeColor: '#d97706',
      depth: 40.0,
      fetch: 30000,
      clarity: 1.0,
      lat: -1.00,
      description: 'Largest tropical freshwater lake; experiences minimal seasonal solar variance with stratification governed by monsoonal wind patterns.',
      source: 'ERA5 Reanalysis (2024)',
      file: 'victoria.json'
    },
    ladoga: {
      id: 'ladoga',
      name: 'Lake Ladoga',
      location: 'Northwestern Russia',
      regime: 'Subarctic Dimictic (Boreal)',
      regimeShort: 'Cold / Ice',
      regimeColor: '#0891b2',
      depth: 51.0,
      fetch: 30000,
      clarity: 0.6,
      lat: 61.00,
      description: 'Largest lake in Europe by surface area, characterized by persistent seasonal ice cover and pronounced spring inverse stratification.',
      source: 'ERA5 Reanalysis (2024)',
      file: 'ladoga.json'
    },
    balaton: {
      id: 'balaton',
      name: 'Lake Balaton',
      location: 'Hungary',
      regime: 'Shallow Polymictic (Steppe Lake)',
      regimeShort: 'Polymictic',
      regimeColor: '#059669',
      depth: 3.2,
      fetch: 12000,
      clarity: 1.8,
      lat: 46.85,
      description: 'Largest lake in Central Europe; highly turbulent shallow basin that responds almost instantaneously to atmospheric forcing.',
      source: 'ERA5 Reanalysis (2024)',
      file: 'balaton.json'
    }
  };

  const PERPETUAL_BENCHMARKS = {
    mueggelsee: {
      id: 'mueggelsee',
      name: 'Lake Müggelsee / Stechlin',
      location: 'Brandenburg, Germany',
      regime: 'Dimictic',
      depth: 7.5,
      fetch: 2000.0,
      clarity: 1.0,
      lat: 52.0,
      file: 'mueggelsee.json',
      meanTair: 11.6,
      description: 'Temperate polymictic/dimictic lake in Brandenburg, Germany. Historical FLake calibration and validation benchmark.'
    },
    sakhalin_reference: {
      id: 'sakhalin_reference',
      name: 'Sakhalin Reference Lake',
      location: 'Far East, Russia',
      regime: 'Dimictic',
      depth: 7.5,
      fetch: 2000.0,
      clarity: 1.0,
      lat: 49.0,
      file: 'sakhalin_reference.json',
      meanTair: 3.2,
      description: 'Historical ground truth benchmark lake from IGB Berlin CGI FLAKEweb.exe validation suite.'
    },
    ladoga: {
      id: 'ladoga',
      name: 'Lake Ladoga',
      location: 'Northwestern Russia',
      regime: 'Dimictic',
      depth: 51.0,
      fetch: 80000.0,
      clarity: 0.5,
      lat: 60.0,
      file: 'ladoga.json',
      meanTair: 5.4,
      description: 'Largest freshwater lake in Europe with extensive seasonal ice cover and deep hypolimnion.'
    },
    superior: {
      id: 'superior',
      name: 'Lake Superior',
      location: 'USA / Canada',
      regime: 'Oligomictic / Dimictic',
      depth: 147.0,
      fetch: 100000.0,
      clarity: 0.25,
      lat: 48.0,
      file: 'superior.json',
      meanTair: 5.8,
      description: 'Deepest and coldest of the North American Great Lakes with vast thermal inertia.'
    },
    geneva: {
      id: 'geneva',
      name: 'Lake Geneva / Constance',
      location: 'Switzerland / France',
      regime: 'Warm Monomictic',
      depth: 154.0,
      fetch: 15000.0,
      clarity: 0.4,
      lat: 46.0,
      file: 'geneva.json',
      meanTair: 11.4,
      description: 'Deep sub-alpine lake that remains ice-free year-round and circulates in winter.'
    },
    baikal: {
      id: 'baikal',
      name: 'Lake Baikal',
      location: 'Siberia, Russia',
      regime: 'Dimictic',
      depth: 200.0,
      fetch: 50000.0,
      clarity: 0.2,
      lat: 53.0,
      file: 'baikal.json',
      meanTair: 0.8,
      description: 'Deepest ancient lake in the world; freezes December to May with crystal-clear ice cover.'
    },
    victoria: {
      id: 'victoria',
      name: 'Lake Victoria',
      location: 'Uganda / Kenya / Tanzania',
      regime: 'Warm Monomictic / Oligomictic',
      depth: 40.0,
      fetch: 60000.0,
      clarity: 1.2,
      lat: -1.0,
      file: 'victoria.json',
      meanTair: 23.4,
      description: 'Tropical African Great Lake; warm year-round with seasonal wind-driven mixing.'
    },
    tahoe: {
      id: 'tahoe',
      name: 'Lake Tahoe',
      location: 'Sierra Nevada, USA',
      regime: 'Warm Monomictic',
      depth: 300.0,
      fetch: 18000.0,
      clarity: 0.15,
      lat: 39.0,
      file: 'tahoe.json',
      meanTair: 9.8,
      description: 'Deep, ultra-oligotrophic alpine lake; never completely freezes.'
    },
    titicaca: {
      id: 'titicaca',
      name: 'Lake Titicaca',
      location: 'Bolivia / Peru',
      regime: 'Warm Monomictic',
      depth: 107.0,
      fetch: 30000.0,
      clarity: 0.3,
      lat: -16.0,
      file: 'titicaca.json',
      meanTair: 9.2,
      description: 'High-altitude tropical lake at 3,812 m elevation with intense year-round solar forcing.'
    },
    chad: {
      id: 'chad',
      name: 'Lake Chad',
      location: 'Chad / Nigeria',
      regime: 'Polymictic',
      depth: 4.0,
      fetch: 5000.0,
      clarity: 2.5,
      lat: 12.0,
      file: 'chad.json',
      meanTair: 27.8,
      description: 'Shallow, endorheic lake in the Sahel with frequent diurnal mixing and wind stirring.'
    },
    arctic_tundra: {
      id: 'arctic_tundra',
      name: 'Pechora Tundra Lake',
      location: 'Russian Arctic',
      regime: 'Cold Monomictic / Dimictic',
      depth: 5.0,
      fetch: 3000.0,
      clarity: 1.0,
      lat: 68.0,
      file: 'arctic_tundra.json',
      meanTair: -2.8,
      description: 'High-latitude tundra lake with 8+ months of thick winter ice cover.'
    },
    mediterranean: {
      id: 'mediterranean',
      name: 'North African Lake',
      location: 'Morocco / Mediterranean',
      regime: 'Warm Monomictic',
      depth: 12.0,
      fetch: 4000.0,
      clarity: 1.2,
      lat: 34.0,
      file: 'mediterranean.json',
      meanTair: 18.2,
      description: 'Warm Mediterranean climate lake with hot dry summers and mild winters.'
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
    victoria: { name: 'Lake Victoria', lat: -1.00, lon: 33.00, depth: 40.0, clarity: 1.0 },
    ladoga: { name: 'Lake Ladoga', lat: 61.00, lon: 31.50, depth: 51.0, clarity: 0.6 },
    balaton: { name: 'Lake Balaton', lat: 46.85, lon: 17.75, depth: 3.2, clarity: 1.8 }
  };

  /**
   * GeoLocationPicker
   * 100% self-hosted, offline HTML5 Canvas vector map component.
   * Renders Natural Earth landmasses, major lakes, country borders,
   * lake presets, and target selection pin with pan/zoom.
   * Zero external API keys or tile network requests.
   */
  class GeoLocationPicker {
    constructor(options = {}) {
      this.canvas = options.canvas || document.getElementById('geo-picker-canvas');
      this.coordsDisplay = options.coordsDisplay || document.getElementById('geo-map-cursor-coords');
      this.tooltip = options.tooltip || document.getElementById('geo-map-tooltip');
      this.onLocationChange = options.onLocationChange || null;
      this.onPresetSelect = options.onPresetSelect || null;

      this.targetLat = typeof options.initialLat === 'number' ? options.initialLat : 52.43;
      this.targetLon = typeof options.initialLon === 'number' ? options.initialLon : 13.63;

      this.centerLat = this.targetLat;
      this.centerLon = this.targetLon;
      this.zoom = 1.0;

      this.isDragging = false;
      this.dragMode = 'pan'; // 'pan' | 'target'
      this.lastMouseX = 0;
      this.lastMouseY = 0;
      this.pulsePhase = 0;

      this.ctx = null;
      this.geoData = null;
      this.isInitialized = false;
      this._animFrame = null;
    }

    init() {
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      this.geoData = (typeof window !== 'undefined' && window.FLAKE_WORLD_GEO) ? window.FLAKE_WORLD_GEO : null;

      this._bindEvents();
      this.render();
      this._startPulseAnimation();

      if (window.ResizeObserver && this.canvas.parentElement) {
        const ro = new ResizeObserver(() => {
          this.render();
        });
        ro.observe(this.canvas.parentElement);
      }

      this.isInitialized = true;
    }

    _bindEvents() {
      const c = this.canvas;

      c.addEventListener('mousedown', (e) => this._onMouseDown(e));
      window.addEventListener('mousemove', (e) => this._onMouseMove(e));
      window.addEventListener('mouseup', (e) => this._onMouseUp(e));
      c.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
      c.addEventListener('mouseleave', () => {
        if (this.tooltip) this.tooltip.style.display = 'none';
      });

      // Touch support
      let lastTouchDist = 0;
      c.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          const rect = c.getBoundingClientRect();
          const t = e.touches[0];
          this._startDrag(t.clientX - rect.left, t.clientY - rect.top);
        } else if (e.touches.length === 2) {
          lastTouchDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
        }
      }, { passive: true });

      c.addEventListener('touchmove', (e) => {
        const rect = c.getBoundingClientRect();
        if (e.touches.length === 1 && this.isDragging) {
          const t = e.touches[0];
          this._dragMove(t.clientX - rect.left, t.clientY - rect.top);
        } else if (e.touches.length === 2 && lastTouchDist > 0) {
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          const factor = dist / lastTouchDist;
          this.zoom = Math.max(1.0, Math.min(15.0, this.zoom * factor));
          lastTouchDist = dist;
          this.render();
        }
      }, { passive: true });

      c.addEventListener('touchend', () => {
        this._endDrag();
        lastTouchDist = 0;
      });
    }

    _startDrag(mouseX, mouseY) {
      this.lastMouseX = mouseX;
      this.lastMouseY = mouseY;
      this.isDragging = true;

      // Check if clicking preset lake
      const presetHit = this._hitTestPreset(mouseX, mouseY);
      if (presetHit) {
        this.isDragging = false;
        this.setCoordinates(presetHit.lake.lat, presetHit.lake.lon, true);
        if (this.onPresetSelect) this.onPresetSelect(presetHit.key, presetHit.lake);
        return;
      }

      // Check if clicking target pin
      const targetScreen = this._coordsToScreen(this.targetLon, this.targetLat);
      if (targetScreen && Math.hypot(targetScreen.x - mouseX, targetScreen.y - mouseY) < 14) {
        this.dragMode = 'target';
        this.canvas.style.cursor = 'grabbing';
      } else {
        this.dragMode = 'pan';
        this.canvas.style.cursor = 'grabbing';
        this._dragStartX = mouseX;
        this._dragStartY = mouseY;
      }
    }

    _dragMove(mouseX, mouseY) {
      if (!this.isDragging) return;

      const rect = this.canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const baseWorldW = Math.max(w, h * 2);
      const worldW = baseWorldW * this.zoom;
      const worldH = worldW / 2;

      if (this.dragMode === 'target') {
        const geo = this._screenToCoords(mouseX, mouseY);
        this.targetLon = geo.lon;
        this.targetLat = geo.lat;
        this.render();
        if (this.onLocationChange) this.onLocationChange(this.targetLat, this.targetLon);
      } else {
        const dx = mouseX - this.lastMouseX;
        const dy = mouseY - this.lastMouseY;
        this.centerLon -= (dx / worldW) * 360;
        this.centerLat += (dy / worldH) * 180;
        this._clampCenter();
        this.render();
      }

      this.lastMouseX = mouseX;
      this.lastMouseY = mouseY;
    }

    _endDrag() {
      if (!this.isDragging) return;

      if (this.dragMode === 'pan' && typeof this._dragStartX === 'number') {
        const dist = Math.hypot(this.lastMouseX - this._dragStartX, this.lastMouseY - this._dragStartY);
        if (dist < 5) {
          const geo = this._screenToCoords(this.lastMouseX, this.lastMouseY);
          this.targetLon = geo.lon;
          this.targetLat = geo.lat;
          this.render();
          if (this.onLocationChange) this.onLocationChange(this.targetLat, this.targetLon);
        }
      }

      this.isDragging = false;
      this.canvas.style.cursor = 'crosshair';
    }

    _onMouseDown(e) {
      const rect = this.canvas.getBoundingClientRect();
      this._startDrag(e.clientX - rect.left, e.clientY - rect.top);
    }

    _onMouseMove(e) {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (this.isDragging) {
        this._dragMove(mouseX, mouseY);
        return;
      }

      if (mouseX >= 0 && mouseX <= rect.width && mouseY >= 0 && mouseY <= rect.height) {
        const geo = this._screenToCoords(mouseX, mouseY);
        if (this.coordsDisplay) {
          const latStr = Math.abs(geo.lat).toFixed(2) + '°' + (geo.lat >= 0 ? 'N' : 'S');
          const lonStr = Math.abs(geo.lon).toFixed(2) + '°' + (geo.lon >= 0 ? 'E' : 'W');
          this.coordsDisplay.textContent = `${latStr}, ${lonStr}`;
        }

        const hit = this._hitTestPreset(mouseX, mouseY);
        if (hit) {
          this.canvas.style.cursor = 'pointer';
          if (this.tooltip) {
            this.tooltip.innerHTML = `<b>${hit.lake.name}</b><br>${hit.lake.lat.toFixed(2)}°N, ${hit.lake.lon.toFixed(2)}°E • Depth: ${hit.lake.depth}m`;
            this.tooltip.style.left = `${mouseX}px`;
            this.tooltip.style.top = `${mouseY}px`;
            this.tooltip.style.display = 'block';
          }
        } else {
          const targetScreen = this._coordsToScreen(this.targetLon, this.targetLat);
          if (targetScreen && Math.hypot(targetScreen.x - mouseX, targetScreen.y - mouseY) < 14) {
            this.canvas.style.cursor = 'grab';
          } else {
            this.canvas.style.cursor = 'crosshair';
          }
          if (this.tooltip) this.tooltip.style.display = 'none';
        }
      }
    }

    _onMouseUp() {
      this._endDrag();
    }

    _onWheel(e) {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const factor = e.deltaY < 0 ? 1.25 : 0.8;
      this.zoomAt(mouseX, mouseY, factor);
    }

    zoomAt(mouseX, mouseY, factor) {
      const rect = this.canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const baseWorldW = Math.max(w, h * 2);

      const oldZoom = this.zoom;
      const newZoom = Math.max(1.0, Math.min(15.0, oldZoom * factor));
      if (newZoom === oldZoom) return;

      const oldWorldW = baseWorldW * oldZoom;
      const oldWorldH = oldWorldW / 2;

      const lonUnderMouse = (mouseX - w / 2) / oldWorldW * 360 + this.centerLon;
      const latUnderMouse = this.centerLat - (mouseY - h / 2) / oldWorldH * 180;

      this.zoom = newZoom;
      const newWorldW = baseWorldW * newZoom;
      const newWorldH = newWorldW / 2;

      this.centerLon = lonUnderMouse - (mouseX - w / 2) / newWorldW * 360;
      this.centerLat = latUnderMouse + (mouseY - h / 2) / newWorldH * 180;

      this._clampCenter();
      this.render();
    }

    zoomIn() {
      const rect = this.canvas.getBoundingClientRect();
      this.zoomAt(rect.width / 2, rect.height / 2, 1.35);
    }

    zoomOut() {
      const rect = this.canvas.getBoundingClientRect();
      this.zoomAt(rect.width / 2, rect.height / 2, 0.74);
    }

    resetView() {
      this.zoom = 1.0;
      this.centerLat = this.targetLat;
      this.centerLon = this.targetLon;
      this._clampCenter();
      this.render();
    }

    _clampCenter() {
      while (this.centerLon > 180) this.centerLon -= 360;
      while (this.centerLon < -180) this.centerLon += 360;
      this.centerLat = Math.max(-75, Math.min(75, this.centerLat));
    }

    _coordsToScreen(lon, lat) {
      const rect = this.canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const baseWorldW = Math.max(w, h * 2);
      const worldW = baseWorldW * this.zoom;
      const worldH = worldW / 2;

      let dLon = lon - this.centerLon;
      while (dLon > 180) dLon -= 360;
      while (dLon < -180) dLon += 360;

      const x = (dLon / 360) * worldW + w / 2;
      const y = ((this.centerLat - lat) / 180) * worldH + h / 2;

      return { x, y };
    }

    _screenToCoords(x, y) {
      const rect = this.canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const baseWorldW = Math.max(w, h * 2);
      const worldW = baseWorldW * this.zoom;
      const worldH = worldW / 2;

      let lon = (x - w / 2) / worldW * 360 + this.centerLon;
      while (lon > 180) lon -= 360;
      while (lon < -180) lon += 360;

      let lat = this.centerLat - (y - h / 2) / worldH * 180;
      lat = Math.max(-85, Math.min(85, lat));

      return { lon, lat };
    }

    _hitTestPreset(mouseX, mouseY) {
      if (typeof LAKE_PRESETS === 'undefined') return null;
      for (const [key, lake] of Object.entries(LAKE_PRESETS)) {
        const pt = this._coordsToScreen(lake.lon, lake.lat);
        if (pt && Math.hypot(pt.x - mouseX, pt.y - mouseY) <= 10) {
          return { key, lake };
        }
      }
      return null;
    }

    setCoordinates(lat, lon, pan = true, zoom = null) {
      this.targetLat = Math.max(-85, Math.min(85, lat));
      let nLon = lon;
      while (nLon > 180) nLon -= 360;
      while (nLon < -180) nLon += 360;
      this.targetLon = nLon;

      if (typeof zoom === 'number') {
        this.zoom = zoom;
      }
      if (pan) {
        this.centerLat = this.targetLat;
        this.centerLon = this.targetLon;
        this._clampCenter();
      }
      this.render();
    }

    invalidate() {
      this.render();
    }

    _startPulseAnimation() {
      let lastTime = 0;
      const animate = (time) => {
        if (!lastTime) lastTime = time;
        const delta = (time - lastTime) / 1000;
        lastTime = time;

        this.pulsePhase = (this.pulsePhase + delta * 2.5) % (Math.PI * 2);
        this.render();
        this._animFrame = requestAnimationFrame(animate);
      };
      this._animFrame = requestAnimationFrame(animate);
    }

    render() {
      if (!this.canvas || !this.ctx) return;
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const dpr = window.devicePixelRatio || 1;
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);

      if (this.canvas.width !== Math.floor(w * dpr) || this.canvas.height !== Math.floor(h * dpr)) {
        this.canvas.width = Math.floor(w * dpr);
        this.canvas.height = Math.floor(h * dpr);
      }

      const ctx = this.ctx;
      ctx.resetTransform();
      ctx.scale(dpr, dpr);

      // 1. Ocean Background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, w, h);

      // 2. Graticule Lines (every 30 deg)
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#131b2e';
      ctx.setLineDash([2, 4]);

      for (let lat = -60; lat <= 60; lat += 30) {
        const pt = this._coordsToScreen(0, lat);
        if (pt) {
          ctx.beginPath();
          ctx.moveTo(0, pt.y);
          ctx.lineTo(w, pt.y);
          ctx.stroke();
        }
      }

      for (let lon = -180; lon <= 180; lon += 30) {
        const pt = this._coordsToScreen(lon, 0);
        if (pt && pt.x >= -50 && pt.x <= w + 50) {
          ctx.beginPath();
          ctx.moveTo(pt.x, 0);
          ctx.lineTo(pt.x, h);
          ctx.stroke();
        }
      }

      // Equator
      ctx.setLineDash([]);
      ctx.strokeStyle = '#1b253b';
      const eq = this._coordsToScreen(0, 0);
      if (eq) {
        ctx.beginPath();
        ctx.moveTo(0, eq.y);
        ctx.lineTo(w, eq.y);
        ctx.stroke();
      }

      // 3. Draw Land Polygons
      if (this.geoData && this.geoData.land) {
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;

        for (const geom of this.geoData.land) {
          this._drawGeometry(ctx, geom, true, true);
        }
      }

      // 4. Draw Country Borders
      if (this.geoData && this.geoData.borders) {
        ctx.strokeStyle = '#26334d';
        ctx.lineWidth = 0.8;
        ctx.setLineDash([2, 2]);

        for (const border of this.geoData.borders) {
          ctx.beginPath();
          let started = false;
          let prevX = 0;
          for (let i = 0; i < border.length; i++) {
            const pt = this._coordsToScreen(border[i][0], border[i][1]);
            if (!pt) continue;
            if (started && Math.abs(pt.x - prevX) > 200) {
              ctx.moveTo(pt.x, pt.y);
            } else if (!started) {
              ctx.moveTo(pt.x, pt.y);
              started = true;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
            prevX = pt.x;
          }
          if (started) ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      // 5. Draw Major Lakes
      if (this.geoData && this.geoData.lakes) {
        ctx.fillStyle = '#090d16';
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1;

        for (const lake of this.geoData.lakes) {
          this._drawGeometry(ctx, lake.geometry, true, true);
        }
      }

      // 6. Draw Lake Presets Markers
      if (typeof LAKE_PRESETS !== 'undefined') {
        for (const [key, lake] of Object.entries(LAKE_PRESETS)) {
          const pt = this._coordsToScreen(lake.lon, lake.lat);
          if (!pt || pt.x < -20 || pt.x > w + 20 || pt.y < -20 || pt.y > h + 20) continue;

          // Halo
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(6, 182, 212, 0.25)';
          ctx.fill();

          // Dot
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = '#06b6d4';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          // Label if zoomed in
          if (this.zoom >= 3.0) {
            ctx.font = '10px sans-serif';
            const txt = lake.name.split(',')[0];
            const tw = ctx.measureText(txt).width;
            ctx.fillStyle = 'rgba(11, 15, 25, 0.85)';
            ctx.fillRect(pt.x + 6, pt.y - 12, tw + 6, 14);
            ctx.fillStyle = '#7dd3fc';
            ctx.fillText(txt, pt.x + 9, pt.y - 2);
          }
        }
      }

      // 7. Draw Target Pin & Pulse
      const tPt = this._coordsToScreen(this.targetLon, this.targetLat);
      if (tPt && tPt.x >= -30 && tPt.x <= w + 30 && tPt.y >= -30 && tPt.y <= h + 30) {
        const pulseR = 8 + (Math.sin(this.pulsePhase) + 1) * 7;
        const pulseAlpha = 0.6 * (1 - (pulseR - 8) / 14);
        ctx.beginPath();
        ctx.arc(tPt.x, tPt.y, pulseR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(56, 189, 248, ${pulseAlpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(tPt.x, tPt.y + 1, 5, 2.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fill();

        ctx.save();
        ctx.translate(tPt.x, tPt.y);

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-6, -10, -9, -15, -9, -20);
        ctx.arc(0, -20, 9, Math.PI, 0, false);
        ctx.bezierCurveTo(9, -15, 6, -10, 0, 0);
        ctx.closePath();

        ctx.fillStyle = '#0284c7';
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, -20, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.restore();
      }
    }

    _drawGeometry(ctx, geom, fill = true, stroke = true) {
      if (!geom) return;
      const type = geom.type;

      if (type === 'Polygon') {
        this._drawPolygon(ctx, geom.coordinates, fill, stroke);
      } else if (type === 'MultiPolygon') {
        for (const poly of geom.coordinates) {
          this._drawPolygon(ctx, poly, fill, stroke);
        }
      }
    }

    _drawPolygon(ctx, rings, fill = true, stroke = true) {
      if (!rings || rings.length === 0) return;

      ctx.beginPath();
      for (const ring of rings) {
        if (!ring || ring.length < 2) continue;
        let started = false;
        let prevX = 0;

        for (let i = 0; i < ring.length; i++) {
          const pt = this._coordsToScreen(ring[i][0], ring[i][1]);
          if (!pt) continue;

          if (started && Math.abs(pt.x - prevX) > 200) {
            ctx.moveTo(pt.x, pt.y);
          } else if (!started) {
            ctx.moveTo(pt.x, pt.y);
            started = true;
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
          prevX = pt.x;
        }
        ctx.closePath();
      }

      if (fill) ctx.fill('evenodd');
      if (stroke) ctx.stroke();
    }
  }

  function getSimulatedDateString(dayOfYear, hourOfDay) {
    if (dayOfYear == null || isNaN(dayOfYear)) dayOfYear = 1;
    if (hourOfDay == null || isNaN(hourOfDay)) hourOfDay = 0;
    let day = Math.max(1, Math.min(365, Math.floor(dayOfYear)));
    let monthIdx = 0;
    for (let i = 0; i < DAYS_IN_MONTHS.length; i++) {
      if (day <= DAYS_IN_MONTHS[i]) {
        monthIdx = i;
        break;
      }
      day -= DAYS_IN_MONTHS[i];
    }
    const h = Math.floor(hourOfDay).toString().padStart(2, '0');
    return `Day ${Math.floor(dayOfYear)} (${MONTHS[monthIdx]} ${day.toString().padStart(2, '0')}) ${h}:00`;
  }

  /**
   * Calculates the date boundaries for the latest complete hydrological year (water year).
   * A hydrological year in the Northern Hemisphere starts October 1st and ends September 30th.
   * If current date is past Oct 5, the hydrological year ending Sep 30 of the current calendar year is complete.
   * Otherwise, the hydrological year ending Sep 30 of the previous calendar year is used.
   */
  function getHydrologicalYearDates(refDate = new Date()) {
    const year = refDate.getUTCFullYear ? refDate.getUTCFullYear() : refDate.getFullYear();
    const month = refDate.getUTCMonth ? refDate.getUTCMonth() : refDate.getMonth(); // 0 = Jan, 9 = Oct
    const date = refDate.getUTCDate ? refDate.getUTCDate() : refDate.getDate();

    let endYear = year;
    if (month < 9 || (month === 9 && date < 5)) {
      endYear = year - 1;
    }
    const startYear = endYear - 1;
    const startD = new Date(Date.UTC(startYear, 9, 1, 0, 0, 0));
    const endD = new Date(Date.UTC(endYear, 8, 30, 23, 59, 59));
    return { startYear, endYear, startD, endD };
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
    tabForcingPerpetual: document.getElementById('tab-forcing-perpetual'),
    tabForcingApi: document.getElementById('tab-forcing-api'),
    tabForcingCustom: document.getElementById('tab-forcing-custom'),
    panelForcingManual: document.getElementById('panel-forcing-manual'),
    panelForcingCurated: document.getElementById('panel-forcing-curated'),
    panelForcingPerpetual: document.getElementById('panel-forcing-perpetual'),
    panelForcingApi: document.getElementById('panel-forcing-api'),
    panelForcingCustom: document.getElementById('panel-forcing-custom'),

    // Forcing Mode Context & Guide Modal
    modePillBadge: document.getElementById('mode-pill-badge'),
    modeContextDesc: document.getElementById('mode-context-desc'),
    btnOpenModeModal: document.getElementById('btn-open-mode-modal'),
    btnCloseModeModal: document.getElementById('btn-close-mode-modal'),
    btnModalDismiss: document.getElementById('btn-modal-dismiss'),
    forcingModeModal: document.getElementById('forcing-mode-modal'),

    // Perpetual Climatology Benchmark Controls
    perpetualLakeSelect: document.getElementById('perpetual-lake-select'),
    perpetualLakeCard: document.getElementById('perpetual-lake-card'),
    perpetualName: document.getElementById('perpetual-name'),
    perpetualRegimePill: document.getElementById('perpetual-regime-pill'),
    perpetualDepth: document.getElementById('perpetual-depth'),
    perpetualFetch: document.getElementById('perpetual-fetch'),
    perpetualClarity: document.getElementById('perpetual-clarity'),
    perpetualLat: document.getElementById('perpetual-lat'),
    perpetualDesc: document.getElementById('perpetual-desc'),
    perpetualTairMean: document.getElementById('perpetual-tair-mean'),
    perpetualMaxCycles: document.getElementById('perpetual-max-cycles'),
    perpetualTol: document.getElementById('perpetual-tol'),
    perpetualConvergenceBox: document.getElementById('perpetual-convergence-box'),
    perpetualCyclesBadge: document.getElementById('perpetual-cycles-badge'),
    perpetualConvergenceText: document.getElementById('perpetual-convergence-text'),
    perpetualDiagRegime: document.getElementById('perpetual-diag-regime'),
    perpetualDiagIce: document.getElementById('perpetual-diag-ice'),
    perpetualDiagHice: document.getElementById('perpetual-diag-hice'),
    perpetualDiagStrat: document.getElementById('perpetual-diag-strat'),
    perpetualDiagTbot: document.getElementById('perpetual-diag-tbot'),
    btnRunPerpetual: document.getElementById('btn-run-perpetual'),
    perpetualStatusBox: document.getElementById('perpetual-status-box'),
    perpetualStatusText: document.getElementById('perpetual-status-text'),

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
    btnMapZoomIn: document.getElementById('btn-map-zoom-in'),
    btnMapZoomOut: document.getElementById('btn-map-zoom-out'),
    btnMapReset: document.getElementById('btn-map-reset'),
    btnToggleMap: document.getElementById('btn-toggle-map'),
    geoPickerWrapper: document.getElementById('geo-picker-wrapper'),
    geoPickerCanvas: document.getElementById('geo-picker-canvas'),
    geoMapCursorCoords: document.getElementById('geo-map-cursor-coords'),
    geoMapTooltip: document.getElementById('geo-map-tooltip'),
    apiPeriod: document.getElementById('api-period'),
    btnFetchApi: document.getElementById('btn-fetch-api'),
    apiStatusBox: document.getElementById('api-status-box'),
    apiStatusText: document.getElementById('api-status-text'),
    apiPlaybackBox: document.getElementById('api-playback-box'),
    apiSourcePill: document.getElementById('api-source-pill'),
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

  const FORCING_MODE_INFO = {
    api: {
      name: 'Weather API',
      badgeClass: 'pill-api',
      desc: 'Hourly reanalysis (ERA5) and weather forecasts for any coordinate globally via Open-Meteo & NASA POWER.'
    },
    perpetual: {
      name: 'Perpetual Year',
      badgeClass: 'pill-perpetual',
      desc: 'Repeats annual climatology across multiple cycles to solve for cyclic thermal equilibrium and limnological regime.'
    },
    curated: {
      name: 'Curated Lakes',
      badgeClass: 'pill-curated',
      desc: 'Peer-reviewed observational meteorology and morphology datasets from iconic global lake calibration studies.'
    },
    custom: {
      name: 'Custom File',
      badgeClass: 'pill-custom',
      desc: 'Upload or drag-and-drop local .dat or .csv meteorological time series for custom lake simulation.'
    },
    manual: {
      name: 'Synthetic Data',
      badgeClass: 'pill-manual',
      desc: 'Idealized diurnal sinusoidal oscillations with interactive sliders for parameter sensitivity exploration.'
    }
  };

  function updateForcingModeContext(mode) {
    const info = FORCING_MODE_INFO[mode] || FORCING_MODE_INFO.api;
    if (UI.modePillBadge) {
      UI.modePillBadge.textContent = info.name;
      UI.modePillBadge.className = `mode-pill ${info.badgeClass}`;
    }
    if (UI.modeContextDesc) {
      UI.modeContextDesc.textContent = info.desc;
    }
  }

  // Interactive Geographic Map Picker Instance
  let geoPicker = null;

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

  // -------------------------------------------------------------
  // Offline IndexedDB Weather Cache
  // -------------------------------------------------------------
  const WeatherCache = {
    dbPromise: null,

    getDB() {
      if (!this.dbPromise) {
        this.dbPromise = new Promise((resolve) => {
          if (typeof indexedDB === 'undefined') {
            resolve(null);
            return;
          }
          try {
            const req = indexedDB.open('FLakeWeatherCache', 1);
            req.onupgradeneeded = (e) => {
              const db = e.target.result;
              if (!db.objectStoreNames.contains('datasets')) {
                db.createObjectStore('datasets', { keyPath: 'id' });
              }
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = () => resolve(null);
          } catch (_) {
            resolve(null);
          }
        });
      }
      return this.dbPromise;
    },

    async get(id) {
      try {
        const db = await this.getDB();
        if (!db) return null;
        return new Promise((resolve) => {
          const tx = db.transaction('datasets', 'readonly');
          const store = tx.objectStore('datasets');
          const req = store.get(id);
          req.onsuccess = () => resolve(req.result ? req.result : null);
          req.onerror = () => resolve(null);
        });
      } catch (_) {
        return null;
      }
    },

    async set(id, steps, meta = {}) {
      try {
        const db = await this.getDB();
        if (!db) return false;
        return new Promise((resolve) => {
          const tx = db.transaction('datasets', 'readwrite');
          const store = tx.objectStore('datasets');
          store.put({
            id,
            steps,
            meta,
            savedAt: new Date().toISOString()
          });
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        });
      } catch (_) {
        return false;
      }
    }
  };

  async function fetchCuratedLake(lakeKey) {
    const info = CURATED_BENCHMARKS[lakeKey];
    if (!info) throw new Error("Unknown curated lake: " + lakeKey);
    const cacheId = `curated:${lakeKey}`;

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
          if (data && data.steps) {
            WeatherCache.set(cacheId, data.steps, { name: info.name, timeStepSec: data.timeStepSec });
          }
          break;
        }
      } catch (e) {
        lastErr = e;
      }
    }
    if (!data) {
      // Fallback to offline cache
      const cached = await WeatherCache.get(cacheId);
      if (cached && cached.steps && cached.steps.length > 0) {
        return { steps: cached.steps, timeStepSec: (cached.meta && cached.meta.timeStepSec) || 86400, fromCache: true };
      }
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
      if (UI.apiSourcePill) {
        UI.apiSourcePill.style.display = 'inline-block';
        if (dataset.fromCache) {
          UI.apiSourcePill.textContent = 'Offline Cache';
          UI.apiSourcePill.style.color = '#86efac';
          UI.apiSourcePill.style.background = 'rgba(34, 197, 94, 0.15)';
          UI.apiSourcePill.style.borderColor = 'rgba(34, 197, 94, 0.35)';
        } else {
          UI.apiSourcePill.textContent = 'Curated Benchmark';
          UI.apiSourcePill.style.color = '#7dd3fc';
          UI.apiSourcePill.style.background = 'rgba(14, 165, 233, 0.15)';
          UI.apiSourcePill.style.borderColor = 'rgba(14, 165, 233, 0.35)';
        }
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

  function showPerpetualStatus(msg, type = '') {
    if (!UI.perpetualStatusBox || !UI.perpetualStatusText) return;
    if (!msg) {
      UI.perpetualStatusBox.style.display = 'none';
      return;
    }
    UI.perpetualStatusBox.style.display = 'flex';
    UI.perpetualStatusBox.className = 'api-status-box' + (type ? ' ' + type : '');
    UI.perpetualStatusText.textContent = msg;
  }

  function updatePerpetualLakeCard(lakeKey) {
    const info = PERPETUAL_BENCHMARKS[lakeKey];
    if (!info) return;
    if (UI.perpetualName) UI.perpetualName.textContent = info.name;
    if (UI.perpetualRegimePill) {
      UI.perpetualRegimePill.textContent = info.regime;
    }
    if (UI.perpetualDepth) UI.perpetualDepth.textContent = `${info.depth.toFixed(1)} m`;
    if (UI.perpetualFetch) UI.perpetualFetch.textContent = `${Math.round(info.fetch)} m`;
    if (UI.perpetualClarity) UI.perpetualClarity.textContent = `${info.clarity.toFixed(1)} m⁻¹`;
    if (UI.perpetualLat) UI.perpetualLat.textContent = `${info.lat.toFixed(1)}°N`;
    if (UI.perpetualDesc) UI.perpetualDesc.textContent = info.description;
    if (UI.perpetualTairMean) UI.perpetualTairMean.textContent = `T_air: ${info.meanTair.toFixed(1)} °C`;
  }

  async function fetchPerpetualLake(lakeKey) {
    const info = PERPETUAL_BENCHMARKS[lakeKey];
    if (!info) throw new Error("Unknown perpetual lake: " + lakeKey);

    const candidatePaths = [
      `data/perpetual/${info.file}`,
      `assets/data/perpetual/${info.file}`,
      `model/data/perpetual/${info.file}`
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
      throw new Error(lastErr ? lastErr.message : `Failed to load perpetual dataset for ${info.name}`);
    }
    return data;
  }

  async function handleRunPerpetual() {
    const lakeKey = UI.perpetualLakeSelect ? UI.perpetualLakeSelect.value : 'mueggelsee';
    const lake = PERPETUAL_BENCHMARKS[lakeKey];
    if (!lake) return;

    if (UI.btnRunPerpetual) UI.btnRunPerpetual.disabled = true;
    showPerpetualStatus(`Loading perpetual climatology and computing thermal equilibrium for ${lake.name}...`, "");

    try {
      const dataset = await fetchPerpetualLake(lakeKey);
      if (!dataset.steps || dataset.steps.length === 0) {
        throw new Error("Perpetual dataset contains no meteorological records.");
      }

      // Normalize compact step arrays [solar, Tair, ea, wind, cl] into uniform objects
      const dtSec = dataset.timeStepSec || 10800.0;
      const normalizedSteps = dataset.steps.map((s, idx) => {
        const totalHours = Math.round((idx * dtSec) / 3600.0);
        const dayOfYear = Math.floor(totalHours / 24.0) + 1;
        const hourOfDay = totalHours % 24;
        const timeStr = `Day ${dayOfYear} ${hourOfDay.toString().padStart(2, '0')}:00`;

        if (Array.isArray(s)) {
          return {
            index: idx,
            solar: s[0],
            T_air: s[1],
            ea: s[2],
            wind: s[3],
            cl: s[4],
            del_time: dtSec,
            dayOfYear,
            hourOfDay,
            timeStr
          };
        } else {
          return {
            ...s,
            index: idx,
            solar: s.solar != null ? s.solar : 0,
            T_air: s.T_air != null ? s.T_air : (s.Tair != null ? s.Tair : 0),
            ea: s.ea != null ? s.ea : 0,
            wind: s.wind != null ? s.wind : 0,
            cl: s.cl != null ? s.cl : 0,
            del_time: s.del_time || dtSec,
            dayOfYear: s.dayOfYear != null ? s.dayOfYear : dayOfYear,
            hourOfDay: s.hourOfDay != null ? s.hourOfDay : hourOfDay,
            timeStr: s.timeStr || timeStr
          };
        }
      });

      // Sync lake parameters
      state.waterClarity = lake.clarity;
      updateLakeDepth(lake.depth);
      if (UI.selectClarity && lake.clarity != null) {
        UI.selectClarity.value = lake.clarity.toString();
      }

      const maxCycles = UI.perpetualMaxCycles ? parseInt(UI.perpetualMaxCycles.value, 10) || 5 : 5;
      const tol = UI.perpetualTol ? parseFloat(UI.perpetualTol.value) || 0.05 : 0.05;

      const lakeMorph = {
        depth: lake.depth,
        fetch: lake.fetch,
        extinWater: lake.clarity,
        lat: lake.lat
      };

      const res = engine.runPerpetualYear(normalizedSteps, lakeMorph, {
        maxIterations: maxCycles,
        tol: tol,
        del_time: dtSec
      });

      // Update convergence UI box
      if (UI.perpetualConvergenceBox) {
        UI.perpetualConvergenceBox.style.display = 'block';
        if (UI.perpetualCyclesBadge) {
          UI.perpetualCyclesBadge.textContent = `${res.cycles} ${res.cycles === 1 ? 'Cycle' : 'Cycles'}`;
        }
        if (UI.perpetualConvergenceText) {
          const lastLog = res.iterationLog[res.iterationLog.length - 1];
          const deltaStr = lastLog ? lastLog.deltaMax.toFixed(4) : tol.toFixed(4);
          UI.perpetualConvergenceText.textContent = res.converged
            ? `Cyclic equilibrium reached in ${res.cycles} cycles (final ΔT = ${deltaStr} °C ≤ tol ${tol} °C) in ${res.elapsedMs.toFixed(1)} ms.`
            : `Completed ${res.cycles} annual cycles (final ΔT = ${deltaStr} °C).`;
        }
        if (UI.perpetualDiagRegime) UI.perpetualDiagRegime.textContent = res.regime.type;
        if (UI.perpetualDiagIce) UI.perpetualDiagIce.textContent = `${res.diagnostics.iceDays} d`;
        if (UI.perpetualDiagHice) UI.perpetualDiagHice.textContent = `${(res.diagnostics.maxHiceM * 100).toFixed(1)} cm`;
        if (UI.perpetualDiagStrat) UI.perpetualDiagStrat.textContent = `${res.diagnostics.stratDays} d`;
        if (UI.perpetualDiagTbot) UI.perpetualDiagTbot.textContent = `${res.diagnostics.meanTbot.toFixed(1)} °C`;
      }

      // Convert history to match dataset results format for timeline scrubber
      state.isDatasetMode = true;
      state.datasetSeries = normalizedSteps;
      state.datasetResults = res.history;
      state.datasetIndex = 0;
      state.history = res.history;

      if (UI.statTsfcMin) UI.statTsfcMin.textContent = `${res.diagnostics.minTsfc.toFixed(1)} °C`;
      if (UI.statTsfcMax) UI.statTsfcMax.textContent = `${res.diagnostics.maxTsfc.toFixed(1)} °C`;
      if (UI.statIceDays) UI.statIceDays.textContent = `${res.diagnostics.iceDays} d`;
      if (UI.statSimTime) UI.statSimTime.textContent = `${res.elapsedMs.toFixed(1)} ms`;

      if (UI.apiScrubber) {
        UI.apiScrubber.max = res.history.length - 1;
        UI.apiScrubber.value = 0;
      }
      if (UI.apiPlaybackBox) {
        UI.apiPlaybackBox.style.display = 'flex';
      }
      if (UI.apiSourcePill) {
        UI.apiSourcePill.style.display = 'inline-block';
        UI.apiSourcePill.textContent = `Perpetual Equilibrium (${res.regime.type})`;
        UI.apiSourcePill.style.color = '#10b981';
        UI.apiSourcePill.style.background = 'rgba(16, 185, 129, 0.15)';
        UI.apiSourcePill.style.borderColor = 'rgba(16, 185, 129, 0.35)';
      }

      showPerpetualStatus(`Equilibrium converged in ${res.cycles} cycles (${res.elapsedMs.toFixed(1)} ms, ${res.regime.type})`, "success");

      // Pause continuous generator loop and show initial step
      state.isRunning = false;
      if (UI.btnPlay) UI.btnPlay.textContent = 'Run';
      if (UI.clockDot) UI.clockDot.className = 'clock-dot paused';

      applyDatasetStep(0);
    } catch (err) {
      console.error("Failed to run perpetual lake equilibrium:", err);
      showPerpetualStatus(`Error: ${err.message}`, "error");
    } finally {
      if (UI.btnRunPerpetual) UI.btnRunPerpetual.disabled = false;
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
      if (UI.apiSourcePill) {
        UI.apiSourcePill.style.display = 'inline-block';
        UI.apiSourcePill.textContent = 'Custom File';
        UI.apiSourcePill.style.color = '#c084fc';
        UI.apiSourcePill.style.background = 'rgba(192, 132, 252, 0.15)';
        UI.apiSourcePill.style.borderColor = 'rgba(192, 132, 252, 0.35)';
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
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (period === 'pastYear' || period === 'latestYear') {
      const { startD, endD } = getHydrologicalYearDates(now);
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

    return { steps, data, provider: 'Open-Meteo ERA5' };
  }

  async function fetchNasaPowerSeries(lat, lon, period) {
    const now = new Date();
    const fmt = d => {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}${m}${day}`;
    };

    let startStr = '', endStr = '';
    if (period === 'pastYear' || period === 'latestYear') {
      const { startD, endD } = getHydrologicalYearDates(now);
      startStr = fmt(startD);
      endStr = fmt(endD);
    } else if (period === '2024') {
      startStr = '20240101';
      endStr = '20241231';
    } else if (period === '2023') {
      startStr = '20230101';
      endStr = '20231231';
    } else if (period === 'recent30') {
      const endD = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3);
      const startD = new Date(endD.getFullYear(), endD.getMonth(), endD.getDate() - 30);
      startStr = fmt(startD);
      endStr = fmt(endD);
    } else {
      const endD = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3);
      const startD = new Date(endD.getFullYear(), endD.getMonth(), endD.getDate() - 7);
      startStr = fmt(startD);
      endStr = fmt(endD);
    }

    const params = 'T2M,RH2M,PS,WS10M,ALLSKY_SFC_SW_DWN,ALLSKY_SFC_LW_DWN,PRECTOTCORR,CLOUD_AMT';
    const url = `https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=${params}&community=RE&longitude=${lon.toFixed(2)}&latitude=${lat.toFixed(2)}&start=${startStr}&end=${endStr}&format=JSON`;

    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`NASA POWER HTTP ${resp.status}`);
    }
    const data = await resp.json();
    if (!data.properties || !data.properties.parameter || !data.properties.parameter.T2M) {
      throw new Error("No data returned by NASA POWER API for these coordinates.");
    }

    const p = data.properties.parameter;
    const timestamps = Object.keys(p.T2M).sort();
    if (timestamps.length === 0) {
      throw new Error("Empty hourly series from NASA POWER API.");
    }

    const steps = [];
    const K = 273.15;
    const sigma = 5.670374e-8;

    for (const ts of timestamps) {
      const year = parseInt(ts.slice(0, 4), 10);
      const month = parseInt(ts.slice(4, 6), 10) - 1;
      const day = parseInt(ts.slice(6, 8), 10);
      const hour = parseInt(ts.slice(8, 10), 10);

      const dUtc = Date.UTC(year, month, day);
      const startOfYearUtc = Date.UTC(year, 0, 1);
      const dayOfYear = Math.floor((dUtc - startOfYearUtc) / (24 * 3600 * 1000)) + 1;

      const T_air = (p.T2M[ts] != null && p.T2M[ts] !== -999) ? p.T2M[ts] : 10.0;
      const solar = Math.max(0, (p.ALLSKY_SFC_SW_DWN && p.ALLSKY_SFC_SW_DWN[ts] !== -999) ? p.ALLSKY_SFC_SW_DWN[ts] : 0.0);
      const wind = Math.max(0.2, (p.WS10M && p.WS10M[ts] !== -999) ? p.WS10M[ts] : 2.0);
      const rh = Math.max(0.05, Math.min(1.0, ((p.RH2M && p.RH2M[ts] !== -999 ? p.RH2M[ts] : 70) / 100.0)));
      const p_pa = ((p.PS && p.PS[ts] !== -999 ? p.PS[ts] : 101.325) * 1000.0);

      const e_sat = 611.2 * Math.exp((17.67 * T_air) / (T_air + 243.5));
      const e_a = rh * e_sat;
      const q_air = (0.622 * e_a) / (p_pa - 0.378 * e_a);

      let Q_lw = (p.ALLSKY_SFC_LW_DWN && p.ALLSKY_SFC_LW_DWN[ts] !== -999) ? p.ALLSKY_SFC_LW_DWN[ts] : null;
      if (Q_lw == null || Q_lw <= 0) {
        const cloud_pct = (p.CLOUD_AMT && p.CLOUD_AMT[ts] !== -999 ? p.CLOUD_AMT[ts] : 50);
        const cl_tot = Math.max(0, Math.min(1.0, cloud_pct / 100.0));
        const T_k = T_air + K;
        const eps_clear = Math.min(0.85, 0.61 + 0.005 * Math.sqrt(Math.min(e_a, 2000)));
        const f_cloud = 1.0 + 0.22 * (cl_tot * cl_tot);
        Q_lw = eps_clear * f_cloud * sigma * Math.pow(T_k, 4);
      }

      const precipMmH = (p.PRECTOTCORR && p.PRECTOTCORR[ts] !== -999) ? p.PRECTOTCORR[ts] : 0.0;
      const snowRate = (T_air <= 0.5 && precipMmH > 0) ? (precipMmH / 3600.0) : 0.0;

      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const timeStr = `${dateStr} ${String(hour).padStart(2, '0')}:00`;

      steps.push({
        timeStr,
        dateStr,
        dayOfYear,
        hourOfDay: hour,
        T_air,
        solar,
        wind,
        Q_lw,
        q_air,
        snowRate,
        del_time: 3600.0
      });
    }

    return { steps, data, provider: 'NASA POWER' };
  }

  /**
   * Self-contained Physical-Stochastic Earth Climatology & Synoptic Weather Generator
   * Generates continuous hourly astronomical solar radiation and synoptic weather variations
   * for any latitude and longitude on Earth without requiring external network connectivity.
   */
  function generateSynopticClimateSeries(lat, lon, period = 'climatology') {
    const phi = (lat * Math.PI) / 180.0;
    const isNorth = lat >= 0;
    const phaseShift = isNorth ? 0 : Math.PI;

    // Calibrated zonal temperature profile
    const absLat = Math.abs(lat);
    const tMean = 27.0 - 0.15 * absLat - 0.0035 * (absLat * absLat);
    const tAmp = Math.max(1.5, 1.5 + 0.16 * absLat + 0.0006 * (absLat * absLat));

    // Number of days to simulate
    let totalDays = 365;
    const now = new Date();
    let startDate;

    if (period === 'pastYear' || period === 'latestYear') {
      const { startD, endD } = getHydrologicalYearDates(now);
      startDate = startD;
      totalDays = Math.round((endD.getTime() - startD.getTime()) / (86400 * 1000)) + 1;
    } else if (period === 'climatology') {
      const { startD, endD } = getHydrologicalYearDates(now);
      startDate = startD;
      totalDays = Math.round((endD.getTime() - startD.getTime()) / (86400 * 1000)) + 1;
    } else if (period === 'recent30') {
      totalDays = 30;
      startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 30));
    } else if (period === 'forecast') {
      totalDays = 14;
      startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 7));
    } else if (period === '2024') {
      startDate = new Date(Date.UTC(2024, 0, 1));
    } else if (period === '2023') {
      startDate = new Date(Date.UTC(2023, 0, 1));
    } else {
      startDate = new Date(Date.UTC(2024, 0, 1));
    }

    const steps = [];
    const K = 273.15;
    const sigma = 5.670374e-8;

    for (let dIdx = 0; dIdx < totalDays; dIdx++) {
      const dateObj = new Date(startDate.getTime() + dIdx * 86400 * 1000);
      const yearStart = new Date(Date.UTC(dateObj.getUTCFullYear(), 0, 1));
      const dayNum = Math.floor((dateObj - yearStart) / (86400 * 1000)) + 1;
      const dateStr = dateObj.toISOString().split('T')[0];

      const annualAngle = ((2.0 * Math.PI * (dayNum - 105)) / 365.0) + phaseShift;
      const tSeason = tMean + tAmp * Math.cos(annualAngle);

      // Multi-scale synoptic perturbations (Rossby waves with 5.5-day and 11-day cycles)
      const synopticWave = Math.sin((dIdx * 2.0 * Math.PI) / 5.5) * 3.2 + Math.sin((dIdx * 2.0 * Math.PI) / 11.0) * 1.8;
      const isCyclone = synopticWave < -0.8;

      const cloudCover = isCyclone ? 0.85 : Math.max(0.1, 0.35 + 0.25 * Math.sin(dIdx * 0.45));
      const baseWind = isCyclone ? 6.2 : Math.max(0.8, 2.6 + 1.1 * Math.sin(dIdx * 0.65));

      // Solar declination for this day of year
      const decl = (23.45 * Math.PI / 180.0) * Math.sin(((2.0 * Math.PI * (dayNum - 81)) / 365.0));

      for (let h = 0; h < 24; h++) {
        const hourAngle = ((h - 12) * 15.0 * Math.PI) / 180.0;
        const sinElev = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(hourAngle);

        // Top-of-atmosphere and surface solar radiation
        let solar = 0.0;
        if (sinElev > 0) {
          const toa = 1361.0 * sinElev;
          const transmittance = 0.72 * (1.0 - 0.75 * (cloudCover * cloudCover));
          solar = Math.max(0.0, toa * transmittance);
        }

        // Diurnal thermal wave peaking at 15:00
        const diurnal = 3.2 * Math.sin(((h - 9) * 15.0 * Math.PI) / 180.0) * (1.0 - 0.45 * cloudCover);
        const tAir = Math.round((tSeason + synopticWave + diurnal) * 10) / 10;
        const wind = Math.max(0.5, Math.round((baseWind + 0.8 * Math.sin((h * Math.PI) / 12)) * 10) / 10);

        // Relative humidity (higher during storm or at night, lower at noon)
        const rh = Math.max(0.2, Math.min(0.95, (isCyclone ? 0.85 : 0.65 - 0.15 * Math.sin(((h - 9) * 15.0 * Math.PI) / 180.0))));
        const pPa = 101325.0 - (isCyclone ? 1500.0 : -1000.0);

        const eSat = 611.2 * Math.exp((17.67 * tAir) / (tAir + 243.5));
        const eA = rh * eSat;
        const qAir = (0.622 * eA) / (pPa - 0.378 * eA);

        const tK = tAir + K;
        const epsClear = Math.min(0.85, 0.61 + 0.005 * Math.sqrt(Math.min(eA, 2000)));
        const fCloud = 1.0 + 0.22 * (cloudCover * cloudCover);
        const qLw = epsClear * fCloud * sigma * Math.pow(tK, 4);

        const isPrecip = isCyclone && Math.sin(h * 0.8) > 0.2;
        const precipMmH = isPrecip ? (1.5 + Math.sin(h) * 1.0) : 0.0;
        const snowRate = (tAir <= 0.5 && precipMmH > 0) ? (precipMmH / 3600.0) : 0.0;

        // Formatted date and time strings
        const timeStr = `${dateStr} ${String(h).padStart(2, '0')}:00`;

        steps.push({
          timeStr,
          dateStr,
          dayOfYear: dayNum,
          hourOfDay: h,
          T_air: tAir,
          solar: Math.round(solar),
          wind,
          Q_lw: Math.round(qLw),
          q_air: Math.round(qAir * 100000) / 100000,
          snowRate: Math.round(snowRate * 1000000) / 1000000,
          del_time: 3600.0
        });
      }
    }

    return { steps, provider: 'Offline Climatology' };
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

    const hydroRange = getHydrologicalYearDates();
    const cacheId = (period === 'pastYear' || period === 'latestYear')
      ? `api:${lat.toFixed(2)}:${lon.toFixed(2)}:${period}:${hydroRange.startYear}-${hydroRange.endYear}`
      : `api:${lat.toFixed(2)}:${lon.toFixed(2)}:${period}`;
    UI.btnFetchApi.disabled = true;

    try {
      let steps;
      let fromLocalCache = false;
      let providerName = 'Open-Meteo ERA5';

      if (period === 'climatology') {
        showApiStatus(`Synthesizing annual meteorological series from offline Earth climatology for (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)...`, "offline");
        const climResult = generateSynopticClimateSeries(lat, lon, 'climatology');
        steps = climResult.steps;
        providerName = 'Offline Climatology';
        await WeatherCache.set(cacheId, steps, { lat, lon, period, source: providerName });
      } else {
        showApiStatus(`Requesting weather data for (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)...`, "");
        try {
          const netResult = await fetchOpenMeteoSeries(lat, lon, period);
          steps = netResult.steps;
          providerName = 'Open-Meteo ERA5';
          await WeatherCache.set(cacheId, steps, { lat, lon, period, source: providerName });
        } catch (openMeteoErr) {
          console.warn("Open-Meteo failed, attempting fallback to NASA POWER:", openMeteoErr);
          try {
            showApiStatus(`Open-Meteo unavailable (${openMeteoErr.message}). Querying NASA POWER global reanalysis...`, "info");
            const nasaResult = await fetchNasaPowerSeries(lat, lon, period);
            steps = nasaResult.steps;
            providerName = 'NASA POWER';
            await WeatherCache.set(cacheId, steps, { lat, lon, period, source: providerName });
          } catch (nasaErr) {
            console.warn("NASA POWER failed, attempting offline cache fallback:", nasaErr);
            const cached = await WeatherCache.get(cacheId);
            if (cached && cached.steps && cached.steps.length > 0) {
              steps = cached.steps;
              fromLocalCache = true;
              providerName = 'Offline Cache';
              showApiStatus(`Weather APIs unavailable. Restored ${steps.length} hours from local offline cache.`, "offline");
            } else {
              // Self-contained Earth climatology generator fallback
              showApiStatus(`APIs unreachable and no cache found. Synthesizing series using offline Earth climatology for (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)...`, "offline");
              const climResult = generateSynopticClimateSeries(lat, lon, period);
              steps = climResult.steps;
              providerName = 'Offline Climatology';
              await WeatherCache.set(cacheId, steps, { lat, lon, period, source: providerName });
            }
          }
        }
      }

      if (!fromLocalCache && period !== 'climatology') {
        showApiStatus(`Received ${steps.length} hours of weather data (${providerName}). Running FLake WebAssembly simulation...`, "");
      }

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

      if (UI.apiSourcePill) {
        UI.apiSourcePill.style.display = 'inline-block';
        if (fromLocalCache) {
          UI.apiSourcePill.textContent = 'Offline Cache';
          UI.apiSourcePill.style.color = '#fde68a';
          UI.apiSourcePill.style.background = 'rgba(245, 158, 11, 0.15)';
          UI.apiSourcePill.style.borderColor = 'rgba(245, 158, 11, 0.35)';
        } else if (providerName === 'NASA POWER') {
          UI.apiSourcePill.textContent = 'NASA POWER';
          UI.apiSourcePill.style.color = '#38bdf8';
          UI.apiSourcePill.style.background = 'rgba(56, 189, 248, 0.15)';
          UI.apiSourcePill.style.borderColor = 'rgba(56, 189, 248, 0.35)';
        } else if (providerName === 'Offline Climatology') {
          UI.apiSourcePill.textContent = 'Offline Climatology';
          UI.apiSourcePill.style.color = '#c084fc';
          UI.apiSourcePill.style.background = 'rgba(192, 132, 252, 0.15)';
          UI.apiSourcePill.style.borderColor = 'rgba(192, 132, 252, 0.35)';
        } else {
          UI.apiSourcePill.textContent = 'Open-Meteo ERA5';
          UI.apiSourcePill.style.color = '#86efac';
          UI.apiSourcePill.style.background = 'rgba(34, 197, 94, 0.15)';
          UI.apiSourcePill.style.borderColor = 'rgba(34, 197, 94, 0.35)';
        }
      }

      if (fromLocalCache) {
        showApiStatus(`Simulation complete! Processed ${steps.length} hours from offline cache in ${res.elapsedMs.toFixed(1)} ms.`, "success");
      } else {
        showApiStatus(`Simulation complete! ${steps.length} hours processed via ${providerName} in ${res.elapsedMs.toFixed(1)} ms (cached locally).`, "success");
      }

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
    engine.setState(res);
    engine.simulatedHours = idx;
    engine.dayOfYear = res.dayOfYear != null ? res.dayOfYear : 1;
    engine.hourOfDay = res.hourOfDay != null ? res.hourOfDay : 0;
    UI.apiTimePill.textContent = res.timeStr || getSimulatedDateString(engine.dayOfYear, engine.hourOfDay);

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

    const tAir = (forcing && forcing.T_air != null) ? forcing.T_air : (forcing && forcing.Tair != null ? forcing.Tair : state.baseAirTemp);
    const sol = (forcing && forcing.solar != null) ? forcing.solar : state.baseSolar;
    if (UI.valAirTemp) UI.valAirTemp.textContent = `${tAir.toFixed(1)} °C`;
    if (UI.valSolar) UI.valSolar.textContent = `${Math.round(sol)} W/m²`;
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
      ctxHistory.fillStyle = '#64748b';
      ctxHistory.font = '12px sans-serif';
      ctxHistory.textAlign = 'center';
      ctxHistory.fillText('Ready. Click "Fetch & Simulate Real Weather" or "Run" to start simulation.', width / 2, height / 2);
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

    // Time axis ticks and labels dynamically generated from dataset chronology
    ctxHistory.textAlign = 'center';
    ctxHistory.font = '10px ' + getComputedStyle(document.body).getPropertyValue('--font-mono');

    // Parse dates/times for history data points
    let virtualYear = 2024;
    let prevDoy = -1;
    let hasAnyRealDate = false;
    const parsedDates = new Array(history.length);

    for (let i = 0; i < history.length; i++) {
      const h = history[i];
      let p = null;

      if (h.dateStr && typeof h.dateStr === 'string') {
        const mIso = h.dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (mIso) {
          const y = parseInt(mIso[1], 10);
          const m = parseInt(mIso[2], 10) - 1;
          const d = parseInt(mIso[3], 10);
          const hr = h.hourOfDay != null ? h.hourOfDay : 0;
          p = { date: new Date(Date.UTC(y, m, d, hr)), hasRealDate: true, hasYear: true };
        } else {
          const mDoy = h.dateStr.match(/^(\d{4})-(\d{3})$/);
          if (mDoy) {
            const y = parseInt(mDoy[1], 10);
            const doy = parseInt(mDoy[2], 10);
            const hr = h.hourOfDay != null ? h.hourOfDay : 12;
            p = { date: new Date(Date.UTC(y, 0, doy, hr)), hasRealDate: true, hasYear: true };
          }
        }
      }

      if (!p && h.timeStr && typeof h.timeStr === 'string') {
        const mIso = h.timeStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}))?/);
        if (mIso) {
          const y = parseInt(mIso[1], 10);
          const m = parseInt(mIso[2], 10) - 1;
          const d = parseInt(mIso[3], 10);
          const hr = mIso[4] != null ? parseInt(mIso[4], 10) : (h.hourOfDay != null ? h.hourOfDay : 0);
          p = { date: new Date(Date.UTC(y, m, d, hr)), hasRealDate: true, hasYear: true };
        }
      }

      if (!p && h.dayOfYear != null && !isNaN(h.dayOfYear)) {
        const doy = Math.floor(h.dayOfYear);
        const hr = h.hourOfDay != null ? Math.floor(h.hourOfDay) : 0;
        if (prevDoy !== -1 && doy < prevDoy) {
          virtualYear++;
        }
        prevDoy = doy;
        p = { date: new Date(Date.UTC(virtualYear, 0, doy, hr)), hasRealDate: false, hasYear: false };
      }

      if (p && p.hasRealDate) {
        hasAnyRealDate = true;
      }
      parsedDates[i] = p;
    }

    const firstP = parsedDates[0];
    const lastP = parsedDates[parsedDates.length - 1];
    let totalDays = 0;
    if (firstP && lastP) {
      totalDays = (lastP.date.getTime() - firstP.date.getTime()) / (86400 * 1000);
      if (totalDays <= 0 && firstP.date > lastP.date) {
        totalDays = 365;
      }
    }

    const timeTicks = [];

    if (firstP && lastP && totalDays >= 60 && totalDays <= 500) {
      // Month-based grouping (e.g. 1-year rolling, full calendar year, 365-day benchmarks)
      const segments = [];
      let curKey = null;
      let curIdxs = [];
      let curYr = 2024;
      let curMo = 0;

      for (let i = 0; i < parsedDates.length; i++) {
        const p = parsedDates[i];
        if (!p) continue;
        const yr = p.date.getUTCFullYear();
        const mo = p.date.getUTCMonth();
        const key = `${yr}-${mo}`;
        if (key !== curKey) {
          if (curIdxs.length > 0) {
            segments.push({ year: curYr, month: curMo, idxs: curIdxs });
          }
          curKey = key;
          curYr = yr;
          curMo = mo;
          curIdxs = [i];
        } else {
          curIdxs.push(i);
        }
      }
      if (curIdxs.length > 0) {
        segments.push({ year: curYr, month: curMo, idxs: curIdxs });
      }

      const yearsPresent = new Set(segments.map(s => s.year));
      const hasMultiYear = yearsPresent.size > 1;
      const step = (chartW < 520 && segments.length > 8) ? 2 : 1;
      let lastX = -999;
      const minSpacing = 34;

      for (let segIdx = 0; segIdx < segments.length; segIdx += step) {
        const seg = segments[segIdx];
        const midIdx = (seg.idxs[0] + seg.idxs[seg.idxs.length - 1]) / 2;
        const x = xPos(midIdx);
        const moName = MONTHS[seg.month];
        let label = moName;

        if (hasAnyRealDate && hasMultiYear) {
          if (segIdx === 0) {
            label = `${moName} '${String(seg.year).slice(-2)}`;
          } else if (seg.month === 0) {
            label = `${moName} '${String(seg.year).slice(-2)}`;
          } else if (segIdx === segments.length - 1 && seg.year !== segments[0].year && seg.month !== 0) {
            label = `${moName} '${String(seg.year).slice(-2)}`;
          }
        }

        if (x - lastX >= minSpacing) {
          timeTicks.push({ x, label });
          lastX = x;
        }
      }
    } else if (firstP && lastP && totalDays > 500) {
      // Multi-year spans (> 500 days)
      const years = {};
      for (let i = 0; i < parsedDates.length; i++) {
        const p = parsedDates[i];
        if (!p) continue;
        const yr = p.date.getUTCFullYear();
        if (!years[yr]) years[yr] = [];
        years[yr].push(i);
      }
      let lastX = -999;
      for (const yr of Object.keys(years)) {
        const idxs = years[yr];
        const midIdx = (idxs[0] + idxs[idxs.length - 1]) / 2;
        const x = xPos(midIdx);
        if (x - lastX >= 40) {
          timeTicks.push({ x, label: String(yr) });
          lastX = x;
        }
      }
    } else if (firstP && lastP && totalDays >= 10 && totalDays < 60) {
      // Days (e.g. 30 days)
      const stepDays = totalDays >= 25 ? 5 : 2;
      let lastDay = -1;
      let lastX = -999;
      for (let i = 0; i < parsedDates.length; i++) {
        const p = parsedDates[i];
        if (!p) continue;
        const d = p.date.getUTCDate();
        if (d !== lastDay && (d % stepDays === 0 || d === 1)) {
          lastDay = d;
          const x = xPos(i);
          if (x - lastX >= 38) {
            timeTicks.push({ x, label: `${MONTHS[p.date.getUTCMonth()]} ${d}` });
            lastX = x;
          }
        }
      }
    } else if (firstP && lastP && totalDays >= 2 && totalDays < 10) {
      // Daily ticks (e.g. 7-10 days)
      let lastDay = -1;
      let lastX = -999;
      for (let i = 0; i < parsedDates.length; i++) {
        const p = parsedDates[i];
        if (!p) continue;
        const d = p.date.getUTCDate();
        if (d !== lastDay) {
          lastDay = d;
          const x = xPos(i);
          if (x - lastX >= 35) {
            timeTicks.push({ x, label: `${MONTHS[p.date.getUTCMonth()]} ${d}` });
            lastX = x;
          }
        }
      }
    } else {
      // Intraday, synthetic short runs, or unparsed fallback
      const timeTickInterval = Math.max(1, Math.floor(history.length / 6));
      for (let i = 0; i < history.length; i += timeTickInterval) {
        const h = history[i];
        const x = xPos(i);
        const p = parsedDates[i];
        let label;
        if (p && p.hasRealDate) {
          label = `${MONTHS[p.date.getUTCMonth()]} ${p.date.getUTCDate()} ${String(p.date.getUTCHours()).padStart(2, '0')}h`;
        } else {
          label = `D${h.dayOfYear} ${h.hourOfDay}h`;
        }
        timeTicks.push({ x, label });
      }
    }

    // Draw vertical background gridlines, axis tick marks, and text labels
    for (const t of timeTicks) {
      ctxHistory.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctxHistory.beginPath();
      ctxHistory.moveTo(t.x, padTop);
      ctxHistory.lineTo(t.x, padTop + chartH);
      ctxHistory.stroke();

      ctxHistory.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctxHistory.beginPath();
      ctxHistory.moveTo(t.x, padTop + chartH);
      ctxHistory.lineTo(t.x, padTop + chartH + 4);
      ctxHistory.stroke();

      ctxHistory.fillStyle = '#9ca3af';
      ctxHistory.fillText(t.label, t.x, height - 10);
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

  function applyPreset(presetKey, switchTab = true) {
    state.preset = presetKey;
    state.annualCycle = (presetKey === 'annual');
    state.isDatasetMode = false;
    if (UI.apiPlaybackBox) UI.apiPlaybackBox.style.display = 'none';
    if (UI.apiSourcePill) UI.apiSourcePill.style.display = 'none';

    if (switchTab && UI.tabForcingManual) {
      state.forcingMode = 'manual';
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
      Tair: forcing.T_air
    });
    updateTelemetry(res, forcing);
    renderLakeColumn();
    renderProfilePlot();
    renderHistoryChart();

    // Ensure model stays paused until user triggers run
    state.isRunning = false;
    if (UI.btnPlay) UI.btnPlay.textContent = 'Run';
    if (UI.clockDot) UI.clockDot.className = 'clock-dot paused';
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
      if (state.forcingMode === 'api' && (!state.datasetResults || state.datasetResults.length === 0)) {
        handleFetchApiWeather();
        return;
      }
      if (state.forcingMode === 'curated' && (!state.datasetResults || state.datasetResults.length === 0)) {
        handleLoadCuratedLake();
        return;
      }
      if (state.forcingMode === 'perpetual' && (!state.datasetResults || state.datasetResults.length === 0)) {
        handleRunPerpetual();
        return;
      }
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
        applyPreset(state.preset, false);
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
        if (UI.tabForcingPerpetual) UI.tabForcingPerpetual.classList.remove('active');
        if (UI.tabForcingApi) UI.tabForcingApi.classList.remove('active');
        if (UI.tabForcingCustom) UI.tabForcingCustom.classList.remove('active');
        UI.panelForcingManual.style.display = 'block';
        if (UI.panelForcingCurated) UI.panelForcingCurated.style.display = 'none';
        if (UI.panelForcingPerpetual) UI.panelForcingPerpetual.style.display = 'none';
        if (UI.panelForcingApi) UI.panelForcingApi.style.display = 'none';
        if (UI.panelForcingCustom) UI.panelForcingCustom.style.display = 'none';
        if (UI.apiPlaybackBox) UI.apiPlaybackBox.style.display = 'none';
        if (UI.apiSourcePill) UI.apiSourcePill.style.display = 'none';
        updateForcingModeContext('manual');
        UI.btnPlay.textContent = state.isRunning ? 'Pause' : 'Run';
        UI.clockDot.className = 'clock-dot' + (state.isRunning ? '' : ' paused');
      });
    }

    if (UI.tabForcingCurated) {
      UI.tabForcingCurated.addEventListener('click', () => {
        state.forcingMode = 'curated';
        UI.tabForcingCurated.classList.add('active');
        if (UI.tabForcingManual) UI.tabForcingManual.classList.remove('active');
        if (UI.tabForcingPerpetual) UI.tabForcingPerpetual.classList.remove('active');
        if (UI.tabForcingApi) UI.tabForcingApi.classList.remove('active');
        if (UI.tabForcingCustom) UI.tabForcingCustom.classList.remove('active');
        UI.panelForcingCurated.style.display = 'block';
        if (UI.panelForcingManual) UI.panelForcingManual.style.display = 'none';
        if (UI.panelForcingPerpetual) UI.panelForcingPerpetual.style.display = 'none';
        if (UI.panelForcingApi) UI.panelForcingApi.style.display = 'none';
        if (UI.panelForcingCustom) UI.panelForcingCustom.style.display = 'none';
        updateForcingModeContext('curated');
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

    if (UI.tabForcingPerpetual) {
      UI.tabForcingPerpetual.addEventListener('click', () => {
        state.forcingMode = 'perpetual';
        UI.tabForcingPerpetual.classList.add('active');
        if (UI.tabForcingManual) UI.tabForcingManual.classList.remove('active');
        if (UI.tabForcingCurated) UI.tabForcingCurated.classList.remove('active');
        if (UI.tabForcingApi) UI.tabForcingApi.classList.remove('active');
        if (UI.tabForcingCustom) UI.tabForcingCustom.classList.remove('active');
        if (UI.panelForcingPerpetual) UI.panelForcingPerpetual.style.display = 'block';
        if (UI.panelForcingManual) UI.panelForcingManual.style.display = 'none';
        if (UI.panelForcingCurated) UI.panelForcingCurated.style.display = 'none';
        if (UI.panelForcingApi) UI.panelForcingApi.style.display = 'none';
        if (UI.panelForcingCustom) UI.panelForcingCustom.style.display = 'none';
        updateForcingModeContext('perpetual');
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
        if (UI.tabForcingPerpetual) UI.tabForcingPerpetual.classList.remove('active');
        if (UI.tabForcingCustom) UI.tabForcingCustom.classList.remove('active');
        UI.panelForcingApi.style.display = 'block';
        if (UI.panelForcingManual) UI.panelForcingManual.style.display = 'none';
        if (UI.panelForcingCurated) UI.panelForcingCurated.style.display = 'none';
        if (UI.panelForcingPerpetual) UI.panelForcingPerpetual.style.display = 'none';
        if (UI.panelForcingCustom) UI.panelForcingCustom.style.display = 'none';
        updateForcingModeContext('api');
        if (geoPicker) {
          geoPicker.invalidate();
        }
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
        if (UI.tabForcingPerpetual) UI.tabForcingPerpetual.classList.remove('active');
        if (UI.tabForcingApi) UI.tabForcingApi.classList.remove('active');
        UI.panelForcingCustom.style.display = 'block';
        if (UI.panelForcingManual) UI.panelForcingManual.style.display = 'none';
        if (UI.panelForcingCurated) UI.panelForcingCurated.style.display = 'none';
        if (UI.panelForcingPerpetual) UI.panelForcingPerpetual.style.display = 'none';
        if (UI.panelForcingApi) UI.panelForcingApi.style.display = 'none';
        updateForcingModeContext('custom');
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

    // Modal Guide Events
    if (UI.btnOpenModeModal) {
      UI.btnOpenModeModal.addEventListener('click', () => {
        if (UI.forcingModeModal) UI.forcingModeModal.style.display = 'flex';
      });
    }

    const closeModeModal = () => {
      if (UI.forcingModeModal) UI.forcingModeModal.style.display = 'none';
    };

    if (UI.btnCloseModeModal) UI.btnCloseModeModal.addEventListener('click', closeModeModal);
    if (UI.btnModalDismiss) UI.btnModalDismiss.addEventListener('click', closeModeModal);
    if (UI.forcingModeModal) {
      UI.forcingModeModal.addEventListener('click', (e) => {
        if (e.target === UI.forcingModeModal) closeModeModal();
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && UI.forcingModeModal && UI.forcingModeModal.style.display === 'flex') {
        closeModeModal();
      }
    });

    // Perpetual Lake select change and run button
    if (UI.perpetualLakeSelect) {
      UI.perpetualLakeSelect.addEventListener('change', (e) => {
        updatePerpetualLakeCard(e.target.value);
      });
    }

    if (UI.btnRunPerpetual) {
      UI.btnRunPerpetual.addEventListener('click', handleRunPerpetual);
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
          if (geoPicker) {
            geoPicker.setCoordinates(info.lat, info.lon, true, 8);
          }
        }
      });
    }

    // Manual Coordinates Input Sync with Map
    const handleManualCoordinatesChange = () => {
      const lat = parseFloat(UI.apiLat.value);
      const lon = parseFloat(UI.apiLon.value);
      if (!isNaN(lat) && !isNaN(lon) && geoPicker) {
        geoPicker.setCoordinates(lat, lon, true);
        if (UI.apiLakePreset) UI.apiLakePreset.value = 'custom';
      }
    };
    if (UI.apiLat) UI.apiLat.addEventListener('input', handleManualCoordinatesChange);
    if (UI.apiLon) UI.apiLon.addEventListener('input', handleManualCoordinatesChange);

    // Toggle Map Visibility
    if (UI.btnToggleMap && UI.geoPickerWrapper) {
      UI.btnToggleMap.addEventListener('click', () => {
        const isHidden = UI.geoPickerWrapper.style.display === 'none';
        if (isHidden) {
          UI.geoPickerWrapper.style.display = 'block';
          UI.btnToggleMap.textContent = 'Collapse';
          if (geoPicker) geoPicker.invalidate();
        } else {
          UI.geoPickerWrapper.style.display = 'none';
          UI.btnToggleMap.textContent = 'Expand';
        }
      });
    }

    // Map Zoom & Reset Controls
    if (UI.btnMapZoomIn) {
      UI.btnMapZoomIn.addEventListener('click', () => {
        if (geoPicker) geoPicker.zoomIn();
      });
    }
    if (UI.btnMapZoomOut) {
      UI.btnMapZoomOut.addEventListener('click', () => {
        if (geoPicker) geoPicker.zoomOut();
      });
    }
    if (UI.btnMapReset) {
      UI.btnMapReset.addEventListener('click', () => {
        if (geoPicker) geoPicker.resetView();
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
        let headerTime = h.timeStr || `Day ${h.dayOfYear}, ${h.hourOfDay}:00`;
        if (h.dateStr && /^\d{4}-\d{3}$/.test(h.dateStr)) {
          const parts = h.dateStr.split('-');
          const y = parseInt(parts[0], 10);
          const doy = parseInt(parts[1], 10);
          const dt = new Date(Date.UTC(y, 0, doy));
          const mo = MONTHS[dt.getUTCMonth()];
          headerTime = `${y}-${mo}-${String(dt.getUTCDate()).padStart(2, '0')} (${h.timeStr || `Day ${doy}`})`;
        } else if (!h.timeStr && h.dayOfYear != null) {
          headerTime = getSimulatedDateString(h.dayOfYear, h.hourOfDay != null ? h.hourOfDay : 0);
        }

        UI.historyTooltip.innerHTML = `
          <div style="font-weight:600; color:#38bdf8;">${headerTime}</div>
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
      updateCuratedLakeCard('heiligensee');
      updatePerpetualLakeCard('mueggelsee');
      updateForcingModeContext('api');

      // Hydrological year period label setup
      const hydroRange = getHydrologicalYearDates();
      if (UI.apiPeriod) {
        const hydroOpt = UI.apiPeriod.querySelector('option[value="pastYear"]');
        if (hydroOpt) {
          hydroOpt.textContent = `Latest Hydrological Year (${hydroRange.startYear}-10-01 to ${hydroRange.endYear}-09-30 - 8,760 hrs)`;
        }
      }

      // Initialize default API lake preset (Müggelsee)
      if (LAKE_PRESETS && LAKE_PRESETS['mueggelsee']) {
        const info = LAKE_PRESETS['mueggelsee'];
        state.waterClarity = info.clarity;
        if (UI.selectClarity) UI.selectClarity.value = info.clarity.toString();
        engine.setLakeParameters({ extinWater: info.clarity });
        updateLakeDepth(info.depth);
      } else {
        updateLakeDepth(state.lakeDepth);
      }

      // Sync slider inputs to default state values
      if (UI.sliderAirTemp) UI.sliderAirTemp.value = state.baseAirTemp;
      if (UI.valAirTemp) UI.valAirTemp.textContent = `${state.baseAirTemp.toFixed(1)} °C`;
      if (UI.sliderSolar) UI.sliderSolar.value = state.baseSolar;
      if (UI.valSolar) UI.valSolar.textContent = `${Math.round(state.baseSolar)} W/m²`;
      if (UI.sliderWind) UI.sliderWind.value = state.baseWind;
      if (UI.valWind) UI.valWind.textContent = `${state.baseWind.toFixed(1)} m/s`;
      if (UI.sliderSnow) UI.sliderSnow.value = (state.snowRate * 3600.0).toFixed(1);
      if (UI.valSnow) UI.valSnow.textContent = `${(state.snowRate * 3600.0).toFixed(1)} mm/h`;

      // Set initial lake thermal profile without switching to manual/synthetic tab
      engine.resetState('autumn');
      const initForcing = {
        T_air: 12.0,
        solar: 180.0,
        wind: 3.0,
        snowRate: 0.0,
        Q_lw: null
      };
      updateTelemetry(engine.state, initForcing);
      renderLakeColumn();
      renderProfilePlot();
      renderHistoryChart();

      // Ensure model does NOT run automatically on startup (user triggers it)
      state.isRunning = false;
      if (UI.btnPlay) UI.btnPlay.textContent = 'Run';
      if (UI.clockDot) UI.clockDot.className = 'clock-dot paused';
      if (UI.clockText) UI.clockText.textContent = 'FLake WASM Ready';

      // Initialize offline interactive location map picker
      try {
        geoPicker = new GeoLocationPicker({
          canvas: UI.geoPickerCanvas,
          coordsDisplay: UI.geoMapCursorCoords,
          tooltip: UI.geoMapTooltip,
          initialLat: parseFloat(UI.apiLat?.value) || 52.43,
          initialLon: parseFloat(UI.apiLon?.value) || 13.63,
          onLocationChange: (lat, lon) => {
            if (UI.apiLat) UI.apiLat.value = lat.toFixed(2);
            if (UI.apiLon) UI.apiLon.value = lon.toFixed(2);
            if (UI.apiLakePreset) UI.apiLakePreset.value = 'custom';
          },
          onPresetSelect: (key, lake) => {
            if (UI.apiLakePreset) UI.apiLakePreset.value = key;
            if (UI.apiLat) UI.apiLat.value = lake.lat;
            if (UI.apiLon) UI.apiLon.value = lake.lon;
            state.waterClarity = lake.clarity;
            if (UI.selectClarity) UI.selectClarity.value = lake.clarity.toString();
            engine.setLakeParameters({ extinWater: lake.clarity });
            updateLakeDepth(lake.depth);
          }
        });
        geoPicker.init();
      } catch (mapErr) {
        console.warn('Map picker initialization skipped:', mapErr);
      }

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
