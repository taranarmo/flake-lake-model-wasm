# FLake Freshwater Lake Model (Modern Web & WebAssembly)

A modernized, responsive, and easy-to-maintain web presence for the **FLake (Freshwater Lake)** thermodynamic model, recreating the original IGB Berlin portal (`http://www.flake.igb-berlin.de/old/`) as a static site hosted on **GitHub Pages**, featuring the complete Fortran 90 model running 100% client-side via **WebAssembly (WASM)**.

Live Website: **[https://taranarmo.github.io/flake-lake-model/](https://taranarmo.github.io/flake-lake-model/)**  
Interactive WebAssembly Model: **[https://taranarmo.github.io/flake-lake-model/model/](https://taranarmo.github.io/flake-lake-model/model/)**

---

## Overview

[FLake](https://taranarmo.github.io/flake-lake-model/) is a bulk two-layer lake model based on the concept of **self-similarity** of the temperature-depth curve. It was developed by Dr. Dmitrii Mironov and collaborators at the German Weather Service (Deutscher Wetterdienst, DWD) and the Leibniz Institute of Freshwater Ecology and Inland Fisheries (IGB Berlin), and is used operationally in numerical weather prediction (ICON, COSMO, ECMWF IFS) and climate modeling worldwide.

### Key Highlights of the Modernized Site:
- **Zero-Backend Architecture**: The original CGI-based model runner (`_model?LAT=...`) has been replaced with a 100% client-side WebAssembly simulation compiled via **LFortran 0.65.0**. No server backend, database, or CGI scripts required.
- **Dedicated Online Model Subsection**: Located under [`model/`](model/) with interactive lake column visualizer, seasonal presets, atmospheric forcing sliders, time-series plotting, and a single-step ODE numerical calculator.
- **Complete Information Architecture**: Recreates all original sections including Applications, Users directory (with instant search), Documentation & Routines, Useful Hints, Publications bibliography (with instant filter), Model Downloads, Verification Test Runs (tabbed interface for Heiligensee, Müggelsee, Stechlinsee), External-parameter datasets (GLDBv2), Observational datasets, Community links, and Forum.
- **Markdown Content Source of Truth**: All page contents are authored in Markdown under [`content/*.md`](content/) with YAML frontmatter, making it effortless for scientists and researchers to edit text, add tables, or create new sections without touching raw HTML.
- **Clean Build Separation**: Output is compiled into `_site/` (ignored by git), keeping version control free of generated HTML artifacts.
- **Empty Contacts Page**: Contacts page is intentionally kept empty for now.
- **Strictly No Emojis**: Clean, professional academic typography throughout all pages and documentation.
- **Reproducible Toolchain**: Simple Python/Jinja2/Mistune static site generator (`build_site.py`) managed via `uv`.

---

## Website Structure

| Page | Content File (Markdown) | URL Path | Description |
| :--- | :--- | :--- | :--- |
| **Home** | [`content/index.md`](content/index.md) | `index.html` | Overview, model physical principles, news, and quick launch. |
| **Online Model (WASM)** | `model/index.html` | `model/` | Interactive WebAssembly simulation and ODE calculator. |
| **Applications** | [`content/apps.md`](content/apps.md) | `apps.html` | Operational NWP (ICON, IFS, COSMO, HIRLAM), climate, limnology. |
| **Users Directory** | [`content/users.md`](content/users.md) | `users.html` | 40+ international institutes using FLake with instant search. |
| **Documentation** | [`content/docs.md`](content/docs.md) | `docs.html` | Technical description, COSMO Report No. 11, Fortran routine synopsis. |
| **Useful Hints** | [`content/hints.md`](content/hints.md) | `hints.html` | Guidance on lake depth, optical extinction, sediments, tuning-free design. |
| **Publications** | [`content/papers.md`](content/papers.md) | `papers.html` | 115+ categorized peer-reviewed papers, books, theses with search filter. |
| **Downloads** | [`content/downloads.md`](content/downloads.md) | `downloads.html` | Fortran 90 source code archives, Windows binary, GitHub repository. |
| **Test Runs** | [`content/test-runs.md`](content/test-runs.md) | `test-runs.html` | Heiligensee, Müggelsee, Stechlinsee runs with verification plots & data. |
| **GLDB Data** | [`content/external-data.md`](content/external-data.md) | `external-data.html` | Global Lake Database (GLDBv2) depth and coverage datasets. |
| **Observational Data**| [`content/observational-data.md`](content/observational-data.md) | `observational-data.html` | Lake Mendota, Lake Krasnoe, Lake Vendyurskoe empirical datasets. |
| **Related Links** | [`content/links.md`](content/links.md) | `links.html` | EU INTAS projects, LAKE model, LakeMIP, GOTM, host institutes. |
| **Forum** | [`content/forum.md`](content/forum.md) | `forum.html` | FLake Google Groups forum and community channels. |
| **Contact** | [`content/contacts.md`](content/contacts.md) | `contacts.html` | Contact information (intentionally kept empty for now). |

---

## Maintenance & Site Generator

The site uses a clean Markdown + template architecture:
- `content/*.md`: Authoring directory for all site pages in Markdown with YAML frontmatter.
- `templates/base.html`: Master layout (HTML shell, head, header, hero, footer).
- `templates/page.html`: Generic content template that renders parsed Markdown.
- `templates/nav.html`: Global navigation bar with responsive mobile menu.
- `templates/footer.html`: Global footer.
- `templates/sidebar_news.html`: News & updates sidebar.
- `site_data/*.json`: Structured data for sidebar news.

### Rebuilding the Static HTML Pages:
```bash
# Sync dependencies via uv
uv sync       # or: make deps

# Rebuild the site using uv
uv run build_site.py   # or: make site
```
This updates all `.html` pages and `.shtml` compatibility redirects in `<0.2 seconds` with exact locked dependencies from `uv.lock`.

---

## WebAssembly Model (`model/`)

The interactive model lives in `model/` and runs 100% in the client's browser:
- **Zero backend required**: Integrates the Fortran 90 lake equations directly in WebAssembly.
- **Ultra-compact**: The compiled `flake.wasm` core is only **27.8 KB**.
- **Offline / Portable**: Includes an automated Base64 fallback in `wasm-base64.js` so it can run even without an HTTP server under `file://`.
- **Modes**:
  1. *Interactive Simulation*: Dynamic lake column visualizer, ice/snow growth, seasonal presets (Summer, Autumn Turnover, Winter Freezing, Spring Thaw, 365-Day Annual Cycle), and live time-series telemetry.
  2. *Direct ODE Calculator*: Exact single-step parameter inputs, numerical delta diff table ($\Delta T$, $\Delta h$), and JSON result export.

---

## Local Development & Preview

Start a local static web server from the repository root:
```bash
# Using Makefile (runs via uv)
make serve

# Or using uv directly
uv run python -m http.server 8000
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser.

---

## Building from Fortran Sources

The Fortran 90 sources are in `src/`.

### Prerequisites:
- **LFortran 0.65.0** (`conda install -c conda-forge lfortran=0.65.0` or via Nixpkgs)
- **LLVM Tools** (`llc` with `wasm32` target)
- **LLD Linker** (`wasm-ld`)

### Build Command:
```bash
# Build WASM and rebuild website
make all

# Or directly
./build.sh
python3 build_site.py
```

---

## CI/CD & GitHub Pages Deployment

The automated GitHub Actions workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
1. Installs LLVM tools (`llc`, `wasm-ld`) and `lfortran` via Micromamba.
2. Compiles `flake.wasm` from source using `./build.sh`.
3. Runs `python3 build_site.py` to ensure all static pages are fresh.
4. Verifies artifact sizes.
5. Deploys the static site directly to **GitHub Pages**.
