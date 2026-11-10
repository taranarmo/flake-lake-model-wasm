#!/usr/bin/env python3
"""
Generates compact Perpetual Year JSON datasets for the FLake WASM web application.
Reads extracted perpetual 3-hourly time series (3408 / 2920 steps) from IGB Berlin reanalysis
and packages them into optimized JSON for static hosting on GitHub Pages.
"""

import os
import json
import math

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
CGI_DIR = os.path.join(ROOT_DIR, "igb-flake-setup/000flake/flake/cgi-bin")
OUTPUT_DIR_MODEL = os.path.join(ROOT_DIR, "model/data/perpetual")
OUTPUT_DIR_ROOT = os.path.join(ROOT_DIR, "data/perpetual")

BENCHMARK_LAKES = [
    {
        "id": "mueggelsee",
        "file": "00140143",
        "name": "Lake Müggelsee / Stechlin",
        "country": "Germany",
        "region": "Central Europe (Temperate)",
        "lon": 13.0,
        "lat": 52.0,
        "defaultDepth": 7.5,
        "defaultFetch": 2000.0,
        "defaultClarity": 1.0,
        "expectedRegime": "Dimictic",
        "description": "Temperate polymictic/dimictic lake in Brandenburg, Germany. Historical FLake calibration and validation benchmark."
    },
    {
        "id": "sakhalin_reference",
        "file": "01460140",
        "name": "Sakhalin Reference Lake",
        "country": "Russia",
        "region": "Far East (Sub-boreal)",
        "lon": 145.0,
        "lat": 49.0,
        "defaultDepth": 7.5,
        "defaultFetch": 2000.0,
        "defaultClarity": 1.0,
        "expectedRegime": "Dimictic",
        "description": "Historical ground truth benchmark lake from IGB Berlin CGI FLAKEweb.exe validation suite."
    },
    {
        "id": "ladoga",
        "file": "00310151",
        "name": "Lake Ladoga",
        "country": "Russia",
        "region": "Boreal Northern Europe",
        "lon": 30.0,
        "lat": 60.0,
        "defaultDepth": 51.0,
        "defaultFetch": 80000.0,
        "defaultClarity": 0.5,
        "expectedRegime": "Dimictic",
        "description": "Largest freshwater lake in Europe. Characterized by prolonged winter ice cover and thermal bar formation in spring."
    },
    {
        "id": "superior",
        "file": "02740139",
        "name": "Lake Superior",
        "country": "USA / Canada",
        "region": "Laurentian Great Lakes",
        "lon": -87.0,
        "lat": 48.0,
        "defaultDepth": 147.0,
        "defaultFetch": 100000.0,
        "defaultClarity": 0.25,
        "expectedRegime": "Dimictic",
        "description": "Deepest, coldest, and largest by surface area of the Great Lakes. Large thermal inertia with extensive deep hypolimnion."
    },
    {
        "id": "geneva",
        "file": "00070137",
        "name": "Lake Geneva / Constance",
        "country": "Switzerland / France",
        "region": "Perialpine Europe",
        "lon": 6.0,
        "lat": 46.0,
        "defaultDepth": 154.0,
        "defaultFetch": 15000.0,
        "defaultClarity": 0.4,
        "expectedRegime": "Warm Monomictic",
        "description": "Deep sub-alpine lake. Typically mixes completely only during cold winters and remains ice-free year-round."
    },
    {
        "id": "baikal",
        "file": "01080144",
        "name": "Lake Baikal",
        "country": "Russia",
        "region": "Southern Siberia",
        "lon": 107.0,
        "lat": 53.0,
        "defaultDepth": 200.0,
        "defaultFetch": 50000.0,
        "defaultClarity": 0.2,
        "expectedRegime": "Dimictic",
        "description": "Oldest and deepest lake in the world containing 20% of the world's unfrozen surface fresh water. Strong ice cover January to May."
    },
    {
        "id": "victoria",
        "file": "00340090",
        "name": "Lake Victoria",
        "country": "Uganda / Kenya / Tanzania",
        "region": "Equatorial Africa",
        "lon": 33.0,
        "lat": -1.0,
        "defaultDepth": 40.0,
        "defaultFetch": 60000.0,
        "defaultClarity": 1.2,
        "expectedRegime": "Warm Monomictic / Oligomictic",
        "description": "Tropical shallow African Great Lake. Warm waters year-round with seasonal monomictic mixing driven by dry-season winds."
    },
    {
        "id": "tahoe",
        "file": "02410130",
        "name": "Lake Tahoe",
        "country": "USA",
        "region": "Sierra Nevada (Sub-alpine)",
        "lon": -120.0,
        "lat": 39.0,
        "defaultDepth": 300.0,
        "defaultFetch": 18000.0,
        "defaultClarity": 0.15,
        "expectedRegime": "Warm Monomictic",
        "description": "Large, deep, ultra-oligotrophic subalpine lake. Highly transparent water, never freezes completely."
    },
    {
        "id": "titicaca",
        "file": "02920075",
        "name": "Lake Titicaca",
        "country": "Bolivia / Peru",
        "region": "Andean Altiplano",
        "lon": -69.0,
        "lat": -16.0,
        "defaultDepth": 107.0,
        "defaultFetch": 30000.0,
        "defaultClarity": 0.3,
        "expectedRegime": "Warm Monomictic",
        "description": "High-altitude tropical lake at 3,812 m elevation. Intense solar radiation with moderate year-round water temperatures."
    },
    {
        "id": "chad",
        "file": "00230103",
        "name": "Lake Chad",
        "country": "Chad / Nigeria / Cameroon",
        "region": "Sahelian Africa",
        "lon": 22.0,
        "lat": 12.0,
        "defaultDepth": 4.0,
        "defaultFetch": 5000.0,
        "defaultClarity": 2.5,
        "expectedRegime": "Polymictic",
        "description": "Shallow endorheic lake in the Sahel. Frequent diurnal mixing and strong wind agitation."
    },
    {
        "id": "arctic_tundra",
        "file": "00530159",
        "name": "Pechora Tundra Lake",
        "country": "Russia",
        "region": "Arctic Tundra",
        "lon": 52.0,
        "lat": 68.0,
        "defaultDepth": 5.0,
        "defaultFetch": 3000.0,
        "defaultClarity": 1.0,
        "expectedRegime": "Cold Monomictic / Dimictic",
        "description": "High-latitude Arctic tundra lake with 8-9 months of thick ice cover and brief summer open-water period."
    },
    {
        "id": "mediterranean",
        "file": "03550125",
        "name": "North African Mediterranean Lake",
        "country": "Morocco",
        "region": "Mediterranean",
        "lon": -6.0,
        "lat": 34.0,
        "defaultDepth": 12.0,
        "defaultFetch": 4000.0,
        "defaultClarity": 1.2,
        "expectedRegime": "Warm Monomictic",
        "description": "Mediterranean climate lake with hot, dry summers and mild, wet winters. Ice-free year-round."
    }
]

