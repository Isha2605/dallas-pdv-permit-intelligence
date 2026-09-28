# Brief for Codex: build the Dallas Permit Intelligence dashboard

You are building the **front end** of a finished data project. The data pipeline,
the metrics and the numbers are done and verified. **Your job is the product:** a
polished, public web app that tells one clear story and then lets a city planner
explore it. Design quality matters as much as correctness here.

Read `docs/PRODUCT_SPEC.md` too. It has the full background. This brief is what
you need to build.

---

## 1. Context

- **Who is building this:** Isha, applying for a **Data Science Analyst II role at the
  City of Dallas Planning & Development Department (PDV)**. This is a portfolio project.
  Hiring managers will open the public link.
- **Who the product is for:** a **PDV planner / analyst.** Their question: *"Where is
  development going, where isn't it, and which neighborhoods need a closer look?"* They
  need numbers they can defend in a meeting and explain to non-technical leadership.
- **The data:** only public City of Dallas and US Census data.
  - 126,840 building permits, Jan 2018 – Aug 2020 (the source dataset stopped updating then).
  - Census population, median household income, and the share of each ZIP inside Dallas city limits.
  - ZIP boundary shapes.
- **Feel:** a **product**, not a dashboard. Calm, civic, trustworthy, modern. It
  should feel like a well-designed tool (think Linear or Stripe restraint, or a
  high-quality NYT / The Pudding interactive), not a grid of BI charts.

## 2. What's already done. Don't change it.

```
Socrata API → CSV → Snowflake RAW → dbt STAGING → dbt MARTS → export → dashboard/data/*.json
```

- `dallas_permits_dbt/`: dbt project. All metrics are computed here and tested (46 tests pass).
- `src/check_numbers.py`: independent pandas reference calculation. The dbt marts match it exactly.
- `src/export_dashboard_data.py`: exports the marts to `dashboard/data/*.json`.
  Re-running it needs Snowflake credentials. **You don't need to run it; the JSON files are already there.**
- `docs/PRODUCT_SPEC.md`: product and architecture spec.

**Hard rule: the front end displays numbers; it never re-derives metrics.** Tiers, ranks,
`beats_income_by`, shares and the story numbers all come from the JSON. Simple formatting
and filtering is fine. Recomputing a metric in JavaScript is not, because it could drift
from the verified value.

Don't modify anything outside `dashboard/` unless asked. (Adding a GitHub Actions workflow
for deployment is OK; see §8.)

## 3. The story (the numbers you'll display)

**Act 1: money is concentrated**
- **2,399 permits of $1M or more = 1.9% of permits but 66% of all $11.12B in value.**
- ZIPs are grouped into three **development tiers** by how many $1M+ projects they get
  per 1,000 permits:
  - **High investment** (≥ 30): 10 ZIPs
  - **Moderate investment** (≥ 10): 12 ZIPs
  - **Mostly maintenance** (< 10): 21 ZIPs
- The 10 high-investment ZIPs hold **49%** of the value.
- High-investment ZIPs got the majority of $1M+ projects in **10 of 11 quarters**.
- **Same activity, different money:** 75226 vs 75254 had ~1,000 permits each, but
  **$460M vs $18M (25×)**, and 116 vs 2 big projects.
- **Work mix:** new construction is 8% of permits in mostly-maintenance ZIPs vs 18% in
  high-investment ZIPs.

