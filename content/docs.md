---
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
| `data_parameters.f90` | Defines floating point precision (`ireals`) and global physical constants ($g$, $\rho_w$, solar constant). |
| `flake_derivedtypes.f90` | Defines composite Fortran derived types for lake state, atmospheric forcing, sediment parameters, and optical properties. |
| `flake_parameters.f90` | Empirical constants for mixed-layer entrainment, shape factors ($C_T$), albedo bounds, and water thermal expansion coefficients. |
| `flake_configure.f90` | Configuration switches (e.g., enable/disable bottom sediments, ice formation, relaxation tuning). |
| `flake_albedo_ref.f90` | Formulations for open water albedo, dry snow albedo, melting snow, and bare ice as functions of surface temperature. |
| `flake_paramoptic_ref.f90` | Optical characteristics of water: single-band and multi-band solar radiation attenuation formulations. |
| `flake.f90` | Main time-stepping driver module invoking subroutines to integrate mixed layer, thermocline, sediment, and ice equations. |
| `flake_driver.incf` | Core differential equations solver for single time step integration $\Delta t$. |
| `flake_radflux.incf` | Calculates exponential attenuation of solar shortwave radiation through water, ice, and snow columns. |
| `flake_buoypar.incf` | Computes buoyancy flux and thermal expansion coefficient using nonlinear equation of state for freshwater (max density at $4^\circ\text{C}$). |
| `flake_snowdensity.incf` | Prognostic evolution of snow density under aging, compaction, and percolation. |
| `flake_snowheatconduct.incf` | Thermal conductivity of snow and ice as functions of density and temperature. |

<h2 id="routines-sfcflx">Routines of the Surface-Layer Scheme SfcFlx</h2>

The **SfcFlx** package computes aerodynamic fluxes over water surfaces:

| File | Description |
| :--- | :--- |
| `SfcFlx.f90` | Surface layer flux driver module. |
| `SfcFlx_momsenlat.incf` | Calculates surface friction velocity $u_*$, temperature scale $\theta_*$, and humidity scale $q_*$ using Monin-Obukhov similarity. |
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
