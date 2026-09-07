# FLake Lake Model in WebAssembly (via LFortran)

An interactive, 100% client-side WebAssembly simulation and ODE calculator for the **FLake (Freshwater Lake)** thermodynamic model, compiled directly from original Fortran 90 sources using **LFortran 0.65.0**.

Live GitHub Pages Demo: **[https://taranarmo.github.io/flake-lake-model/](https://taranarmo.github.io/flake-lake-model/)**

---

## 🌊 Overview

[FLake](http://www.flake.igb-berlin.de/old/sourcecodes.shtml) is a bulk two-layer lake model based on the concept of **self-similarity** of the temperature-depth curve. It was developed by Dr. Dmitrii Mironov and collaborators at the German Weather Service (Deutscher Wetterdienst, DWD) and the Leibniz Institute of Freshwater Ecology and Inland Fisheries (IGB Berlin), and is used operationally in numerical weather prediction (ICON, COSMO, ECMWF IFS).

This application allows anyone to experiment with lake thermodynamics directly in modern web browsers:
- **Zero backend required**: 100% of the physics runs in WebAssembly on the client.
- **Ultra-compact**: The compiled `flake.wasm` core is only **27.8 KB**.
- **Offline & file:// portable**: Includes an automated Base64 fallback so `index.html` can even be opened straight from disk via `file://`.

---

## 🔬 Modes of Operation

### 1. 🌊 Interactive Simulation & Climate Cycle
- **Dynamic Lake Column**: Visual cross-section showing mixed layer (epilimnion), thermocline (metalimnion), deep hypolimnion, and lake bed.
- **Ice & Snow Dynamics**: Thermodynamic ice sheet ($h_{ice}$) and snow cover ($h_{snow}$) rendered to scale when temperatures drop below freezing.
- **Atmospheric Forcing Controls**: Real-time sliders for air temperature ($T_a$), solar shortwave ($I_{atm}$), wind speed ($U_a$), and snowfall rate.
- **Climate Presets**:
  - ☀️ *Summer Stratification* (Warm air, strong sun, stable thermocline)
  - 🍂 *Autumn Turnover* (Cooling air, high wind, deep convective mixing)
  - ❄️ *Winter Freezing* (Sub-zero air, ice growth, inverse stratification)
  - 🌸 *Spring Thaw* (Ice melt, homothermy around $4^\circ\text{C}$, onset of heating)
  - 🔄 *365-Day Annual Cycle* (Autonomous climate engine cycling through seasons)
- **Time Series History**: Live chart tracking $T_{sfc}$, $T_{wML}$, $T_{bot}$, $T_{air}$, $h_{ML}$, and ice cover over days and weeks.

### 2. 🧮 Direct Model Calculator (Single-Step ODE)
- **Numerical Inputs**: Set exact numbers for initial conditions ($T_{sfc}$, $T_{wML}$, $T_{bot}$, $T_{mnw}$, $h_{ML}$, $C_T$, $h_{ice}$, $h_{snow}$) and atmospheric forcing.
- **Execution**: Hit **Compute Timestep** to integrate a single $\Delta t$ step in $<1\,\text{ms}$, or run $N$ consecutive steps.
- **Delta Analysis**: Instant before $\to$ after table highlighting exact numerical changes ($\Delta T$, $\Delta h$).
- **Export & Sync**: Copy results as raw JSON packet or apply directly to the live visualizer.

---

## 🚀 Quick Start (Local)

### Option 1: Using Python HTTP Server (Recommended)
```bash
python3 -m http.server 8000
```
Open [http://localhost:8000](http://localhost:8000) in your browser.

### Option 2: Direct File Open
Open `index.html` directly in any modern browser (Chrome, Firefox, Safari, Edge); the embedded `wasm-base64.js` fallback allows WASM instantiation without CORS restrictions under the `file://` protocol.

---

## 🛠 Building from Fortran Sources

The Fortran 90 sources are located in `src/`.

### Prerequisites
- **LFortran 0.65.0** (`conda install -c conda-forge lfortran=0.65.0` or via Nixpkgs)
- **LLVM** (`llc` with `wasm32` target)
- **LLD** (`wasm-ld` WebAssembly linker)

### Build Command
```bash
# Using Makefile
make build

# Or directly using the build script
./build.sh
```

The build script will:
1. Compile all Fortran 90 modules in `src/` in topological dependency order.
2. Generate LLVM IR for `src_flake_interface_1D.f90`.
3. Compile LLVM IR to a WebAssembly object file via `llc -march=wasm32`.
4. Link the final `flake.wasm` using `wasm-ld`.
5. Regenerate `wasm-base64.js` automatically.

---

## 🚀 CI/CD & GitHub Pages Deployment

The repository includes a GitHub Actions workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) that:
1. Installs LLVM tools (`llc`, `wasm-ld`) on Ubuntu.
2. Installs `lfortran 0.65.0` via Micromamba (conda-forge).
3. Executes `./build.sh` to compile `flake.wasm` from source.
4. Automatically deploys the site to **GitHub Pages** on every push to `master`.

### Enabling GitHub Pages on the Repository:
1. Go to **Settings** $\to$ **Pages** on your GitHub repository.
2. Under **Build and deployment** $\to$ **Source**, select **GitHub Actions**.
3. Push to `master` to trigger the workflow.
