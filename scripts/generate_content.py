#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "pyyaml>=6.0",
# ]
# ///
"""
Generates initial markdown content files from site data and templates.
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

<div style="min-height: 200px;">
  <!-- Contacts page intentionally empty -->
</div>
""")

# 2. hints.md
with open(os.path.join(CONTENT_DIR, "hints.md"), "w", encoding="utf-8") as f:
    f.write("""---
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

- **Basin-Mean vs. Maximum Depth:** For predicting surface water temperature ($T_{sfc}$) and area-averaged energy fluxes, experience confirms that *mean lake depth* yields the most accurate results, not the maximum sounding depth.
- **Shallow Lakes ($D < 3\\text{–}5\\text{ m}$):** In very shallow polymictic lakes, wind and convective mixing frequently mix the entire water column to the bottom. Bottom sediment heat exchange plays an especially critical role here.
- **Deep Lakes ($D > 40\\text{–}50\\text{ m}$):** In very deep lakes, the hypolimnion remains isolated and near $4^\\circ\\text{C}$ year-round. Because FLake assumes a self-similar profile between mixed-layer base and the bottom, setting an artificial "effective depth" of around 40–50 m is sometimes beneficial when deep hypolimnion dynamics are not the primary focus.
- **Global Depth Fields:** In NWP applications, use depth fields from the [Global Lake Database (GLDB)](external-data.html).

## 2. Optical Characteristics of Lake Water

Solar radiation penetration is governed by the light extinction coefficient $c_{extin}$ (Beer-Lambert law):

- **Default Recommendation:** In the absence of measured optical data, a value of $c_{extin} = 1.0\\text{ m}^{-1}$ is standard for mesotrophic lakes.
- **Oligotrophic / Clear Water:** Clear lakes (e.g. Lake Stechlin, Lake Baikal) have $c_{extin} \\approx 0.15\\text{–}0.3\\text{ m}^{-1}$, allowing solar penetration into the metalimnion and driving deep heating.
- **Eutrophic / Turbid Water:** Turbid, algae-rich lakes (e.g. Lake Müggelsee) exhibit $c_{extin} > 2.0\\text{–}4.0\\text{ m}^{-1}$, trapping nearly all solar heating in the uppermost meter.

## 3. Thermally Active Bottom Sediments

FLake includes an optional module for bottom sediment heat storage:

- **Sediment Depth ($H_{sed}$):** The thermally active sediment layer depth is typically set to $10\\text{ m}$. Below this depth, seasonal temperature fluctuations are attenuated to near zero.
- **Lower Boundary Condition:** The temperature at $z = D + H_{sed}$ can be approximated by the climatological annual mean 2m air temperature, or initialized with zero geothermal heat flux.
- **Importance:** Sediments buffer heat—storing energy in summer and releasing it into the water column during autumn and winter, which delays autumn cooling and winter ice onset.

## 4. Model Initialization & Spin-Up

- **Homothermy Initialization:** The ideal time to initialize FLake from scratch is during seasonal *turnover* (spring or late autumn), when the lake is nearly isothermal at approximately $4^\\circ\\text{C}$ with $h_{ML} = D$.
- **Spin-Up Period:** When initializing from arbitrary states, run FLake through a spin-up period of 1 to 2 annual cycles so that the sediment temperatures and thermocline structure reach equilibrium with the atmospheric forcing.

## 5. Time Step Selection

FLake's ODE system is computationally stable across a wide range of time steps:

- **Standalone Simulations:** A time step of $\\Delta t = 3600\\text{ s}$ (1 hour) is optimal and aligns with typical hourly meteorological datasets.
- **NWP / Climate Coupling:** FLake can be called directly at the atmospheric host timestep (e.g. 10 to 60 seconds) without numerical degradation.
""")

# 3. apps.md
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

## FLake Applications Overview

