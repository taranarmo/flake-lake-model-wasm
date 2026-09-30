---
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
