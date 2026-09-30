#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "pyyaml>=6.0",
# ]
# ///
"""
Generates pure markdown content files (content/*.md) from site data.
All files are authored in 100% pure Markdown with standard frontmatter.
"""

import os
import json

SCRIPT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT_DIR = os.path.join(SCRIPT_DIR, "content")
SITE_DATA_DIR = os.path.join(SCRIPT_DIR, "site_data")

os.makedirs(CONTENT_DIR, exist_ok=True)

# 1. contacts.md
with open(os.path.join(CONTENT_DIR, "contacts.md"), "w", encoding="utf-8") as f:
    f.write("""---
title: Contact Information
page_title: Contact Information
page_subtitle: Scientific coordination and inquiries for the FLake lake model.
active_page: contacts
breadcrumbs:
  - name: Contact
has_sidebar: true
---

## Contact Information

Contact information is currently being updated. For model questions and community discussions, visit the [Discussion Forum](forum.html) or browse the [Documentation](docs.html).
""")

# 2. hints.md
with open(os.path.join(CONTENT_DIR, "hints.md"), "w", encoding="utf-8") as f:
    f.write(r"""---
title: Useful Hints & Guidance
page_title: Useful Hints & Best Practices
page_subtitle: Guidelines on lake depth, optical clarity, sediments, and the tuning-free philosophy.
active_page: hints
breadcrumbs:
  - name: Docs & Info
  - name: Useful Hints
has_sidebar: true
---

FLake is a computationally efficient one-dimensional bulk model. The guidance below helps users configure the model properly, avoid misapplication beyond its physical limits, and interpret results correctly.

> **The Tuning-Free Philosophy of FLake**  
> FLake empirical constants and shape factors are derived from independent physical and laboratory data. **They should not be re-tuned for individual lakes.** While re-tuning parameters may improve agreement with a limited observational dataset for a specific site, it degrades the general predictive capability of the physical model.

## 1. Lake Depth Formulation

FLake uses a single depth parameter: the **mean lake depth** $D$ (volume divided by surface area):

- **Mean Depth vs. Max Depth:** Always use the *mean depth* of the water body rather than the deepest sounding point.
- **Deep Lakes:** If the actual lake is very deep (e.g. deeper than 50 m), setting the depth to an *effective depth* of 40–50 m is strongly recommended. FLake is parameterized for lakes where the wind-mixed layer interacts with the bottom or seasonal metalimnion; in extremely deep lakes without bottom thermal communication, deeper layers remain decoupled from annual atmospheric variations.
- **Very Shallow Lakes:** For water bodies shallower than 1–2 m, ensure adequate numerical stability by maintaining realistic time steps ($\\Delta t \\le 3600\\text{ s}$).

## 2. Optical Characteristics & Light Extinction

The optical extinction coefficient $\\gamma$ governs the depth of solar radiation penetration into the water column:

- **Clear Waters:** In oligotrophic, transparent lakes, use low extinction ($\gamma \approx 0.15 - 0.3\\text{ m}^{-1}$). Solar radiation penetrates deeply into the hypolimnion, warming subsurface layers directly.
- **Turbid / Humic Waters:** In shallow polymictic or eutrophic lakes, light is absorbed within the upper tens of centimeters ($\gamma \ge 1.0 - 2.0\\text{ m}^{-1}$).
- **Default Baseline:** If lake transparency is unknown, an extinction coefficient of $\gamma = 0.5\\text{ m}^{-1}$ serves as a robust global default.

## 3. Bottom Sediments & Geothermal Heat Flux

FLake includes a thermally active upper sediment layer sub-model:

- In shallow lakes ($D < 5\\text{ m}$), bottom sediment heat exchange plays a critical role in the seasonal heat budget and spring warming onset.
- In deep stratifying lakes ($D > 20\\text{ m}$), the sediment sub-model can be switched off (`lflk_botsed_use = .false.`) with negligible influence on mixed-layer temperature.

## 4. Atmospheric Forcing Requirements

FLake expects surface atmospheric forcing at each time step $\Delta t$:

1. **Shortwave Solar Radiation:** Surface downward net or global radiation ($I_{atm}$, $\\text{W m}^{-2}$).
2. **Longwave Atmospheric Radiation:** Downward longwave radiation ($F_{atm}$, $\\text{W m}^{-2}$).
3. **Wind Speed:** Surface horizontal wind speed ($U$, $\\text{m s}^{-1}$) at 10 m elevation.
4. **Air Temperature & Humidity:** Air temperature ($T_a$, $\\text{K}$) and specific humidity ($q_a$, $\\text{kg kg}^{-1}$) at 2 m elevation.
5. **Surface Air Pressure:** Pressure ($p_a$, $\\text{N m}^{-2}$) at surface level.
""")

