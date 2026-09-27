"""
Extract ZIP-level context from the Census: population, median household
income, and what share of each ZIP's population lives inside the City of Dallas.

1) Population + income -- American Community Survey (ACS) 5-year estimates,
   2019 vintage (collected 2015-2019), centered on our permit window
   (Jan 2018 - Aug 2020). ACS 1-year estimates are not published for
   geographies as small as ZIP codes, so 5-year is the only option.
     B01003_001E -- total population
     B19013_001E -- median household income (dollars)

2) Share inside Dallas -- Census 2010 ZCTA-to-Place relationship file.
   ZIP codes cross city lines, and our permits only cover the City of Dallas
   (Census place 4819000). ZPOPPCT = % of a ZIP's population living in Dallas.
   2010 is the latest vintage of this file that reports population overlap.

Note: the Census publishes by ZCTA (ZIP Code Tabulation Area), which closely
approximates but does not exactly equal USPS ZIP codes -- standard practice.

Requires a free Census API key in a .env file at the project root:
  CENSUS_API_KEY=your_key_here

Run: python src/extract_census.py
"""
import csv
import io
import os
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

ACS_URL = "https://api.census.gov/data/2019/acs/acs5"
RELATIONSHIP_URL = "https://www2.census.gov/geo/docs/maps-data/data/rel/zcta_place_rel_10.txt"
DALLAS_STATE, DALLAS_PLACE = "48", "19000"

PERMITS_CSV = Path("data/raw/building_permits_raw.csv")
OUT_PATH = Path("data/raw/census_zips.csv")

VARIABLES = {
    "B01003_001E": "population",
    "B19013_001E": "median_household_income",
}
FIELDS = ["zip_code", "population", "median_household_income", "pct_in_dallas"]


def load_api_key():
    load_dotenv()
    key = os.getenv("CENSUS_API_KEY", "").strip()
    if not key or key == "PASTE_YOUR_KEY_HERE":
        sys.exit("No Census API key found. Put CENSUS_API_KEY=<your key> in the .env file.")
    return key


def zips_in_permit_data():
    """The ZIPs we actually care about -- the ones present in the permit data."""
    zips = set()
    with open(PERMITS_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            z = (row.get("zip_code") or "").strip()
            if len(z) == 5 and z.startswith("75") and z.isdigit():
                zips.add(z)
    return zips


def fetch_acs(api_key):
    """One request for every ZCTA nationally; we filter locally.

    Passing an explicit ZIP list fails on the 2019 endpoint ("ambiguous
    geography"), so the wildcard is the reliable form.
    """
    params = {
        "get": "NAME," + ",".join(VARIABLES),
        "for": "zip code tabulation area:*",
        "key": api_key,
    }
    resp = requests.get(ACS_URL, params=params, timeout=180)
    resp.raise_for_status()
    rows = resp.json()
    header, data = rows[0], rows[1:]
    idx = {name: i for i, name in enumerate(header)}
    out = {}
    for row in data:
        rec = {}
        for var, friendly in VARIABLES.items():
            try:
                val = int(row[idx[var]])
                # Census uses large negative sentinels for suppressed values
                rec[friendly] = "" if val < 0 else val
            except (TypeError, ValueError):
                rec[friendly] = ""
        out[row[idx["zip code tabulation area"]]] = rec
    return out


def fetch_dallas_share():
    """Map ZIP -> % of its population living in the City of Dallas.

    Also returns the set of every ZIP in the file, so a ZIP missing from the
    file entirely can be told apart from one that is genuinely 0% Dallas.
    """
    resp = requests.get(RELATIONSHIP_URL, timeout=180)
    resp.raise_for_status()
    share, all_zips = {}, set()
    for row in csv.DictReader(io.StringIO(resp.text)):
        all_zips.add(row["ZCTA5"])
        if row["STATE"] == DALLAS_STATE and row["PLACE"] == DALLAS_PLACE:
            share[row["ZCTA5"]] = float(row["ZPOPPCT"])
    return share, all_zips


def main():
    api_key = load_api_key()
    wanted = zips_in_permit_data()
    print(f"ZIPs present in permit data: {len(wanted)}")

    print("Pulling ACS 2019 5-year population + income...")
    acs = fetch_acs(api_key)
    print("Pulling Census ZIP-to-city relationship file...")
    dallas_share, rel_zips = fetch_dallas_share()

    kept = []
    for z in sorted(wanted):
        rec = {"zip_code": z, "population": "", "median_household_income": ""}
        rec.update(acs.get(z, {}))
        # In the relationship file but no Dallas row -> genuinely 0% Dallas.
        # Not in the file at all -> unknown, left blank rather than guessed.
        rec["pct_in_dallas"] = dallas_share.get(z, 0.0) if z in rel_zips else ""
        kept.append(rec)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(kept)

    no_acs = sorted(z for z in wanted if z not in acs)
    no_rel = sorted(z for z in wanted if z not in rel_zips)
    print(f"Wrote {len(kept)} ZIPs to {OUT_PATH}")
    if no_acs:
        print(f"No ACS population/income for {len(no_acs)} ZIP(s): {no_acs}")
    if no_rel:
        print(f"Not in the 2010 relationship file, Dallas share unknown: {no_rel}")


if __name__ == "__main__":
    main()