**FLake** is suitable for a wide spectrum of environmental modeling applications. It can be used as a lake parameterisation scheme in numerical weather prediction (NWP), regional and global climate models, as a physical hydrodynamic module in aquatic ecological models, as a standalone single-column lake model, and as an educational tool for physical limnology.

## Lake Parameterisation in NWP & Climate Models

As a lake parameterisation scheme, FLake is implemented into limited-area and global NWP models, including **COSMO**, **HIRLAM**, **ICON**, and **IFS**:

| Model / System | Agency / Institute | Operational Status | Description |
| :--- | :--- | :--- | :--- |
| **ICON** | Deutscher Wetterdienst (DWD) | Operational (2015–present) | Global and regional configurations of DWD's next-generation NWP suite. |
| **IFS / HTESSEL** | ECMWF | Operational (2015–present) | Integrated Forecasting System using HTESSEL surface scheme with lake tile. |
| **COSMO-EU & COSMO-DE** | DWD / COSMO Consortium | Operational (2010–present) | COSMO-EU (7 km) and convection-permitting COSMO-DE ensemble (2.8 km). |
| **HIRLAM** | Finnish Meteorological Institute (FMI) | Operational (2012–present) | Operational weather forecasting for the Nordic region. |
| **SURFEX / ALADIN** | Météo-France | Implemented | Integrated as lake module in the SURFEX externalized surface platform. |
| **Unified Model / JULES** | UK Met Office | Implemented | Joint UK Land Environment Simulator (JULES) lake parameterization. |
| **WRF** | NCAR / International Community | Implemented | Coupled into the Weather Research and Forecasting atmospheric model. |
| **CLM / RCA / CRCM** | NCAR, SMHI, Environment Canada | Research & Climate Runs | Regional and global climate simulations of inland lake thermal regimes. |

### External-Parameter Requirements

In order to be incorporated into an NWP or climate model, FLake requires two-dimensional external parameter fields:

- **Lake Fraction:** The area fraction of a given grid box covered by inland water, compatible with the atmospheric model's land-sea mask.
- **Lake Depth:** The mean or effective bathymetric depth of lakes within each grid cell. This is provided globally by the [Global Lake Database (GLDB)](external-data.html) developed by E. Kourzeneva and M. Choulga.
- **Optical Characteristics:** The light extinction coefficient ($c_{extin}$) of lake water. In the absence of global empirical datasets, FLake provides recommended defaults (see [Useful Hints](hints.html)).

## Single-Column Lake & Ecosystem Modelling

FLake is extensively utilized as a standalone physical model driven by observed meteorological time series (air temperature, solar radiation, relative humidity, wind speed). It provides:

- Accurate simulation of epilimnion deepening and seasonal thermocline stratification.
- Coupling with biogeochemical and ecological models to simulate dissolved oxygen, phytoplankton blooms, and nutrient cycles.
- High-speed calculation: integrates years of lake thermodynamics in milliseconds, making it ideal for large-scale multi-lake ensemble studies and paleolimnology.

> **Try Single-Column FLake Instantly**  
> You can experiment with FLake's 1D column physics right now without downloading or compiling any code using the [FLake WebAssembly Online Simulation](model/).
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

