# Dallas Permit Intelligence — Product & Architecture Spec

*Living document. Last updated 2026-09-27.*

## 1. Why this exists

Permit data shows **where money is spent** in Dallas. On its own it can't say whether that
investment is **fair**. Joining permits to Census population and income turns
"$500M in ZIP X" into "housing dollars per resident, compared with what that
neighborhood's income would predict."

**The question:** *Where is Dallas being built, and is housing investment reaching
lower-income neighborhoods?*

**Built as if deployed at the City of Dallas Planning & Development (PDV):** the
product has to handle a permit feed that keeps changing, not a one-off download.

## 2. User

**Primary: a PDV planner / analyst.** Their job: *where is development going, where
isn't it, and which neighborhoods need a closer look?* They work in weekly and
monthly cycles, need numbers they can defend in a meeting, and need to explain those
numbers to non-technical leadership.

## 3. The story (current numbers, Jan 2018 – Aug 2020)

**Act 1: money is concentrated**
- 2,399 permits of $1M+ = 1.9% of permits but 66% of all value.
- 43 mapped ZIPs: 10 Built up, 12 Mixed, 21 Patched up. Built-up ZIPs hold 49% of value.
- Built-up ZIPs got most $1M+ projects in 10 of 11 quarters.
- Same activity, different money: 75226 vs 75254, ~1,000 permits each, $460M vs $18M (25×).
- Work mix: new construction is 8% of permits in Patched up vs 18% in Built up.

**Act 2: housing tells a different story**
- Income vs housing-investment-per-resident rank correlation: +0.48 (36 neighborhoods).
- Beat their income the most: 75212 (+20), 75237, 75203, 75215, 75216.
  Fall short the most: 75249 (−24), 75254, 75233, 75248, 75238.
- Why: new construction is 88% of housing $ in the top 5 vs 25% in the bottom 5.
- 75216, the lowest-income neighborhood, out-invests 13 wealthier ones (404 new
  single-family homes). It beats expectations, but at $1,113 per resident it is still
  below the city median of $2,140.

Reference calculation: `src/check_numbers.py`. The dbt marts reproduce every number exactly.

## 4. Product experience: story + explore

**Part 1: guided intro (3–4 screens, skippable)**
1. *Where Dallas builds.* 2% of permits = 66% of the money; the map highlights built-up ZIPs.
2. *Same activity, different money.* The side-by-side pair.
3. *Housing tells a different story.* The income vs housing chart, with 75216 highlighted.
4. *Why.* The new-construction share, then "Explore the city →".

**Part 2: explore**
- A map colored by tier, with a toggle for "beats income by".
- A ZIP card on click: plain-language sentences, key numbers, top 5 kinds of housing work.
- Compare two ZIPs side by side.
- Planner tools: a "Needs a closer look" list, a methodology note, CSV download.

**Live-data features** (a frozen dashboard can't do these):
- A "Data as of <date>" stamp everywhere, and a visible warning if the feed is stale.
- **Movement:** ZIPs that changed tier since the last period.
- **What's new:** $1M+ projects since the last refresh.
- **Trend:** whether a neighborhood's gap against its income is closing or widening.

## 5. Architecture

```
Permit source ─► scheduled incremental load ─► Snowflake RAW
                                                   │
                                   dbt build (incremental models + tests)
                                                   │
                                        MARTS (time-windowed)
                                                   │
                     API (FastAPI, read-only Snowflake user, short cache,
                          falls back to last good copy if Snowflake is down)
                                                   │
                                  Web app (story + explore, map)
```

| Layer | Choice | Why |
|---|---|---|
| Source | Socrata `e7gq-4sah` (frozen 2020); in the city, the DallasNow / permitting-system export | Only the extract step changes when the source changes |
| Load | Incremental: only rows new or changed since the last run, with a `loaded_at` timestamp | A live feed can't be reloaded from scratch every time |
| Transform | dbt: incremental models on `permit_number`, source freshness checks, tests | Tests gate publishing, so bad data never reaches planners |
| Metrics | Rolling time windows ending at the as-of date | "All time" grows forever and hides current trends |
| Orchestration | Scheduled GitHub Action (or Snowflake Task): load → dbt build → tests | Hands-off refresh |
| Serving | FastAPI + read-only Snowflake user + cache + fallback copy | No credentials in the browser; Snowflake doesn't wake on every visit; the link never breaks |
| Front end | Custom web app with an interactive map | Product feel, public link |

### Replay: proving it with frozen data
The source stopped updating in Aug 2020. To demonstrate the live design, a replay
script feeds the historical permits in **one month at a time**, as if each month just
arrived. Each step runs the full incremental pipeline, and the product updates on its
own: the as-of date moves, tiers shift, new $1M+ projects appear.

## 6. Build order

1. ✅ RAW → STAGING → MARTS in dbt, reconciled with `check_numbers.py`
2. ⬜ Time-windowed marts (tiers, ranks and KPIs per rolling window + an as-of date)
3. ⬜ Simulated feed + replay script + incremental dbt models + freshness checks
4. ⬜ Orchestration (scheduled GitHub Action)
5. ⬜ API (read-only user, cache, fallback)
6. ⬜ Front end: explore mode first, then the guided intro
7. ⬜ README, methodology page, `dbt docs` lineage screenshot

## 7. Open decisions

| # | Decision | Default until decided |
|---|---|---|
| 1 | Window length: rolling 12 or 24 months? | 12 months |
| 2 | Cutoffs (≥100 permits, tier edges 10/30) were set on 32 months of data. Keep them fixed, or re-derive them for the window? | Re-check them against the 12-month data before deciding |
| 3 | Tier names for a city audience ("Patched up" may read as dismissive) | Keep current names for now |
| 4 | Snowflake account: trial or paid? A trial ending would take the live API offline (the fallback copy covers it) | Check Admin → Billing |
| 5 | Hosting: API on Render, Fly or Railway; front end on GitHub Pages or Vercel | Decide at step 5 |
| 6 | Automation login: key-pair auth for a service user instead of a password | Key-pair |
| 7 | Job posting: does it name Power BI or Tableau? | Unknown; paste the posting |
