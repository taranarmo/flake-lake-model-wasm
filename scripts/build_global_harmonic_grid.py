#!/usr/bin/env python3
"""
Builds the Global Land Climatology Harmonic Grid (climatology_harmonics.json)
for offline perpetual year simulations on arbitrary coordinates worldwide.
Extracts NOAA GDAS1 3-hourly meteorological time series across a 5° x 5° global land grid,
performs Fourier decomposition (annual, semi-annual, diurnal harmonics, and synoptic variance),
and compiles a compact ~75 KB JSON grid for client-side WebAssembly execution.
"""

import os
import sys
import json
import subprocess
import concurrent.futures
import numpy as np

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
CGI_DIR = os.path.join(ROOT_DIR, "igb-flake-setup/000flake/flake/cgi-bin")
OUTPUT_PATHS = [
    os.path.join(ROOT_DIR, "model/data/climatology_harmonics.json"),
    os.path.join(ROOT_DIR, "data/climatology_harmonics.json")
]

def is_land(lat, lon):
    # Europe
    if 35 <= lat <= 71 and -10 <= lon <= 50: return True
    # Russia / Siberia / Central Asia
    if 40 <= lat <= 75 and 50 <= lon <= 180: return True
    # East Asia / China / Japan / Korea
    if 18 <= lat <= 45 and 75 <= lon <= 145: return True
    # India / SE Asia
    if 5 <= lat <= 30 and 65 <= lon <= 105: return True
    if -10 <= lat <= 15 and 95 <= lon <= 140: return True
    # Africa
    if -35 <= lat <= 37 and -18 <= lon <= 52: return True
    # North America
    if 15 <= lat <= 75 and -168 <= lon <= -52: return True
    # Central America
    if 8 <= lat <= 20 and -100 <= lon <= -75: return True
    # South America
    if -56 <= lat <= 12 and -82 <= lon <= -34: return True
    # Australia & New Zealand
    if -44 <= lat <= -10 and 112 <= lon <= 154: return True
    if -47 <= lat <= -34 and 166 <= lon <= 178: return True
    # Middle East
    if 12 <= lat <= 40 and 35 <= lon <= 65: return True
    return False

def get_grid_filename(lon, lat):
    l_idx = (lon + 360) if lon < 0 else lon
    l_idx += 1
    la_idx = lat + 91
    return f"{l_idx:04d}{la_idx:04d}"

def extract_and_fit_point(coord):
    lon, lat = coord
    fname = get_grid_filename(lon, lat)
    fpath = os.path.join(CGI_DIR, fname)

    # Run getmeteo if not already extracted
    if not os.path.exists(fpath):
        subprocess.run(["wine", "getmeteo.exe", str(lon), str(lat)],
                       cwd=CGI_DIR,
                       stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL)

    if not os.path.exists(fpath):
        return None

    try:
        with open(fpath, "r", encoding="utf-8") as f:
            lines = [list(map(float, line.split())) for line in f if len(line.split()) >= 5]
    except Exception:
        return None

    if len(lines) < 2920:
        return None

    # Use first 2920 timesteps (365 days * 8 steps/day)
    data = np.array(lines[:2920])
    solar = np.maximum(0.0, data[:, 0])
    tair = data[:, 1]
    ea = np.maximum(0.1, data[:, 2])
    wind = np.maximum(0.2, data[:, 3])
    cl = np.clip(data[:, 4], 0.0, 1.0)

    n = len(tair)
    t_days = np.arange(n) * (3.0 / 24.0)
    w1 = 2.0 * np.pi / 365.0
    w2 = 4.0 * np.pi / 365.0
    wd = 2.0 * np.pi / 1.0

    X = np.column_stack([
        np.ones(n),
        np.cos(w1 * t_days), np.sin(w1 * t_days),
        np.cos(w2 * t_days), np.sin(w2 * t_days),
        np.cos(wd * t_days), np.sin(wd * t_days)
    ])

    beta, _, _, _ = np.linalg.lstsq(X, tair, rcond=None)
    fit_t = X @ beta
    res = tair - fit_t
    sigma_syn = float(np.std(res))

    # [lat, lon, a0, a1, b1, a2, b2, ad, bd, solar_mean, wind_mean, ea_mean, cl_mean, sigma_syn]
    entry = [
        lat,
        lon,
        round(float(beta[0]), 2),
        round(float(beta[1]), 2),
        round(float(beta[2]), 2),
        round(float(beta[3]), 2),
        round(float(beta[4]), 2),
        round(float(beta[5]), 2),
        round(float(beta[6]), 2),
        round(float(np.mean(solar)), 1),
        round(float(np.mean(wind)), 2),
        round(float(np.mean(ea)), 2),
        round(float(np.mean(cl)), 2),
        round(sigma_syn, 2)
    ]
    return entry

def main():
    print("=== Building Global Land Climatology Harmonic Grid ===")
    lats = list(range(-55, 76, 5))
    lons = list(range(-180, 180, 5))

    target_points = [(lon, lat) for lat in lats for lon in lons if is_land(lat, lon)]
    print(f"Total land points to process (5° resolution): {len(target_points)}")

    results = []
    completed = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(extract_and_fit_point, pt): pt for pt in target_points}
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            completed += 1
            if res is not None:
                results.append(res)
            if completed % 100 == 0 or completed == len(target_points):
                print(f"  Processed {completed}/{len(target_points)} points ({len(results)} valid)...")

    # Sort results by lat, then lon
    results.sort(key=lambda x: (x[0], x[1]))

    payload = {
        "description": "Global Planetary Climatology Harmonic Grid (5x5 deg land grid derived from NOAA GDAS1 / FLake IGB Berlin archive)",
        "resolutionDeg": 5.0,
        "variables": [
            "lat", "lon",
            "a0", "a1", "b1", "a2", "b2", "ad", "bd",
            "solar_mean", "wind_mean", "ea_mean", "cl_mean", "sigma_syn"
        ],
        "count": len(results),
        "grid": results
    }

    for p in OUTPUT_PATHS:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            json.dump(payload, f, separators=(',', ':'))
        print(f"Saved: {p} ({os.path.getsize(p) / 1024:.1f} KB)")

    print("=== Global Climatology Harmonic Grid built successfully! ===")

if __name__ == "__main__":
    main()