# 3. links.md
with open(os.path.join(CONTENT_DIR, "links.md"), "w", encoding="utf-8") as f:
    f.write("""---
title: Related Links & Projects
page_title: Related Models & Projects
page_subtitle: Collaborative research initiatives, partner institutes, and related lake models.
active_page: links
breadcrumbs:
  - name: Community
  - name: Links
has_sidebar: true
---

## Collaborative Research Initiatives

FLake development and international verification have been supported by numerous joint research initiatives:

- **Lake Model Intercomparison Project (LakeMIP):** An international initiative coordinating the systematic intercomparison and verification of 1D hydrodynamic lake models across diverse lake regimes worldwide.
- **EU INTAS Projects:** Collaborative European-Russian research projects focused on convective boundary layer dynamics, surface fluxes, and operational lake parameterization in regional climate and NWP models.

## Institutional Partners

- **Leibniz Institute of Freshwater Ecology and Inland Fisheries (IGB):** Research institute within the Forschungsverbund Berlin e.V. focused on physical limnology, lake ecosystem dynamics, and environmental physics.
- **Deutscher Wetterdienst (DWD):** The German Meteorological Service, maintaining operational FLake integration inside the global and regional ICON modeling system.
- **European Centre for Medium-Range Weather Forecasts (ECMWF):** Maintaining FLake within the HTESSEL land surface model of the Integrated Forecasting System (IFS).

## Related Lake Modeling Codes

- **LAKE:** A multi-layer 1D model solving turbulent diffusion equations with detailed gas and biogeochemical cycles (developed by Victor Stepanenko et al.).
- **GOTM (General Ocean Turbulence Model):** A widely-used 1D water column hydrodynamic model applicable to lakes and coastal waters.
""")

