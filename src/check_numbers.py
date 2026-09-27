"""
Reference calculation of every number shown on the dashboard.

Used to lock the numbers before building them in dbt, and afterwards to verify
the dbt models reproduce them exactly.

Run: python src/check_numbers.py
"""
import pandas as pd

PERMITS_CSV = "data/raw/building_permits_raw.csv"
CENSUS_CSV = "data/raw/census_zips.csv"

BIG = 1_000_000              # "$1M or more" -- inclusive; 185 permits are exactly $1M
MIN_PERMITS = 100            # fewer than this is too few to judge a ZIP
MIN_PCT_DALLAS = 90          # data gap: no ZIP falls between 72.2% and 94.3%
MIN_POPULATION = 10_000      # data gap: no Dallas ZIP falls between 8,673 and 14,308
TIER_EDGES = [0, 10, 30, float("inf")]
TIER_NAMES = ["Patched up", "Mixed", "Built up"]
RESIDENTIAL = "SINGLE FAMILY|MULTI-FAMILY|DUPLEX|CONDO|TOWNHOUSE|APARTMENT"


def load():
    p = pd.read_csv(PERMITS_CSV, dtype=str)
    p["value"] = pd.to_numeric(p["value"].str.replace(",", ""), errors="coerce").fillna(0)
    p["issued_date"] = pd.to_datetime(p["issued_date"], format="%m/%d/%y", errors="coerce")
    p["zip_code"] = p["zip_code"].where(p["zip_code"].str.match(r"^75\d{3}$", na=False))
    p["is_big"] = p["value"] >= BIG
    p["is_resi"] = p["land_use"].str.contains(RESIDENTIAL, case=False, na=False)
    p["stage"] = p["permit_type"].str.lower().map(
        lambda t: "New construction" if "new construction" in str(t)
        else "Alterations" if "alteration" in str(t) else "Other")
    c = pd.read_csv(CENSUS_CSV, dtype={"zip_code": str}).set_index("zip_code")
    return p, c


def zip_table(p, c):
    z = p.dropna(subset=["zip_code"]).groupby("zip_code").agg(
        permits=("value", "size"), total=("value", "sum"), big=("is_big", "sum"),
        resi_total=("value", lambda s: s[p.loc[s.index, "is_resi"]].sum()),
    ).join(c)
    z["rate"] = 1000 * z["big"] / z["permits"]
    z["tier"] = pd.cut(z["rate"], TIER_EDGES, labels=TIER_NAMES, right=False)
    z["in_dallas"] = z["pct_in_dallas"] >= MIN_PCT_DALLAS
    z["enough"] = z["permits"] >= MIN_PERMITS
    z["neighborhood"] = z["population"] >= MIN_POPULATION
    return z


def section(title):
    print(f"\n=== {title} ===")


