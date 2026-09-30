---
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