- [Conventions & Code Architecture](#conventions)
- [FLake Interface (`src_flake_interface_1D.f90`)](#interface)
- [Routines of the Lake Model FLake](#routines-flake)
- [Routines of the Surface-Layer Scheme SfcFlx](#routines-sfcflx)
- [Key Documentation References](#references)

---

<h2 id="conventions">Conventions & Code Architecture</h2>

FLake is coded in **Fortran 90** following modular conventions:

- Single-precision and double-precision types are parameterized via `data_parameters.f90`.
- Variables and subroutines adhere to explicit intent declarations (`intent(in)`, `intent(out)`, `intent(inout)`).
- No site-specific parameters are hard-coded; all physical constants reside in `flake_parameters.f90`.
- Core mathematical expressions are factored into cleanly organized `.incf` include files for portability and readability.
- The WebAssembly edition is compiled directly from these Fortran 90 sources using **LFortran**.

<h2 id="interface">FLake Interface (`src_flake_interface_1D.f90`)</h2>

The interface module `src_flake_interface_1D.f90` bridges the host driving system (e.g. NWP model or standalone driver) with the FLake core. It manages:

- Initialization of lake prognostic variables from input sounding or equilibrium state.
- Passing atmospheric forcing: surface net solar radiation ($I_{atm}$), downward atmospheric longwave radiation ($F_{atm}$), surface wind speed ($U$), air temperature ($T_a$), specific humidity ($q_a$), and surface air pressure ($p_a$).
- Calling `flake_driver` to advance lake temperature, mixed layer depth ($h_{ML}$), bottom temperature ($T_{bot}$), shape factor ($C_T$), and ice/snow thickness ($h_{ice}$, $h_{snow}$).
- Calling `SfcFlx` routines to compute turbulent surface fluxes of momentum, sensible heat, and latent heat.

<h2 id="routines-flake">Routines of the Lake Model FLake</h2>

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

<h2 id="routines-sfcflx">Routines of the Surface-Layer Scheme SfcFlx</h2>

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

<h2 id="references">Key Documentation References</h2>

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

**FLake** is freely available open-source software distributed under the terms of the **MIT License**. You can download the original Fortran 90 sources, the Windows binary package, or access the modern WebAssembly repository.

> **Zero-Install WebAssembly Edition**  
> Run FLake directly in modern web browsers without installing any compilers or dependencies. The WebAssembly binary is only 27.8 KB and runs entirely on the client side.  
> [Launch Online Model](model/)

## Download Packages

| Package | Format | Size | Contents | Action |
| :--- | :--- | :--- | :--- | :--- |
| **FLake & SfcFlx Sources** | `.tar.gz` | 28 KB | Fortran 90 lake model routines, surface-layer scheme (SfcFlx), and 1D interface. | [Download .tar.gz](assets/downloads/src_flake_sfcflx.tar.gz) |
| **FLake & SfcFlx Sources** | `.zip` | 44 KB | Fortran 90 source files formatted for Windows and cross-platform environments. | [Download .zip](assets/downloads/src_flake_sfcflx.zip) |
| **Windows Executable & Test Run** | `.zip` | 245 KB | Pre-compiled `flake.exe` executable, sample namelists, and forcing datasets. | [Download flake.zip](assets/test_run/flake.zip) |
| **GitHub Repository** | Git / WASM | Online | Full repository with Fortran 90 sources, LFortran build scripts, and WASM web interface. | [View GitHub](https://github.com/taranarmo/flake-lake-model) |

## Quick Compilation Guide

### Compiling to WebAssembly (via LFortran)

The WebAssembly build leverages **LFortran**:

```bash
# Prerequisites: lfortran 0.65.0, llc (llvm-tools), wasm-ld (lld)
./build.sh

# Or using Makefile
make build
```

### Compiling Native Binary (via GNU Fortran)

```bash
# Compile all modules in dependency order
gfortran -O3 -c data_parameters.f90
gfortran -O3 -c flake_derivedtypes.f90
gfortran -O3 -c flake_parameters.f90
gfortran -O3 -c flake_configure.f90
gfortran -O3 -c flake_albedo_ref.f90
gfortran -O3 -c flake_paramoptic_ref.f90
gfortran -O3 -c flake.f90
gfortran -O3 -c SfcFlx.f90
gfortran -O3 -c src_flake_interface_1D.f90
gfortran -O3 *.o -o flake_run
```

## MIT License Terms

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```
""")

# 6. external-data.md
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

## External-Parameter Data Sets: Global Lake Database (GLDB)

In order to implement a lake parameterisation scheme in numerical weather prediction (NWP) or climate modeling, two-dimensional external parameter fields of **lake fraction** and **lake depth** are required globally.

> **Global Lake Database v2 (GLDBv2) Archive**  
> Comprehensive dataset containing bathymetric depths for ~14,000 freshwater lakes and 220 saline lakes.  
> [Download gldbv2.tar.gz (9.8 MB)](assets/data/gldbv2.tar.gz)

## Overview of GLDBv2

Developed by **Ekaterina Kourzeneva** and **Margarita Choulga**, the Global Lake Database provides the atmospheric modeling community with consistent bathymetric information:

- **Coverage:** Coordinates, surface areas, and bathymetric depths for approximately 14,000 freshwater lakes and 220 saline lakes worldwide.
- **Geological Origin Estimates:** For lakes lacking direct bathymetric soundings, indirect estimates of mean depth are provided for the boreal zone based on geological origin (glacial, tectonic, thermokarst, etc.).
- **NWP Integration:** Format compatible with ECOCLIMAP, COSMO external parameters (EXTPAR), IFS surface preprocessing, and SURFEX.

## Key References for GLDB

Please cite these publications when utilizing GLDB data in research or model runs:

- **Choulga, M., E. Kourzeneva, E. Zakharova, and A. Doganovsky, 2014:** *Estimation of the mean depth of boreal lakes for use in numerical weather prediction and climate modelling.* Tellus A, 66, 21295, [doi:10.3402/tellusa.v66.21295](http://dx.doi.org/10.3402/tellusa.v66.21295).
- **Kourzeneva, E., H. Asensio, E. Martin, and S. Faroux, 2012:** *Global gridded dataset of lake coverage and lake depth for use in numerical weather prediction and climate modelling.* Tellus A, 64, 15640, [doi:10.3402/tellusa.v64i0.15640](http://dx.doi.org/10.3402/tellusa.v64i0.15640).
- **Kourzeneva, E., 2010:** *External data for lake parameterization in Numerical Weather Prediction models.* Boreal Env. Res., 15, 158–177.
- **Kourzeneva, E., 2009:** *Global dataset for the mean lake depth.* COSMO Newsletter, 9, 131–134.
""")

# 7. observational-data.md
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

## Observational Data Sets for Model Testing

Below are empirical observation datasets curated for testing and validating one-dimensional lake and sediment thermal models.

## 1. Temperature Profiles in Lake Bottom Sediments

### Lake Mendota Sediment Profiles
Historical sediment temperature soundings from the classic study by Birge, Juday, and March (1927): *The temperature of the bottom deposits of Lake Mendota*, Trans. Wiscon. Acad. Sci., 23, 187–231.
- [View Text File](assets/data/BJM1927_TvsZ_in_BottomSediments.txt)
- [Download .zip (2.7 KB)](assets/data/BJM1927_TvsZ_in_BottomSediments.zip)

### Lake Krasnoe (1971–1988), Russia
Multi-year seasonal sediment temperature measurements and water column thermal profiles from Lake Krasnoe (Karelian Isthmus, Russia), ideal for validating multi-annual bottom heat exchange.
- [Download .zip (18 KB)](assets/data/LakeKrasnoe.zip)

## 2. High-Frequency Meteorological & Limnological Data

### Lake Vendyurskoe (July 2003), Russia
High-resolution meteorological forcing and internal water temperature measurements captured during an intensive summer field campaign (18–22 July 2003).
- [Download .zip (6.1 KB)](assets/data/LakeVendyurskoe_2003.zip)

### North Temperate Lakes LTER Datasets
Long-term ecological research data from the Yahara Lake District (Lake Mendota) and Trout Lake Station in the Northern Highlands of Wisconsin, USA.
- [LTER Project Website](https://lter.limnology.wisc.edu/)
""")

# 8. links.md
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

## Related Links, Projects & Research Models

Collaborative research projects, international lake modeling initiatives, and related hydrodynamic and atmospheric software packages.

## Historical EU Research Projects (INTAS)

- **EU Project INTAS-01-2132:** *"Representation of lakes in numerical models for environmental applications"* — Foundational research initiative establishing the parametric self-similarity formulations for lake modeling in NWP.
- **EU Project INTAS-05-1000007-431:** *"Lake model FLake: An advanced tool for environmental modelling and education"* — Extension of FLake into ecological, climate, and educational domains with global coverage.

## Related Lake & Ocean Models

- **LAKE Model (Moscow State University):** A one-dimensional multi-layer thermodynamic and biogeochemical lake/reservoir model ([LAKE on GitHub](https://github.com/stepanenko1983/LAKE)).
- **LakeMIP (Lake Model Intercomparison Project):** International community effort comparing single-column and 3D lake models across diverse morphometric and climatic regimes.
- **GOTM (General Ocean Turbulence Model):** An open-source 1D hydrodynamic model for marine and limnological water columns ([gotm.net](https://gotm.net/)).

## Host Institutions & Consortia

- **Leibniz Institute of Freshwater Ecology and Inland Fisheries (IGB):** [www.igb-berlin.de](https://www.igb-berlin.de)
- **Deutscher Wetterdienst (DWD):** [www.dwd.de](https://www.dwd.de)
- **COSMO Consortium:** [www.cosmo-model.org](http://www.cosmo-model.org/)
- **European Centre for Medium-Range Weather Forecasts (ECMWF):** [www.ecmwf.int](https://www.ecmwf.int)
- **Northern Water Problems Institute (NWPI):** [nwpi.krc.karelia.ru](http://nwpi.krc.karelia.ru)
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

## FLake Community & Discussion Forum

Join the community of researchers, meteorologists, and limnologists using and developing FLake.

> **FLake Discussion Group (Google Groups)**  
> The official mailing list and forum for FLake announcements, coupling questions, troubleshooting, and modeling tips:  
> [Open FLake Forum on Google Groups](https://groups.google.com/g/lakemodel)

## Community Channels

- **Mailing List:** Send questions or discussion topics to `lakemodel@googlegroups.com` (subscription required).
- **GitHub Discussions & Issues:** For source code questions, WebAssembly feedback, or build issues, please use the [GitHub Issues tracker](https://github.com/taranarmo/flake-lake-model/issues).
- **Contact:** Visit the [Contacts page](contacts.html) for general project inquiries.
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

<div class="wasm-callout">
  <div class="wasm-callout-text">
    <h3>Experience FLake Live in Your Browser</h3>
    <p>
      The complete Fortran 90 thermodynamic core is compiled directly to WebAssembly using <strong>LFortran</strong>. Explore seasonal stratification, ice sheet growth, mixed-layer convective entrainment, or run single-step ODE calculations—all locally on your device with <strong>zero server backend required</strong>.
    </p>
  </div>
  <a href="model/" class="wasm-callout-btn">Launch Simulation</a>
</div>

## What is FLake?

**FLake (Freshwater Lake model)** is a bulk parameterization scheme designed to predict the vertical temperature profile, mixed-layer dynamics, and ice cover of inland water bodies. Developed through an international collaboration between the **Deutscher Wetterdienst (DWD)** and the **Leibniz Institute of Freshwater Ecology and Inland Fisheries (IGB Berlin)**, FLake is widely used as an operational lake parameterization in numerical weather prediction (NWP), regional and global climate models, limnological ecosystem studies, and physical education.

<div class="feature-cards">
  <div class="feature-card">
    <div class="feature-number">01</div>
    <h3>Concept of Self-Similarity</h3>
    <p>
      Parametric two-layer representation using assumed shape functions for the lake thermocline, thermally active bottom sediments, and ice/snow layers, preserving key vertical physics with minimal computational cost.
    </p>
  </div>

  <div class="feature-card">
    <div class="feature-number">02</div>
    <h3>Convective & Wind Mixing</h3>
    <p>
      Advanced formulations for mixed-layer depth including convective entrainment equations and relaxation-type wind mixing, accounting for the volumetric absorption of solar radiation.
    </p>
  </div>

  <div class="feature-card">
    <div class="feature-number">03</div>
    <h3>Thermodynamic Ice & Snow</h3>
    <p>
      Complete module for ice accretion, surface melt, white-ice formation, snow compaction, and albedo variation under sub-zero atmospheric forcing conditions.
    </p>
  </div>

  <div class="feature-card">
    <div class="feature-number">04</div>
    <h3>No Re-Tuning Required</h3>
    <p>
      Empirical constants are estimated from independent physical datasets and should not be re-evaluated for individual lakes, preserving robust predictive power without over-fitting.
    </p>
  </div>

  <div class="feature-card">
    <div class="feature-number">05</div>
    <h3>Lake Surface Fluxes (SfcFlx)</h3>
    <p>
      Dedicated boundary-layer scheme with fetch-dependent aerodynamic roughness, roughness Reynolds numbers for scalars, and free-convection transfer laws for calm winds.
    </p>
  </div>

  <div class="feature-card">
    <div class="feature-number">06</div>
    <h3>Global Coverage (GLDB)</h3>
    <p>
      Supported by the Global Lake Database (GLDB v1 and v2), providing high-resolution lake fraction and mean bathymetric depth for over 14,000 lakes worldwide.
    </p>
  </div>
</div>

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
    Lake Stechlin (Stechlinsee) is an oligotrophic, deep dimictic lake in northern Brandenburg (surface area <strong>4.25 km²</strong>, mean depth <strong>22.8 m</strong>, maximum depth <strong>69.5 m</strong>). It develops a pronounced seasonal thermocline with an isolated hypolimnion remaining near $4^\\circ\\text{C}$ throughout summer.
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
---

## FLake Users Worldwide

FLake is utilized by national meteorological services, environmental agencies, limnological research centers, and academic universities across Europe, North America, and globally.

<div class="filter-bar">
  <input type="text" id="users-search" class="filter-input" placeholder="Search institutions, countries, or researchers (e.g., ECMWF, Germany, Canada)...">
  <div id="users-count" class="filter-count">Showing {len(users_data)} institutions</div>
</div>

<div class="user-cards-grid">
"""
for u in users_data:
    contact_html = f"<div class=\"user-contact\">Contact: {u['contact']}</div>" if u.get('contact') else ""
    users_md += f"""  <div class="user-card">
    <div class="user-card-header">
      <div class="user-inst-name">{u['institution']}</div>
      {contact_html}
    </div>
    <div class="user-desc">
      {u['description']}
    </div>
  </div>
"""
users_md += """</div>

> **Join the FLake Users Directory**  
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
---

## FLake Publications & Bibliography

A comprehensive bibliography of peer-reviewed journal papers, book chapters, conference proceedings, and academic theses documenting the development, verification, and application of the FLake model.

<div class="filter-bar">
  <input type="text" id="papers-search" class="filter-input" placeholder="Search publications by author, year, title, or journal (e.g., Mironov, Kirillin, 2016, COSMO)...">
  <div id="papers-count" class="filter-count">Showing all publications</div>
</div>
"""

for category, items in papers_data.items():
    papers_md += f"\n## {category} ({len(items)})\n\n"
    papers_md += '<div class="papers-list" style="margin-bottom: 2rem;">\n'
    for p in items:
        papers_md += '  <div class="paper-item">\n'
        papers_md += f'    <div class="paper-text">{p["text"]}</div>\n'
        if p.get("links"):
            papers_md += '    <div class="paper-links">\n'
            for l in p["links"]:
                url = l["url"]
                txt = l.get("text") or "Paper Link"
                papers_md += f'      <a href="{url}" target="_blank" rel="noopener">{txt}</a>\n'
            papers_md += '    </div>\n'
        papers_md += '  </div>\n'
    papers_md += '</div>\n'

papers_md += """
> **Submitting New Publications**  
> Has your research group published work using FLake? Please submit the reference to update the bibliography.
"""

with open(os.path.join(CONTENT_DIR, "papers.md"), "w", encoding="utf-8") as f:
    f.write(papers_md)

print("Generated all 13 content/*.md files successfully.")
