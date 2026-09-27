"""
Extract Dallas Building Permits data from the Socrata Open Data API (SODA).

Dataset: e7gq-4sah (City of Dallas Open Data Portal)
Docs: https://dev.socrata.com/docs/paging.html

Socrata caps a single response around 50,000 rows, so this pages through
the full dataset with $limit/$offset and writes the combined result to a
local CSV file. This raw file is the "download" step -- later it gets
uploaded (PUT) to a Snowflake stage and loaded (COPY INTO) into a table.

Run: python src/extract.py
"""
import csv

import requests

BASE_URL = "https://www.dallasopendata.com/resource/e7gq-4sah.json"
BATCH_SIZE = 50000
OUT_PATH = "data/raw/building_permits_raw.csv"

COLUMNS = [
    "permit_number", "permit_type", "issued_date", "mapsco", "contractor",
    "value", "area", "work_description", "land_use", "street_address", "zip_code",
]


def fetch_all():
    rows = []
    offset = 0
    while True:
        params = {"$limit": BATCH_SIZE, "$offset": offset, "$order": "permit_number"}
        resp = requests.get(BASE_URL, params=params, timeout=60)
        resp.raise_for_status()
        batch = resp.json()
        print(f"  fetched {len(batch)} rows at offset {offset}")
        rows.extend(batch)
        if len(batch) < BATCH_SIZE:
            break
        offset += BATCH_SIZE
    return rows


def main():
    print("Pulling from Socrata API...")
    rows = fetch_all()
    print(f"Total rows fetched: {len(rows)}")

    with open(OUT_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        writer.writeheader()
        for row in rows:
            writer.writerow({col: row.get(col, "") for col in COLUMNS})

    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
