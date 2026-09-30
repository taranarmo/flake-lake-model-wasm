---
title: Verification Test Runs
page_title: Verification Test Runs
page_subtitle: Multi-year validation runs for the Heiligensee, Müggelsee, and Stechlinsee.
active_page: test-runs
breadcrumbs:
  - name: Downloads & Data
  - name: Test Runs
has_sidebar: false
---

## FLake Verification Test Runs

Three long-term FLake simulation runs are presented below, tested against multi-year empirical observation data on vertical temperature structure. Three German lakes with distinct morphometric and mixing regimes are evaluated:

<div class="tab-nav">
  <button class="tab-btn active" data-tab="tab-heiligensee">1. The Heiligensee (Shallow, 4.5m)</button>
  <button class="tab-btn" data-tab="tab-mueggelsee">2. The Müggelsee (Shallow, 4.9m)</button>
  <button class="tab-btn" data-tab="tab-stechlin">3. The Stechlinsee (Deep, 22.8m)</button>
</div>

<div id="tab-heiligensee" class="tab-pane active">
  <h3>The Heiligensee (Berlin)</h3>
  <p>
    The Heiligensee is a small, shallow polymictic lake located within Berlin city limits (mean depth <strong>4.5 m</strong>, surface area <strong>0.32 km²</strong>). Long-term meteorological forcing from 1980–1996 was used to simulate mixed-layer temperature, ice cover, and bottom heat exchange.
  </p>

  <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin: 1.5rem 0;">
    <a href="assets/test_run/heiligensee80-96test.zip" class="btn-download" download>
      Download Heiligensee Test Bundle (.zip, 420 KB)
    </a>
    <a href="assets/test_run/Heiligensee80-96.nml" class="btn-secondary" download>
      Namelist (.nml)
    </a>
    <a href="assets/test_run/Potsdam80-96.dat" class="btn-secondary" download>
      Forcing Data (.dat, 245 KB)
    </a>
  </div>

  <div class="figure-gallery">
    <div class="figure-card">
      <img src="assets/test_run/HeiligenseeMorph.gif" alt="Heiligensee Morphometry">
      <div class="figure-caption"><strong>Bathymetry:</strong> Depth profile and morphometry of the Heiligensee basin.</div>
    </div>
    <div class="figure-card">
      <img src="assets/test_run/FLAKEtestruns_01.png" alt="Heiligensee Temperature Profile">
      <div class="figure-caption"><strong>Fig. 1:</strong> Modeled vs. observed water temperature profiles (1980–1996).</div>
    </div>
    <div class="figure-card">
      <img src="assets/test_run/FLAKEtestruns_02.png" alt="Heiligensee Seasonal Cycle">
      <div class="figure-caption"><strong>Fig. 2:</strong> Mixed-layer depth and thermal stratification dynamics.</div>
    </div>
    <div class="figure-card">
      <img src="assets/test_run/FLAKEtestruns_03.png" alt="Heiligensee Ice Cover">
      <div class="figure-caption"><strong>Fig. 3:</strong> Ice duration, freeze-up, and spring break-up dates.</div>
    </div>
  </div>
</div>

<div id="tab-mueggelsee" class="tab-pane">
  <h3>The Müggelsee (Berlin)</h3>
  <p>
    The Müggelsee is Berlin's largest lake (surface area <strong>7.4 km²</strong>, mean depth <strong>4.9 m</strong>, max depth <strong>8 m</strong>). As a polymictic shallow lake with strong wind fetch, it exhibits frequent summer mixing episodes punctuated by short-lived stratification.
  </p>

  <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin: 1.5rem 0;">
    <a href="assets/test_run/Mueggelsee80-96test.zip" class="btn-download" download>
      Download Müggelsee Test Bundle (.zip, 380 KB)
    </a>
    <a href="assets/test_run/Mueggelsee80-96.nml" class="btn-secondary" download>
      Namelist (.nml)
    </a>
    <a href="assets/test_run/Potsdam80-96.dat" class="btn-secondary" download>
      Forcing Data (.dat, 245 KB)
    </a>
  </div>

  <div class="figure-gallery">
    <div class="figure-card">
      <img src="assets/test_run/FLAKEtestruns_04.png" alt="Müggelsee Temperature Comparison">
      <div class="figure-caption"><strong>Fig. 4:</strong> Simulated mixed-layer temperature compared with IGB station data.</div>
    </div>
    <div class="figure-card">
      <img src="assets/test_run/FLAKEtestruns_05.png" alt="Müggelsee Heat Fluxes">
      <div class="figure-caption"><strong>Fig. 5:</strong> Surface heat budget and bottom sediment energy exchange.</div>
    </div>
    <div class="figure-card">
      <img src="assets/test_run/FLAKEtestruns_06.png" alt="Müggelsee Annual Cycle">
      <div class="figure-caption"><strong>Fig. 6:</strong> Multi-year surface water temperature verification (1980–1996).</div>
    </div>
  </div>
</div>

<div id="tab-stechlin" class="tab-pane">
  <h3>The Stechlinsee (Brandenburg)</h3>
  <p>
    Lake Stechlin (Stechlinsee) is an oligotrophic, deep dimictic lake in northern Brandenburg (surface area <strong>4.25 km²</strong>, mean depth <strong>22.8 m</strong>, maximum depth <strong>69.5 m</strong>). It develops a pronounced seasonal thermocline with an isolated hypolimnion remaining near $4^\circ\text{C}$ throughout summer.
  </p>

  <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin: 1.5rem 0;">
    <a href="assets/test_run/Stechlin94-98test.zip" class="btn-download" download>
      Download Stechlinsee Test Bundle (.zip, 119 KB)
    </a>
    <a href="assets/test_run/Stechlin94-98.nml" class="btn-secondary" download>
      Namelist (.nml)
    </a>
    <a href="assets/test_run/Stechlin94-98.dat" class="btn-secondary" download>
      Forcing Data (.dat, 60 KB)
    </a>
  </div>

  <div class="figure-gallery">
    <div class="figure-card">
      <img src="assets/test_run/FLAKEtestruns_07.png" alt="Stechlinsee Thermocline">
      <div class="figure-caption"><strong>Fig. 7:</strong> Vertical temperature contours showing seasonal metalimnion evolution.</div>
    </div>
    <div class="figure-card">
      <img src="assets/test_run/FLAKEtestruns_08.png" alt="Stechlinsee Mixed Layer">
      <div class="figure-caption"><strong>Fig. 8:</strong> Epilimnion deepening during autumn cooling and convective turnover.</div>
    </div>
    <div class="figure-card">
      <img src="assets/test_run/FLAKEtestruns_09.png" alt="Stechlinsee Bottom Temp">
      <div class="figure-caption"><strong>Fig. 9:</strong> Deep hypolimnion water temperature stability over annual cycle.</div>
    </div>
    <div class="figure-card">
      <img src="assets/test_run/FLAKEtestruns_10.png" alt="Stechlinsee Ice Formation">
      <div class="figure-caption"><strong>Fig. 10:</strong> Winter inverse thermal stratification and ice phenology.</div>
    </div>
  </div>
</div>