# 4. docs.md
with open(os.path.join(CONTENT_DIR, "docs.md"), "w", encoding="utf-8") as f:
    f.write("""---
title: Model Documentation & Routines
page_title: Model Documentation
page_subtitle: Comprehensive technical description, routine synopsis, and scientific publications.
active_page: docs
breadcrumbs:
  - name: Docs & Info
  - name: Documentation
has_sidebar: true
---

## FLake Model Documentation & Technical Synopsis

This section provides scientific and technical documentation of the **FLake** model routines, Fortran 90 source structure, and mathematical formulation.

> **COSMO Technical Report No. 11**  
> Mironov, D. V., 2008: *Parameterization of lakes in numerical weather prediction. Description of a lake model.* Deutscher Wetterdienst, Offenbach am Main, Germany, 41 pp.  
> [Download Report (PDF)](assets/papers/flake_synopsis.pdf)

## Table of Contents

- [Conventions and Code Architecture](#conventions)
- [FLake Interface (`src_flake_interface_1D.f90`)](#interface)
- [Routines of the Lake Model FLake](#routines-flake)
- [Routines of the Surface-Layer Scheme SfcFlx](#routines-sfcflx)
- [Key Documentation References](#references)

---

## Conventions and Code Architecture {#conventions}

FLake is coded in **Fortran 90** following modular conventions:

- Single-precision and double-precision types are parameterized via `data_parameters.f90`.
- Variables and subroutines adhere to explicit intent declarations (`intent(in)`, `intent(out)`, `intent(inout)`).
- No site-specific parameters are hard-coded; all physical constants reside in `flake_parameters.f90`.
- Core mathematical expressions are factored into cleanly organized `.incf` include files for portability and readability.
- The WebAssembly edition is compiled directly from these Fortran 90 sources using **LFortran**.

## FLake Interface (`src_flake_interface_1D.f90`) {#interface}

The interface module `src_flake_interface_1D.f90` bridges the host driving system (e.g. NWP model or standalone driver) with the FLake core. It manages:

- Initialization of lake prognostic variables from input sounding or equilibrium state.
- Passing atmospheric forcing: surface net solar radiation ($I_{atm}$), downward atmospheric longwave radiation ($F_{atm}$), surface wind speed ($U$), air temperature ($T_a$), specific humidity ($q_a$), and surface air pressure ($p_a$).
- Calling `flake_driver` to advance lake temperature, mixed layer depth ($h_{ML}$), bottom temperature ($T_{bot}$), shape factor ($C_T$), and ice/snow thickness ($h_{ice}$, $h_{snow}$).
- Calling `SfcFlx` routines to compute turbulent surface fluxes of momentum, sensible heat, and latent heat.

## Routines of the Lake Model FLake {#routines-flake}

| File / Module | Purpose & Description |
| :--- | :--- |
| `data_parameters.f90` | Defines floating point precision (`ireals`) and global physical constants ($g$, $\\rho_w$, solar constant). |
| `flake_derivedtypes.f90` | Defines composite Fortran derived types for lake state, atmospheric forcing, sediment parameters, and optical properties. |
| `flake_parameters.f90` | Empirical constants for mixed-layer entrainment, shape factors ($C_T$), albedo bounds, and water thermal expansion coefficients. |
| `flake_configure.f90` | Configuration switches (e.g., enable/disable bottom sediments, ice formation, relaxation tuning). |
| `flake_albedo_ref.f90` | Formulations for open water albedo, dry snow albedo, melting snow, and bare ice as functions of surface temperature. |
| `flake_paramoptic_ref.f90` | Optical characteristics of water: single-band and multi-band solar radiation attenuation formulations. |
| `flake.f90` | Main time-stepping driver module invoking subroutines to integrate mixed layer, thermocline, sediment, and ice equations. |
| `flake_driver.incf` | Core differential equations solver for single time step integration $\\Delta t$. |
| `flake_radflux.incf` | Calculates exponential attenuation of solar shortwave radiation through water, ice, and snow columns. |
| `flake_buoypar.incf` | Computes buoyancy flux and thermal expansion coefficient using nonlinear equation of state for freshwater (max density at $4^\\circ\\text{C}$). |
| `flake_snowdensity.incf` | Prognostic evolution of snow density under aging, compaction, and percolation. |
| `flake_snowheatconduct.incf` | Thermal conductivity of snow and ice as functions of density and temperature. |

## Routines of the Surface-Layer Scheme SfcFlx {#routines-sfcflx}

The **SfcFlx** package computes aerodynamic fluxes over water surfaces:

| File | Description |
| :--- | :--- |
| `SfcFlx.f90` | Surface layer flux driver module. |
| `SfcFlx_momsenlat.incf` | Calculates surface friction velocity $u_*$, temperature scale $\\theta_*$, and humidity scale $q_*$ using Monin-Obukhov similarity. |
| `SfcFlx_roughness.incf` | Aerodynamic roughness lengths $z_{0u}$, $z_{0T}$, $z_{0q}$ accounting for wind fetch and roughness Reynolds number. |
| `SfcFlx_lwradatm.incf` | Parameterization of downward atmospheric longwave radiation under clear and cloudy skies. |
| `SfcFlx_lwradwsfc.incf` | Upward longwave radiation emitted from water surface using Stefan-Boltzmann law with freshwater emissivity. |
| `SfcFlx_rhoair.incf` | Density of moist air from pressure, virtual temperature, and humidity. |
| `SfcFlx_satwvpres.incf` | Saturation vapor pressure over open water and ice using Magnus-Teten formula. |
| `SfcFlx_spechum.incf` | Specific humidity calculation from vapor pressure and atmospheric pressure. |
| `SfcFlx_wvpreswetbulb.incf` | Psychrometric wet-bulb temperature formulation. |

## Key Documentation References {#references}

- **Mironov, D. V., 2008:** *Parameterization of lakes in numerical weather prediction. Description of a lake model.* COSMO Technical Report, No. 11, Deutscher Wetterdienst, Offenbach am Main, Germany, 41 pp.
- **Mironov, D., E. Heise, E. Kourzeneva, B. Ritter, N. Schneider, and A. Terzhevik, 2010:** *Implementation of the lake parameterisation scheme FLake into the numerical weather prediction model COSMO.* Boreal Env. Res., 15, 218–230.
- **Kirillin, G., 2010:** *Modeling the impact of global warming on water temperature and seasonal mixing in Lake Baikal.* Boreal Env. Res., 15, 125–138.
""")

