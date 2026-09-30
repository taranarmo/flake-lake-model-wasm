---
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
