# FLake Lake Model in WebAssembly (via LFortran)

A high-performance, interactive, 100% client-side WebAssembly simulation of the **FLake (Freshwater Lake)** thermodynamic lake model, compiled directly from Fortran 90 sources using the **LFortran 0.65.0** compiler.

---

## 🌊 Overview

[FLake](http://www.flake.igb-berlin.de/old/sourcecodes.shtml) is a bulk two-layer lake model based on the concept of **self-similarity** of the temperature-depth curve. It was developed by Dr. Dmitrii Mironov and collaborators at the German Weather Service (DWD) and the Leibniz Institute of Freshwater Ecology and Inland Fisheries (IGB Berlin), and is used operationally in numerical weather prediction models (ICON, COSMO, ECMWF IFS).

This application allows anyone to experiment with lake thermodynamics directly in modern web browsers:
- **No server backend required**: 100% of the physics runs in WebAssembly on the client.
- **Ultra-compact**: The compiled `flake.wasm` core is only **27.8 KB**.
- **Offline / file:// portable**: Includes an automated Base64 fallback so `index.html` can even be opened straight from disk via `file://`.

---

## 🚀 Quick Start

### Method 1: Local HTTP Server (Recommended)
```bash
cd flake-wasm
python3 -m http.server 8000
```
Then open `http://localhost:8000` in your web browser.

### Method 2: Direct File Open
Simply double-click [`index.html`](file:///home/taranarmo/dev/nixpkgs-lfortran/flake-wasm/index.html) or open it in any browser (Chrome, Firefox, Safari, Edge). The included `wasm-base64.js` fallback allows WASM instantiation without CORS restrictions under the `file://` protocol.

---

## 🔬 Features & Visualizations

1. **Physical Lake Cross-Section (Canvas)**:
   - Dynamic water column showing the mixed layer (epilimnion), thermocline (metalimnion), and deep hypolimnion.
   - Live visual transition between warm stratified water, cold homothermy (turnover), and sub-zero ice cover.
   - Ice layer with crystalline frost texture and snow blanket rendered to scale when temperatures drop below freezing.
   - Animated wind vectors and diurnal sky conditions (moving sun/moon).

2. **Temperature Profile $T(z)$ Plot**:
   - Exact mathematical evaluation of FLake's self-similar polynomial thermocline profile:
     $$\Phi_T(\zeta) = \left(\frac{40}{3} C_T - \frac{20}{3}\right) \zeta + \left(18 - 30 C_T\right) \zeta^2 + \left(20 C_T - 12\right) \zeta^3 + \left(\frac{5}{3} - \frac{10}{3} C_T\right) \zeta^4$$
   - Highlights surface temp ($T_{sfc}$), mixed layer depth ($h_{ML}$), and maximum density line ($\rho_{max}$ at $4^\circ\text{C}$).
   - Interactive hover tooltip to inspect temperatures at any depth.

3. **Multi-Series History Chart**:
   - Continuous time series tracking $T_{sfc}$, $T_{wML}$, $T_{bot}$, $T_{air}$, mixed layer depth $h_{ML}$, and ice thickness $h_{ice}$ over days and weeks.
   - Interactive scrubbing tooltip.

4. **Atmospheric Forcing & Scenarios**:
   - **Scenario Presets**:
     - ☀️ *Summer Stratification* (Warm air, strong solar radiation, sharp thermocline)
     - 🍂 *Autumn Turnover* (Cooling air, high wind, deep convective mixing)
     - ❄️ *Winter Freezing* (Sub-zero temperatures, ice growth, inverse thermal profile)
     - 🌸 *Spring Thaw* (Ice melt, homothermy around $4^\circ\text{C}$, onset of heating)
     - 🔄 *365-Day Annual Cycle* (Autonomous climate engine cycling through seasons)
   - **Interactive Sliders**:
     - Air temperature ($-25^\circ\text{C}$ to $+38^\circ\text{C}$)
     - Solar shortwave radiation ($0$ to $950\,\text{W/m}^2$)
     - 10m wind speed ($0.5$ to $22\,\text{m/s}$)
     - Snow precipitation ($0$ to $5\,\text{mm/h}$)
     - Diurnal Day/Night cycle toggle
     - Lake depth ($3\,\text{m}$ to $35\,\text{m}$)
     - Water clarity / light extinction coefficient $\kappa$

---

## 🛠 Compilation Pipeline (Fortran to WebAssembly)

The Fortran 90 sources were compiled with **LFortran 0.65.0** using the LLVM backend and linked with `wasm-ld`:

```bash
# 1. Compile Fortran 90 to LLVM IR
lfortran --show-llvm -c src_flake_interface_1D.f90 > flake.ll

# 2. Compile LLVM IR to WebAssembly object file
llc -march=wasm32 -filetype=obj flake.ll -o flake.o

# 3. Link with wasm-ld
wasm-ld --no-entry --export-all --import-undefined flake.o -o flake.wasm
```

The resulting `flake.wasm` file exports all core subroutines including `flake_interface`, `flake_driver`, and surface heat flux modules.
