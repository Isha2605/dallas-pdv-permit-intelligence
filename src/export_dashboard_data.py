"""
Export the dbt marts from Snowflake to small JSON files the dashboard reads.

The dashboard never connects to Snowflake: no credentials in the browser and no
warehouse cost per visitor. Re-run this after every `dbt build` to refresh it.
If the data ever goes live, this step is what gets scheduled.

Connection details come from dbt's own profiles.yml (gitignored), and the password
from the SNOWFLAKE_PASSWORD environment variable, so nothing account-specific is
committed.

Run: python src/export_dashboard_data.py
"""
import datetime as dt
import decimal
import json
import os
from pathlib import Path

import snowflake.connector
import yaml

OUT_DIR = Path("dashboard/data")
BOUNDARIES = Path("data/raw/zip_boundaries.geojson")
PROFILES = Path("dallas_permits_dbt/profiles.yml")


def connection_settings():
    """Reuse the dbt dev target so there is one place to configure Snowflake."""
    profile = yaml.safe_load(PROFILES.read_text(encoding="utf-8"))["dallas_permits_dbt"]
    target = profile["outputs"][profile["target"]]
    return dict(
        account=target["account"],
        user=target["user"],
        role=target["role"],
        warehouse=target["warehouse"],
        database=target["database"],
        schema="MARTS",
        password=os.environ["SNOWFLAKE_PASSWORD"],
    )

# file name -> query. One file per dashboard need.
EXPORTS = {
    "kpi_summary":       "select * from kpi_summary",
    "zips":              "select * from zip_development order by zip_code",
    "top_housing_work":  "select * from zip_top_housing_work order by zip_code, rank_in_zip",
    "quarterly":         "select * from tier_quarterly_big_projects order by quarter_start",
    "work_mix":          "select * from tier_work_mix order by development_tier, work_stage",
    "pairs":             "select * from zip_comparison_pairs order by pair_rank",
    "kpi_rolling":       "select * from kpi_rolling_12m order by as_of_date",
    "zip_rolling":       """select as_of_date, zip_code, development_tier, previous_tier, tier_changed,
                                   permit_count, total_value, big_project_count,
                                   housing_value_per_resident, beats_income_by
                            from zip_rolling_12m order by zip_code, as_of_date""",
}


def to_json_value(v):
    if isinstance(v, decimal.Decimal):
        return float(v)
    if isinstance(v, (dt.date, dt.datetime)):
        return v.isoformat()
    return v


def fetch(cur, sql):
    cur.execute(sql)
    cols = [c[0].lower() for c in cur.description]
    return [{c: to_json_value(v) for c, v in zip(cols, row)} for row in cur.fetchall()]


def write(name, data):
    path = OUT_DIR / f"{name}.json"
    path.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    print(f"  {path}  ({path.stat().st_size / 1024:.0f} KB)")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    conn = snowflake.connector.connect(**connection_settings())
    cur = conn.cursor()

    print("Exporting marts:")
    results = {name: fetch(cur, sql) for name, sql in EXPORTS.items()}
    for name, rows in results.items():
        write(name, rows[0] if name == "kpi_summary" else rows)

    # ZIP shapes for the map, trimmed to the ZIPs in the data.
    zips = {z["zip_code"] for z in results["zips"]}
    shapes = json.loads(BOUNDARIES.read_text(encoding="utf-8"))
    shapes["features"] = [f for f in shapes["features"] if f["properties"]["zip_code"] in zips]
    write("zip_boundaries", shapes)

    k = results["kpi_summary"][0]
    write("meta", {
        "data_start": k["first_issued_date"],
        "data_end": k["last_issued_date"],
        "exported_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "source": "City of Dallas Building Permits (Socrata e7gq-4sah); US Census ACS 2019 5-year",
    })
    conn.close()


if __name__ == "__main__":
    main()