def main():
    p, c = load()
    z = zip_table(p, c)
    mapped = z[z["in_dallas"] & z["enough"]]

    section("ZIP universe")
    print(f"ZIPs in permit data: {len(z)}")
    print(f"  with {MIN_PERMITS}+ permits: {z['enough'].sum()}")
    print(f"  ...and >= {MIN_PCT_DALLAS}% inside City of Dallas (shown on map): {len(mapped)}")
    dropped = z[z["enough"] & ~z["in_dallas"]]
    print(f"  dropped as mostly another city: "
          + ", ".join(f"{i} ({r.pct_in_dallas:.0f}%)" for i, r in dropped.sort_values("pct_in_dallas").iterrows()))

    section("Header context (all permits -- every one is a City of Dallas permit)")
    print(f"Permits: {len(p):,}   Total value: ${p['value'].sum()/1e9:.2f}B   "
          f"Dates: {p['issued_date'].min():%b %Y} - {p['issued_date'].max():%b %Y}")

    section("KPI 1 -- million-dollar projects (all permits)")
    big = p[p["is_big"]]
    print(f"{len(big):,} permits of $1M or more = {100*len(big)/len(p):.1f}% of permits, "
          f"{100*big['value'].sum()/p['value'].sum():.0f}% of all value")

    section("KPI 2 -- development tiers (mapped ZIPs)")
    counts = mapped["tier"].value_counts().reindex(TIER_NAMES)
    print("  ".join(f"{n}: {counts[n]}" for n in reversed(TIER_NAMES)))

    section("KPI 3 -- built-up ZIPs' share of value (mapped ZIPs)")
    bu = mapped[mapped["tier"] == "Built up"]
    print(f"{len(bu)} built-up ZIPs hold {100*bu['total'].sum()/mapped['total'].sum():.0f}% "
          f"of the value in mapped ZIPs")

    section("Supporting line -- built-up share of $1M+ projects by quarter")
    tier_of = mapped["tier"]
    q = p[p["is_big"] & p["zip_code"].isin(mapped.index)].copy()
    q["tier"] = q["zip_code"].map(tier_of)
    q["quarter"] = q["issued_date"].dt.to_period("Q")
    share = q.groupby("quarter")["tier"].apply(lambda s: (s == "Built up").mean())
    print(f"Built-up ZIPs got the majority of $1M+ projects in {(share > 0.5).sum()} of {len(share)} quarters "
          f"(range {100*share.min():.0f}%-{100*share.max():.0f}%)")

    section("Chart 3 -- side-by-side pair (opposite tiers, permit counts within 10%)")
    b, pu = mapped[mapped["tier"] == "Built up"], mapped[mapped["tier"] == "Patched up"]
    pairs = [(ra.total / rb.total, a, bz) for a, ra in b.iterrows() for bz, rb in pu.iterrows()
             if abs(ra.permits - rb.permits) / max(ra.permits, rb.permits) <= 0.10]
    for ratio, a, bz in sorted(pairs, reverse=True)[:3]:
        ra, rb = mapped.loc[a], mapped.loc[bz]
        print(f"  {a} vs {bz}: permits {ra.permits:,} vs {rb.permits:,} | "
              f"value ${ra.total/1e6:,.0f}M vs ${rb.total/1e6:,.0f}M ({ratio:.0f}x) | "
              f"$1M+ {ra.big} vs {rb.big}")

    section("Chart 4 -- work mix by tier (share of permits, mapped ZIPs)")
    w = p[p["zip_code"].isin(mapped.index)].copy()
    w["tier"] = w["zip_code"].map(tier_of)
    mix = pd.crosstab(w["tier"], w["stage"], normalize="index").reindex(TIER_NAMES)
    for t in TIER_NAMES:
        print(f"  {t:<11} new construction {100*mix.loc[t,'New construction']:>4.1f}%   "
              f"alterations {100*mix.loc[t,'Alterations']:>4.1f}%")

    # ---- Centerpiece: housing investment vs income -------------------------
    # Housing only: all-construction per resident was polluted by hospitals,
    # schools and commercial buildings (75241, 75235, 75231 were false positives).
    section("Centerpiece -- housing investment per resident vs income")
    e = mapped[mapped["neighborhood"]].copy()
    e["hpr"] = e["resi_total"] / e["population"]
    e["income_rank"] = e["median_household_income"].rank(ascending=False, method="min").astype(int)
    e["housing_rank"] = e["hpr"].rank(ascending=False, method="min").astype(int)
    e["beats_by"] = e["income_rank"] - e["housing_rank"]
    n = len(e)
    print(f"Neighborhoods (mapped, population >= {MIN_POPULATION:,}): {n}   "
          f"housing investment: ${e['resi_total'].sum()/1e9:.2f}B")
    print(f"Rank correlation (the chart's measure): "
          f"{e['median_household_income'].corr(e['hpr'], method='spearman'):+.2f}   "
          f"dollar correlation, for reference: {e['median_household_income'].corr(e['hpr']):+.2f}")

    over, under = e.nlargest(5, "beats_by"), e.nsmallest(5, "beats_by")
    for label, grp in [("Beat their income by the most", over), ("Fall short by the most", under)]:
        print(f"  {label}:")
        for i, r in grp.iterrows():
            print(f"    {i}  income {r.income_rank:>2}/{n}  housing {r.housing_rank:>2}/{n}  "
                  f"beats by {r.beats_by:+3}  ${r.hpr:>6,.0f}/resident")

    resi = p[p["is_resi"]]

    def new_share(zips):
        d = resi[resi["zip_code"].isin(zips)]
        return 100 * d.loc[d["stage"] == "New construction", "value"].sum() / d["value"].sum()

    print(f"KPI -- new construction share of housing $: top 5 {new_share(over.index):.0f}%  "
          f"bottom 5 {new_share(under.index):.0f}%  all {n} {new_share(e.index):.0f}%")

    poorest = e["median_household_income"].idxmin()
    pr = e.loc[poorest]
    beaten = e[(e["median_household_income"] > pr.median_household_income) & (e["hpr"] < pr.hpr)]
    print(f"KPI -- {poorest} (lowest income) outranks {len(beaten)} wealthier neighborhoods; "
          f"${pr.hpr:,.0f}/resident vs median ${e['hpr'].median():,.0f} -- beats expectations, not the city")
    new_sfd = (resi.loc[resi["zip_code"] == poorest, "work_description"]
               .str.upper().str.strip() == "CONSTRUCT NEW SFD").sum()
    print(f"      {new_sfd} permits to build new single-family homes in {poorest}")

    rich = beaten["median_household_income"].idxmax()
    rr = beaten.loc[rich]
    print(f"Side-by-side -- lowest-income ZIP vs the wealthiest ZIP it outranks: {poorest} vs {rich}")
    print(f"  income ${pr.median_household_income:,.0f} vs ${rr.median_household_income:,.0f} | "
          f"housing ${pr.hpr:,.0f} vs ${rr.hpr:,.0f}/resident | "
          f"new construction {new_share([poorest]):.0f}% vs {new_share([rich]):.0f}% of housing $")


if __name__ == "__main__":
    main()
