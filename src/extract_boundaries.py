"""
Extract ZIP (ZCTA) boundary shapes for the map, as GeoJSON.

Source: Census TIGERweb map service, layer 2 of the ACS2019 service --
"2010 Census ZIP Code Tabulation Areas". Same ZCTA vintage as the ACS 2019
estimates and the 2010 ZIP-to-city relationship file used elsewhere, so the
shapes line up with the numbers.

Fetching only the ZIPs in the permit data keeps this to about a megabyte,
instead of the several hundred megabytes of the national shapefile.

Run: python src/extract_boundaries.py
"""
import csv
import json
from pathlib import Path

import requests

TIGERWEB = ("https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/"
            "tigerWMS_ACS2019/MapServer/2/query")
PERMITS_CSV = Path("data/raw/building_permits_raw.csv")
OUT_PATH = Path("data/raw/zip_boundaries.geojson")

BATCH = 25
PRECISION = 5  # ~1 m; the source's extra digits are noise at city scale


def zips_in_permit_data():
    zips = set()
    with open(PERMITS_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            z = (row.get("zip_code") or "").strip()
            if len(z) == 5 and z.startswith("75") and z.isdigit():
                zips.add(z)
    return sorted(zips)


def round_coords(node):
    """Shrink the file by dropping sub-metre coordinate precision."""
    if isinstance(node, list):
        if node and isinstance(node[0], (int, float)):
            return [round(v, PRECISION) for v in node]
        return [round_coords(n) for n in node]
    return node


def fetch(zips):
    quoted = ",".join(f"'{z}'" for z in zips)
    params = {
        "where": f"ZCTA5 IN ({quoted})",
        "outFields": "ZCTA5",
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "geojson",
    }
    resp = requests.get(TIGERWEB, params=params, timeout=180)
    resp.raise_for_status()
    payload = resp.json()
    if "features" not in payload:
        raise SystemExit(f"Unexpected response from TIGERweb: {str(payload)[:300]}")
    return payload["features"]


def main():
    wanted = zips_in_permit_data()
    print(f"ZIPs to fetch: {len(wanted)}")

    features = []
    for i in range(0, len(wanted), BATCH):
        batch = wanted[i:i + BATCH]
        got = fetch(batch)
        print(f"  batch {i // BATCH + 1}: asked {len(batch)}, got {len(got)}")
        features.extend(got)

    for f in features:
        f["geometry"]["coordinates"] = round_coords(f["geometry"]["coordinates"])
        f["properties"] = {"zip_code": f["properties"]["ZCTA5"]}

    features.sort(key=lambda f: f["properties"]["zip_code"])
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        json.dumps({"type": "FeatureCollection", "features": features}), encoding="utf-8"
    )

    missing = set(wanted) - {f["properties"]["zip_code"] for f in features}
    print(f"Wrote {len(features)} boundaries to {OUT_PATH} "
          f"({OUT_PATH.stat().st_size / 1024:.0f} KB)")
    if missing:
        print(f"No boundary returned for: {sorted(missing)}")


if __name__ == "__main__":
    main()