# 5. downloads.md
with open(os.path.join(CONTENT_DIR, "downloads.md"), "w", encoding="utf-8") as f:
    f.write("""---
title: Source Codes & Downloads
page_title: Model Downloads & Source Codes
page_subtitle: Freely available under MIT license in Fortran 90, Windows binary, and WebAssembly.
active_page: downloads
breadcrumbs:
  - name: Downloads & Data
  - name: Downloads
has_sidebar: true
---

## Model Source Codes & Downloads

FLake source codes and boundary layer schemes are distributed freely under the **MIT License**.

- **Source Code Archive:** [src_flake_sfcflx.tar.gz (75 KB)](assets/downloads/src_flake_sfcflx.tar.gz) or [src_flake_sfcflx.zip (82 KB)](assets/downloads/src_flake_sfcflx.zip)
- **Documentation:** [FLake Synopsis (PDF, 107 KB)](assets/papers/flake_synopsis.pdf)
- **GitHub Repository:** [taranarmo/flake-lake-model](https://github.com/taranarmo/flake-lake-model)

## License (MIT)

```text
Copyright (c) 2008-2026 Dmitrii Mironov, Georgiy Kirillin, and FLake Developers

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```
""")

# 6. apps.md
with open(os.path.join(CONTENT_DIR, "apps.md"), "w", encoding="utf-8") as f:
    f.write("""---
title: Applications in NWP & Climate
page_title: Model Applications
page_subtitle: Operational Numerical Weather Prediction, global climate models, and physical limnology.
active_page: apps
breadcrumbs:
  - name: Applications
has_sidebar: true
---

## Operational Weather Forecasting

FLake is used operationally across national meteorological services:

- **ICON (DWD):** Operational in the German Weather Service ICON modeling framework since 2015.
- **COSMO:** Operational in COSMO-EU and COSMO-DE consortia models since 2010.
- **ECMWF IFS:** Operational in the Integrated Forecasting System (Cy41r1 onwards) with HTESSEL.
- **HIRLAM:** Operational at the Finnish Meteorological Institute (FMI) since 2012.

## Global & Regional Climate Modeling

- **Community Land Model (CLM / CESM):** Sub-grid lake representation.
- **RCA (Rossby Centre Regional Climate Model):** SMHI Swedish meteorological climate runs.
- **Canadian Regional Climate Model (CRCM):** Used by Environment Canada and UQAM.
""")

# 7. external-data.md
with open(os.path.join(CONTENT_DIR, "external-data.md"), "w", encoding="utf-8") as f:
    f.write("""---
title: Global Lake Database (GLDB)
page_title: Global Lake Database (GLDB)
page_subtitle: Global lake fraction and depth datasets for numerical atmospheric modeling.
active_page: external-data
breadcrumbs:
  - name: Downloads & Data
  - name: GLDB Data
has_sidebar: true
---

## Global Lake Database (GLDB)

Atmospheric and climate models require two essential external parameters for inland water bodies:

1. **Lake Fraction ($f_{lake}$):** The sub-grid areal fraction of inland water in each grid box.
2. **Lake Depth ($D$):** The bathymetric mean depth of lakes.

The **Global Lake Database (GLDB)** was developed by Ekaterina Kourzeneva and international collaborators to satisfy these needs.

- **Download GLDB v2:** [gldbv2.tar.gz (28.4 MB)](assets/data/gldbv2.tar.gz)
- **Resolution:** 30 arc-second (approx. 1 km global resolution).
- **Lakes Cataloged:** Over 14,000 individual lake basins with verified bathymetry.
""")

# 8. observational-data.md
with open(os.path.join(CONTENT_DIR, "observational-data.md"), "w", encoding="utf-8") as f:
    f.write("""---
title: Observational Data Sets
page_title: Observational Datasets
page_subtitle: Temperature profiles in lake bottom sediments and high-frequency lake observations.
active_page: observational-data
breadcrumbs:
  - name: Downloads & Data
  - name: Observational Data
has_sidebar: true
---

## Empirical Benchmark Datasets

Empirical datasets for 1D lake model testing and sediment thermal exchange verification:

- **Lake Mendota Sediment Temperature Data (Birge, Juday, March 1927):**  
  [Download Data (TXT, 12 KB)](assets/data/BJM1927_TvsZ_in_BottomSediments.txt) | [ZIP Archive (14 KB)](assets/data/BJM1927_TvsZ_in_BottomSediments.zip)
- **Lake Krasnoe High-Frequency Limnological Data:**  
  [Download ZIP Archive (1.8 MB)](assets/data/LakeKrasnoe.zip)
- **Lake Vendyurskoe High-Resolution Stratification Data (2003):**  
  [Download ZIP Archive (2.4 MB)](assets/data/LakeVendyurskoe_2003.zip)
""")