def process_file(source_path):
    with open(source_path, "r", encoding="utf-8") as f:
        lines = [line.strip() for line in f if line.strip()]

    # Extract 2920 perpetual timesteps (year 2006 = lines 488 to 3407 if 3408 lines present)
    # If 2920 lines present, take all
    if len(lines) >= 3408:
        perpetual_lines = lines[488:3408]
    elif len(lines) >= 2920:
        perpetual_lines = lines[:2920]
    else:
        perpetual_lines = lines

    steps = []
    sum_tair = 0.0
    sum_solar = 0.0
    sum_wind = 0.0

    for i, line in enumerate(perpetual_lines):
        parts = [float(x) for x in line.split()]
        if len(parts) < 5:
            continue
        solar, tair, ea, wind, cl = parts[0], parts[1], parts[2], parts[3], parts[4]
        solar = max(0.0, solar)
        wind = max(0.2, wind)

        sum_tair += tair
        sum_solar += solar
        sum_wind += wind

        # Step record: compact array [solar, tair, ea, wind, cl]
        steps.append([
            round(solar, 2),
            round(tair, 2),
            round(ea, 2),
            round(wind, 2),
            round(cl, 3)
        ])

    n = len(steps)
    mean_tair = sum_tair / n if n > 0 else 10.0
    mean_solar = sum_solar / n if n > 0 else 150.0
    mean_wind = sum_wind / n if n > 0 else 3.0

    return {
        "steps": steps,
        "numSteps": n,
        "meanTair": round(mean_tair, 2),
        "meanSolar": round(mean_solar, 2),
        "meanWind": round(mean_wind, 2)
    }

def main():
    os.makedirs(OUTPUT_DIR_MODEL, exist_ok=True)
    os.makedirs(OUTPUT_DIR_ROOT, exist_ok=True)

    catalog = []

    for lake in BENCHMARK_LAKES:
        source_path = os.path.join(CGI_DIR, lake["file"])
        if not os.path.exists(source_path):
            print(f"Skipping {lake['name']}: {source_path} not found.")
            continue

        data = process_file(source_path)
        lake_record = {
            "id": lake["id"],
            "name": lake["name"],
            "country": lake["country"],
            "region": lake["region"],
            "lon": lake["lon"],
            "lat": lake["lat"],
            "defaultDepth": lake["defaultDepth"],
            "defaultFetch": lake["defaultFetch"],
            "defaultClarity": lake["defaultClarity"],
            "expectedRegime": lake["expectedRegime"],
            "description": lake["description"],
            "timeStepSec": 10800.0,
            "annualMeanTair": data["meanTair"],
            "annualMeanSolar": data["meanSolar"],
            "annualMeanWind": data["meanWind"],
            "numSteps": data["numSteps"],
            "steps": data["steps"]
        }

        filename = f"{lake['id']}.json"
        dest_model = os.path.join(OUTPUT_DIR_MODEL, filename)
        dest_root = os.path.join(OUTPUT_DIR_ROOT, filename)

        with open(dest_model, "w", encoding="utf-8") as f:
            json.dump(lake_record, f, separators=(',', ':'))
        with open(dest_root, "w", encoding="utf-8") as f:
            json.dump(lake_record, f, separators=(',', ':'))

        size_kb = os.path.getsize(dest_model) / 1024.0
        print(f"Generated {filename} ({data['numSteps']} steps, {size_kb:.1f} KB) - {lake['name']}")

        # Minimal summary for catalog
        summary_record = {k: v for k, v in lake_record.items() if k != "steps"}
        summary_record["dataFile"] = f"data/perpetual/{filename}"
        catalog.append(summary_record)

    # Save index.json
    index_model = os.path.join(OUTPUT_DIR_MODEL, "index.json")
    index_root = os.path.join(OUTPUT_DIR_ROOT, "index.json")
    with open(index_model, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2)
    with open(index_root, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2)

    print(f"\nGenerated perpetual catalog index with {len(catalog)} lakes in {OUTPUT_DIR_MODEL}/index.json")

if __name__ == "__main__":
    main()