**Act 2: housing tells a different story (the centerpiece)**
- Question: *is housing investment going only where the income is?* Measured as
  **housing value per resident** (residential permits only; hospitals and warehouses
  aren't investment in where people live), compared across **36 neighborhoods**.
- Income rank vs housing-investment rank correlation: **+0.48**. Richer areas get more,
  but only moderately, and there are striking exceptions.
- **`beats_income_by` = income rank − housing rank.** Positive means more housing
  investment than the neighborhood's income would predict.
  - Beat their income the most: **75212 (+20), 75237 (+19), 75203 (+18), 75215 (+15), 75216 (+13)**
  - Fall short the most: **75249 (−24), 75254 (−19), 75233 (−15), 75248 (−15), 75238 (−11)**
- **Why:** new construction is **88%** of housing dollars in the top 5 vs **25%** in the bottom 5.
- **The human story, 75216:** the lowest-income neighborhood ($27,288 median household
  income) out-invests **13 wealthier neighborhoods**, driven by **404 permits to build new
  single-family homes**. Compared with 75249 ($64,246 income): **$1,113 vs $270** housing
  value per resident, and new construction is 74% vs 30% of housing dollars.
- **Honesty guardrail (must appear in the copy):** 75216 *beats expectations, not the
  city*. At $1,113 per resident it's still below the city median of $2,140.

## 4. The product experience

### Part 1: guided intro (3–4 screens, skippable, a "Skip to explore" link always visible)
1. **Where Dallas builds.** Hero: "2% of permits drive 66% of the money." The map
   highlights the high-investment ZIPs.
2. **Same activity, different money.** The 75226 vs 75254 side-by-side.
3. **Housing tells a different story.** The income vs housing chart, with the top/bottom
   neighborhoods and 75216 highlighted.
4. **Why.** New construction 88% vs 25%, the 75216 story with its guardrail line, then
   the button **"Explore the city →"**.

Scroll-driven (scrollytelling) or stepped cards, your call. It must work on mobile and
with a keyboard. Honor `prefers-reduced-motion`.

### Part 2: explore mode (the core tool)
- **Map of Dallas ZIPs.**
  - Color by **development tier** (default), with a toggle to **"Housing vs income"**
    (`beats_income_by`, diverging).
  - ZIPs not in the comparison are neutral gray, and their card says why (see §6).
- **ZIP card** on click or search (type a ZIP):
  - A plain-language headline built from the data, e.g. *"75216 gets more housing
    investment than 13 wealthier neighborhoods."*
  - Key numbers: permits, total value, $1M+ projects, tier, housing $/resident, median
    income, income rank vs housing rank.
  - **Top 5 kinds of housing work** (from `top_housing_work.json`).
  - **Last-12-months trend:** a small sparkline of the tier, or housing $/resident over
    the rolling windows (from `zip_rolling.json`), with a note if the tier changed recently.
- **Compare:** pick two ZIPs and see them side by side, same metrics and aligned rows.
- **Planner tools:**
  - **"Needs a closer look":** the neighborhoods that fall short of their income the most.
  - **Methodology panel:** definitions, cutoffs and why, data sources and caveats (§6).
  - **Download CSV** of the ZIP table.
- **Header everywhere:** a "Data: Jan 2018 – Aug 2020" stamp (from `meta.json`), and the
  source credit.

### Supporting charts (in the intro and/or an "Insights" section)
- **Quarterly line:** high-investment share of $1M+ projects per quarter
  (`quarterly.json`), with a 50% reference line.
- **Work mix by tier:** 100% stacked bars, one per tier (`work_mix.json`).
- **Income vs housing:** the centerpiece. Suggested form: **income rank (x) vs housing
  rank (y)** for the 36 neighborhoods, with a diagonal "expected" line. Distance from the
  diagonal is `beats_income_by`. Label only the highlighted ZIPs (top/bottom 5 + 75216);
  everything else goes in the tooltip.
- **Pairs:** the top side-by-side pairs (`pairs.json`), shown as paired bars.

## 5. Data contract: `dashboard/data/*.json`

All money is in USD; all shares are 0–1 fractions (format as %). Dates are ISO strings.

| File | Rows | Use |
|---|---|---|
| `kpi_summary.json` | object | Every headline number |
| `zips.json` | 71 | One row per ZIP (study period). Map, ZIP card, compare, table |
| `zip_boundaries.json` | GeoJSON, 71 features | Map shapes; join on `properties.zip_code` |
| `top_housing_work.json` | 285 | Top 5 housing work types per ZIP |
| `quarterly.json` | 11 | Quarterly line |
| `work_mix.json` | 9 | Work mix by tier |
| `pairs.json` | 17 | Side-by-side pairs |
| `kpi_rolling.json` | 21 | Headline numbers per trailing-12-month window (month ends Dec 2018 → Aug 2020) |
| `zip_rolling.json` | 1,425 | Per ZIP per trailing-12-month window. Sparklines, tier movement |
| `meta.json` | object | Data date range, export time, source line |

**Fields**

- `kpi_summary`:
  - Totals and dates: `total_permits`, `total_value`, `first_issued_date`, `last_issued_date`
  - $1M+ projects: `big_project_count`, `big_project_share_of_permits`, `big_project_share_of_value`
  - Tiers: `mapped_zip_count`, `high_investment_zip_count`, `moderate_investment_zip_count`, `mostly_maintenance_zip_count`, `high_investment_share_of_value`
  - Neighborhoods: `neighborhood_count`, `neighborhood_housing_value`, `income_housing_rank_correlation`, `median_housing_value_per_resident`
  - New-construction shares: `new_construction_share_all`, `new_construction_share_top5`, `new_construction_share_bottom5`
  - Story: `story_zip` ("75216"), `story_zip_wealthier_outranked` (13), `story_compare_zip` ("75249"), `story_zip_new_sfd_permits` (404)
- `zips`:
  - Permits: `zip_code`, `permit_count`, `total_value`, `big_project_count`, `big_projects_per_1000`, `development_tier`
  - Housing: `residential_value`, `residential_new_construction_value`, `new_construction_share_of_housing`
  - Work mix: `new_construction_count`, `alteration_count`, `other_stage_count`
  - Census: `population`, `median_household_income`, `pct_in_dallas`
  - Equity: `housing_value_per_resident`, `is_in_dallas`, `has_enough_permits`, `is_neighborhood`, `income_rank`, `housing_rank`, `beats_income_by`
- `top_housing_work`: `zip_code`, `rank_in_zip` (1–5), `work_description` (uppercase raw text; title-case it for display), `permit_count`, `total_value`
- `quarterly`: `quarter_start`, `quarter_label` ("Q1 2018"), `big_project_count`, `high_investment_big_project_count`, `high_investment_share`
- `work_mix`: `development_tier`, `work_stage` ("New construction" | "Alterations" | "Other"), `permit_count`, `share_of_tier_permits`
- `pairs`: `pair_rank`, `high_investment_zip`, `mostly_maintenance_zip`, `*_permits`, `*_value`, `*_big_projects`, `value_ratio`
- `kpi_rolling`: `as_of_date`, `window_start`, `is_latest`, the same KPI fields as `kpi_summary` for that window, plus `permits_this_month`, `new_big_projects_this_month`, `zips_changed_tier`
- `zip_rolling`: `as_of_date`, `zip_code`, `development_tier`, `previous_tier`, `tier_changed`, `permit_count`, `total_value`, `big_project_count`, `housing_value_per_resident`, `beats_income_by`

**Which ZIPs are in which view (use the flags; don't invent rules):**
- **Mapped / tiered** (43 ZIPs): `is_in_dallas && has_enough_permits`. Color these by tier.
- **Neighborhoods** (36 ZIPs): the rows where `income_rank != null`. Only these have
  ranks and `beats_income_by`.
- **Gray (not compared):** on the tier map, the 28 unmapped ZIPs; on the "Housing vs
  income" map, the 35 ZIPs without ranks. Each card gives the reason.
  - `!is_in_dallas`: "Mostly outside Dallas city limits (X% inside)"
  - `!has_enough_permits`: "Fewer than 100 permits, too few to judge"
  - `!is_neighborhood`: "Fewer than 10,000 residents, not compared as a neighborhood"

**Rolling vs study period:** the story and the map use the **study period** (`zips.json`,
`kpi_summary.json`). Rolling files cover only a trailing 12 months, so their values are
smaller (e.g. median housing $/resident is ~$700–$900 per 12 months vs $2,140 over the full
32 months). Always label rolling views "last 12 months" and never mix the two in one number.

## 6. Copy and methodology (plain language, planner-grade)

- Write for a planner briefing a director: short, specific, no jargon. Every number gets
  context ("of all permits", "per resident", "out of 36 neighborhoods").
- Generate ZIP sentences from data templates, e.g.
  - `beats_income_by > 0`: "{zip} gets more housing investment than its income would predict: {n} places higher."
  - `beats_income_by < 0`: "{zip} gets less housing investment than its income would predict: {n} places lower."
- The tier names are deliberate and neutral. **Use exactly: High investment / Moderate
  investment / Mostly maintenance.** Never "poor", "blighted", etc.
- **The methodology panel must state:**
  - Tier = $1M+ projects per 1,000 permits; the cutoffs are 10 and 30.
  - A ZIP is mapped if ≥ 90% of its population is inside Dallas and it has ≥ 100 permits;
    it's a neighborhood if it has ≥ 10,000 residents. Each cutoff sits at a natural gap in
    the data (no ZIP falls between 72% and 94% inside Dallas; no Dallas ZIP falls between
    8,673 and 14,308 residents).
  - Housing value = residential land uses only.
  - Ranks: 1 = highest.
  - Caveats:
    - Census ZIPs (ZCTAs) approximate USPS ZIPs.
    - Income and population are ACS 2019 5-year estimates; city share is from 2010.
    - ~4% of permits have no valid ZIP and are excluded from ZIP views.
    - Permit value is the declared valuation, not the final cost.
    - The data ends in Aug 2020.

## 7. Design direction

- Restrained and product-grade:
  - generous whitespace, one accent color, a strong type hierarchy
  - system UI sans (`system-ui, -apple-system, "Segoe UI", sans-serif`) or one well-chosen web font
  - one hero number per view
- **Light and dark mode** (follow the OS; a toggle is nice to have). Dark mode uses its own
  validated colors (below), not an automatic invert.
- **Responsive:** it must work well on a phone. The map and card stack vertically; no
  horizontal page scroll.
- **Accessibility:**
  - keyboard navigable
  - visible focus
  - never color alone: tier names appear as text on the card and legend
  - chart tooltips plus a **table view** for every chart
  - `prefers-reduced-motion` respected
  - WCAG AA text contrast
- **Chart craft:**
  - thin marks: bars ≤ 24px with a 4px rounded end, 2px lines, dots ≥ 8px with a 2px surface ring
  - hairline, recessive gridlines
  - label selectively (never a number on every mark)
  - one y-axis only
  - hover tooltips on every chart
  - text is never drawn in the series color

**Validated colors** (checked for colorblind safety and contrast; please use these):

| Role | Light | Dark |
|---|---|---|
| Surface | `#fcfcfb` | `#1a1a19` |
| Page | `#f9f9f7` | `#0d0d0d` |
| Text primary / secondary / muted | `#0b0b0b` / `#52514e` / `#898781` | `#ffffff` / `#c3c2b7` / `#898781` |
| Gridline / axis | `#e1e0d9` / `#c3c2b7` | `#2c2c2a` / `#383835` |
| **Tiers** (ordinal, one hue): Mostly maintenance → Moderate → High investment | `#86b6ef` → `#2a78d6` → `#104281` | `#184f95` → `#3987e5` → `#9ec5f4` |
| Not compared (neutral) | `#e1e0d9` | `#2c2c2a` |
| **Diverging** (`beats_income_by`): falls short ← neutral → beats | red `#e34948` ← `#f0efec` → blue `#2a78d6` | red `#e66767` ← `#383835` → blue `#3987e5` |
| **Categorical** (work stage: New construction / Alterations / Other) | `#2a78d6` / `#eb6834` / `#1baf7a` | `#3987e5` / `#d95926` / `#199e70` |
| Highlight (selected ZIP, 75216) | orange `#eb6834` | `#d95926` |

The light aqua `#1baf7a` is under 3:1 contrast on the surface, so any chart using it
needs visible labels or the table view. Keep the categorical colors in this order.

## 8. Technical requirements

- **Everything lives in `dashboard/`.** It's a static site; no server or backend.
- **It never talks to Snowflake.** No credentials anywhere; it only reads `dashboard/data/*.json`.
- **Stack: your choice.** Pick what gives the best result, e.g. Vite + React (or Svelte),
  with MapLibre GL or Leaflet for the map and D3 or a light chart library.
  - Basemap: a **free, no-API-key** source (e.g. OpenFreeMap or Carto basemaps) with proper attribution.
  - If you need a build step, document it.
- **Deploy target: GitHub Pages** at `https://isha2605.github.io/dallas-pdv-permit-intelligence/`.
  - Asset and data paths must work under that subpath (e.g. Vite `base`).
  - Add a GitHub Actions workflow that builds and deploys on push to `main`, and explain
    the one-time repo setting (Settings → Pages → Source: GitHub Actions).
- **Swappable data layer:** load the data through one small module (e.g. `data.js`) so it
  can later point at a live API with the same JSON shapes without touching the UI.
- **Performance:** first load under ~2 MB; the map is interactive in under 2 seconds on a
  normal connection.
- **Code quality:**
  - readable, componentized, commented where the *why* isn't obvious
  - a `dashboard/README.md` explaining how to run it locally, build it, and refresh the
    data (`python src/export_dashboard_data.py`)

## 9. Acceptance checks

- [ ] Every number shown matches the JSON exactly (spot-check the §3 numbers).
- [ ] The intro tells Act 1 → Act 2 → Why, and ends in explore mode. Skip works.
- [ ] Clicking a mapped ZIP, typing a ZIP, and choosing one from "Needs a closer look" all open its card.
- [ ] Gray ZIPs explain why they aren't compared.
- [ ] Compare shows two ZIPs side by side.
- [ ] The 75216 guardrail line ("beats expectations, not the city") appears.
- [ ] Methodology panel and CSV download work.
- [ ] Light and dark mode both look intentional; mobile (375px) has no horizontal scroll.
- [ ] Keyboard-only use works; charts have tooltips and a table view.
- [ ] `npm run build` (or equivalent) succeeds, and the site works under the GitHub Pages subpath.

## 10. Working with Isha

- Isha is learning and will be asked about this project in interviews.
  - Before you build, **propose the design (layout, stack, key screens) and wait for a go-ahead.**
  - Explain decisions in plain language as you go.
- Git:
  - Commit in logical steps with clear messages.
  - The repo-local git identity is already set to Isha. **Don't change git config, and don't push without asking.**
- If a number in the JSON looks wrong, or the design needs a field that doesn't exist,
  **say so instead of computing a workaround in the browser.** New fields get added in the
  dbt marts, not in the UI.