# 9. forum.md
with open(os.path.join(CONTENT_DIR, "forum.md"), "w", encoding="utf-8") as f:
    f.write("""---
title: Discussion Forum
page_title: FLake Discussion Forum
page_subtitle: Connect with the user community, discuss modeling questions, and share experiences.
active_page: forum
breadcrumbs:
  - name: Community
  - name: Forum
has_sidebar: true
---

## Discussion Channels

- **Mailing List:** `lakemodel@googlegroups.com`
- **GitHub Discussions & Issues:** [GitHub Issues Tracker](https://github.com/taranarmo/flake-lake-model/issues)
- **Web Simulation:** Try the model online in the [WebAssembly Model](model/) section.
""")

# 10. index.md
with open(os.path.join(CONTENT_DIR, "index.md"), "w", encoding="utf-8") as f:
    f.write("""---
title: Home - Freshwater Lake Thermodynamic Model
page_title: Lake Model FLake
page_subtitle: A bulk thermodynamic lake model for weather forecasting, climate modeling, and physical limnology.
active_page: home
description: FLake is a bulk freshwater lake thermodynamic model used operationally in NWP (ICON, COSMO, ECMWF IFS) and climate research.
has_sidebar: true
is_home: true
hero_badge: "WebAssembly Edition • 100% Client-Side Simulation"
---

## What is FLake?

**FLake (Freshwater Lake model)** is a bulk parameterization scheme designed to predict the vertical temperature profile, mixed-layer dynamics, and ice cover of inland water bodies. Developed through an international collaboration between the **Deutscher Wetterdienst (DWD)** and the **Leibniz Institute of Freshwater Ecology and Inland Fisheries (IGB Berlin)**, FLake is widely used as an operational lake parameterization in numerical weather prediction (NWP), regional and global climate models, limnological ecosystem studies, and physical education.

## Core Features

1. **Concept of Self-Similarity**  
   Parametric two-layer representation using assumed shape functions for the lake thermocline, thermally active bottom sediments, and ice/snow layers, preserving key vertical physics with minimal computational cost.

2. **Convective & Wind Mixing**  
   Advanced formulations for mixed-layer depth including convective entrainment equations and relaxation-type wind mixing, accounting for the volumetric absorption of solar radiation.

3. **Thermodynamic Ice & Snow**  
   Complete module for ice accretion, surface melt, white-ice formation, snow compaction, and albedo variation under sub-zero atmospheric forcing conditions.

4. **No Re-Tuning Required**  
   Empirical constants are estimated from independent physical datasets and should not be re-evaluated for individual lakes, preserving robust predictive power without over-fitting.

5. **Lake Surface Fluxes (SfcFlx)**  
   Dedicated boundary-layer scheme with fetch-dependent aerodynamic roughness, roughness Reynolds numbers for scalars, and free-convection transfer laws for calm winds.

6. **Global Coverage (GLDB)**  
   Supported by the Global Lake Database (GLDB v1 and v2), providing high-resolution lake fraction and mean bathymetric depth for over 14,000 lakes worldwide.

## Model Physical Principles

FLake is based on a two-layer parametric representation of the evolving water column temperature profile and on the integral budgets of heat and kinetic energy for the layers in question.

The stratified layer between the upper mixed layer and the basin bottom—the *lake thermocline*—is parameterized using the concept of self-similarity (assumed shape) of the temperature-depth curve. The same self-similarity concept is extended to describe the thermal structure within the active upper layer of bottom sediments, as well as the overlying snow and ice covers.

FLake incorporates four key physical sub-modules:

1. **Flexible Thermocline Parameterization:** Continuous representation of the vertical temperature curve between the mixed-layer base and the lake bottom.
2. **Mixed-Layer Dynamics:** Dynamic calculation of epilimnion depth treating both wind-driven turbulent mixing and buoyancy-driven penetrative convection, explicitly accounting for volumetric solar attenuation.
3. **Bottom Sediments Interaction:** Thermally active sediment layer model capturing seasonal heat storage and geothermal exchange between water and the lake bed.
4. **Snow-Ice Module:** Prediction of ice onset, freezing, snow accumulation, thermal conduction, and spring thaw.

## Operational Weather & Climate Applications

FLake serves as an operational parameterization scheme in major weather forecasting centers and climate institutes across the globe:

- **ICON (DWD):** Operational in the German Weather Service's global numerical weather prediction suite since January 2015.
- **COSMO (DWD & Consortium):** Operational in COSMO-EU since December 2010, and within convection-permitting COSMO-DE (2.8 km mesh) since April 2012.
- **ECMWF IFS:** Operational in the Integrated Forecasting System and the HTESSEL land surface model since May 2015.
- **HIRLAM (FMI):** Operational at the Finnish Meteorological Institute since March 2012.
- **Climate Models:** Implemented in CLM (Community Land Model), RCA (SMHI, Sweden), and the Canadian Regional Climate Model (Environment Canada).

> **Comprehensive Scientific Documentation**  
> For a detailed mathematical description of FLake's equations and numerical routines, consult the [Documentation section](docs.html) or download the [FLake Synopsis Report (PDF)](assets/papers/flake_synopsis.pdf).
""")

# 11. test-runs.md
with open(os.path.join(CONTENT_DIR, "test-runs.md"), "w", encoding="utf-8") as f:
    f.write("""---
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

- [1. The Heiligensee (Berlin) - Shallow, 4.5 m](#heiligensee)
- [2. The Müggelsee (Berlin) - Shallow, 4.9 m](#mueggelsee)
- [3. The Stechlinsee (Brandenburg) - Deep, 22.8 m](#stechlin)

---

## 1. The Heiligensee (Berlin) {#heiligensee}

The Heiligensee is a small, shallow polymictic lake located within Berlin city limits (mean depth **4.5 m**, surface area **0.32 km²**). Long-term meteorological forcing from 1980–1996 was used to simulate mixed-layer temperature, ice cover, and bottom heat exchange.

- [Download Heiligensee Test Bundle (.zip, 420 KB)](assets/test_run/heiligensee80-96test.zip)
- [Namelist (.nml)](assets/test_run/Heiligensee80-96.nml)
- [Forcing Data (.dat, 245 KB)](assets/test_run/Potsdam80-96.dat)

### Heiligensee Figures

![Bathymetry of the Heiligensee](assets/test_run/HeiligenseeMorph.gif)  
*Bathymetry: Depth profile and morphometry of the Heiligensee basin.*

![Fig. 1: Modeled vs. observed water temperature profiles](assets/test_run/FLAKEtestruns_01.png)  
*Fig. 1: Modeled vs. observed water temperature profiles (1980–1996).*

![Fig. 2: Mixed-layer depth and thermal stratification dynamics](assets/test_run/FLAKEtestruns_02.png)  
*Fig. 2: Mixed-layer depth and thermal stratification dynamics.*

![Fig. 3: Ice duration, freeze-up, and spring break-up dates](assets/test_run/FLAKEtestruns_03.png)  
*Fig. 3: Ice duration, freeze-up, and spring break-up dates.*

---

## 2. The Müggelsee (Berlin) {#mueggelsee}

The Müggelsee (Großer Müggelsee) is Berlin's largest lake (surface area **7.4 km²**, mean depth **4.9 m**, max depth **8 m**). As a polymictic shallow lake with strong wind fetch, it exhibits frequent summer mixing episodes punctuated by short-lived stratification.

- [Download Müggelsee Test Bundle (.zip, 380 KB)](assets/test_run/Mueggelsee80-96test.zip)
- [Namelist (.nml)](assets/test_run/Mueggelsee80-96.nml)
- [Forcing Data (.dat, 245 KB)](assets/test_run/Potsdam80-96.dat)

### Müggelsee Figures

![Fig. 4: Water temperature profiles in the Müggelsee](assets/test_run/FLAKEtestruns_04.png)  
*Fig. 4: Simulated mixed-layer temperature compared with IGB station data.*

![Fig. 5: Mixed-layer dynamics and bottom temperature](assets/test_run/FLAKEtestruns_05.png)  
*Fig. 5: Surface heat budget and bottom sediment energy exchange.*

![Fig. 6: Ice thickness and duration](assets/test_run/FLAKEtestruns_06.png)  
*Fig. 6: Multi-year surface water temperature verification (1980–1996).*

---

## 3. The Stechlinsee (Brandenburg) {#stechlin}

Lake Stechlin (Stechlinsee) is an oligotrophic, deep dimictic lake in northern Brandenburg (surface area **4.25 km²**, mean depth **22.8 m**, maximum depth **69.5 m**). It develops a pronounced seasonal thermocline with an isolated hypolimnion remaining near $4^\\circ\\text{C}$ throughout summer.

- [Download Stechlinsee Test Bundle (.zip, 119 KB)](assets/test_run/Stechlin94-98test.zip)
- [Namelist (.nml)](assets/test_run/Stechlin94-98.nml)
- [Forcing Data (.dat, 60 KB)](assets/test_run/Potsdam80-96.dat)

### Stechlinsee Figures

![Fig. 7: Thermocline evolution in the deep Stechlinsee](assets/test_run/FLAKEtestruns_07.png)  
*Fig. 7: Vertical temperature contours showing seasonal metalimnion evolution.*

![Fig. 8: Surface temperature and mixed-layer depth](assets/test_run/FLAKEtestruns_08.png)  
*Fig. 8: Model-data comparison of upper mixed-layer temperature (1994–1998).*

![Fig. 9: Ice conditions and bottom temperature dynamics](assets/test_run/FLAKEtestruns_09.png)  
*Fig. 9: Predicted ice conditions and winter inverse stratification.*

![Fig. 10: Multi-year temperature contours](assets/test_run/FLAKEtestruns_10.png)  
*Fig. 10: Multi-year simulated temperature evolution through the 69.5 m water column.*
""")

# 12. users.md
with open(os.path.join(SITE_DATA_DIR, "users.json"), "r", encoding="utf-8") as f:
    users_data = json.load(f)

users_md = f"""---
title: Users of FLake Worldwide
page_title: FLake Users Directory
page_subtitle: Meteorological agencies, limnological centers, and universities using FLake across the globe.
active_page: users
breadcrumbs:
  - name: Users
has_sidebar: false
filter_search: true
filter_placeholder: "Search institutions, countries, or researchers (e.g., ECMWF, Germany, Canada)..."
---

## FLake Users Worldwide

FLake is utilized by national meteorological services, environmental agencies, limnological research centers, and academic universities across Europe, North America, and globally.

"""

for u in users_data:
    contact_str = f"  \n*Contact:* {u['contact']}" if u.get('contact') else ""
    desc_str = u.get('description', '').strip()
    users_md += f"- **{u['institution']}**{contact_str}  \n{desc_str}\n\n"

users_md += """> **Join the FLake Users Directory**  
> Are you using FLake in research, operational modeling, or education? Let us know so we can include your institute in the directory.
"""

with open(os.path.join(CONTENT_DIR, "users.md"), "w", encoding="utf-8") as f:
    f.write(users_md)

# 13. papers.md
with open(os.path.join(SITE_DATA_DIR, "papers.json"), "r", encoding="utf-8") as f:
    papers_data = json.load(f)

papers_md = """---
title: Scientific Publications
page_title: Publications & Bibliography
page_subtitle: Peer-reviewed articles, books, conference proceedings, and academic theses.
active_page: papers
breadcrumbs:
  - name: Docs & Info
  - name: Publications
has_sidebar: false
filter_search: true
filter_placeholder: "Search publications by author, year, title, or journal (e.g., Mironov, Kirillin, 2016)..."
---

## FLake Publications & Bibliography

A comprehensive bibliography of peer-reviewed journal papers, book chapters, conference proceedings, and academic theses documenting the development, verification, and application of the FLake model.
"""

for category, items in papers_data.items():
    if not items:
        continue
    papers_md += f"\n## {category} ({len(items)})\n\n"
    for p in items:
        links_str = ""
        if p.get("links"):
            link_parts = []
            for l in p["links"]:
                url = l["url"]
                txt = l.get("text") or "Link"
                link_parts.append(f"[{txt}]({url})")
            links_str = " " + " ".join(link_parts)
        papers_md += f"- {p['text']}{links_str}\n\n"

papers_md += """
> **Submitting New Publications**  
> Has your research group published work using FLake? Please submit the reference to update the bibliography.
"""

with open(os.path.join(CONTENT_DIR, "papers.md"), "w", encoding="utf-8") as f:
    f.write(papers_md)

print("Generated all 13 content/*.md files in 100% pure Markdown successfully.")
