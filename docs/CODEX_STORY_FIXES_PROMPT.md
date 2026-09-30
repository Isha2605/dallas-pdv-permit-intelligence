# Brief for Codex: three story-accuracy fixes

A full reconciliation found **every number on the site correct**: 1,207 per-ZIP values
and all 20 story figures match an independent recompute from the raw data. A robustness
review then found three places where the **wording** claims more than the data supports,
or leaves out context a city reviewer will ask about. This pass fixes those three things.
It's copy plus one small chart addition, not a redesign.

Rules from `docs/CODEX_PROMPT.md` still apply:

- The UI displays numbers from `dashboard/data/*.json` and never recomputes metrics.
  The new numbers below are already in the data.
- Change only files under `dashboard/`. Don't edit the JSON files.
- One commit per fix. Don't push, and don't change git config.
- Reply with a short plan first, and wait for a go-ahead.

## New data (already exported; just read it)

**New fields in `kpi_summary.json`:**

| Field | Value | Meaning |
|---|---|---|
| `pair_count` | 17 | Number of matched high-investment / mostly-maintenance pairs (permit counts within 10%) |
| `pair_value_ratio_min` | 2.25 | Smallest value gap among them |
| `pair_value_ratio_median` | 6.32 | Typical value gap |
| `pair_value_ratio_max` | 24.90 | Largest: the 75226 vs 75254 headline pair |
| `holdout_high_zip_count` | 9 | ZIPs that were high-investment **using 2018 permits only** |
| `holdout_zip_count` | 43 | Mapped ZIPs they're drawn from |
| `holdout_quarter_count` | 7 | Later quarters checked (Q1 2019 – Q3 2020) |
| `holdout_high_share_min` / `_max` | 0.482 / 0.70 | Range of the share of each later quarter's $1M+ projects that went to those 9 ZIPs |

**New file `quarterly_holdout.json`** (7 rows):

- Fields: `quarter_start`, `quarter_label`, `big_project_count`, `baseline_high_big_project_count`, `baseline_high_share`, `baseline_high_zip_count`, `baseline_zip_count`
- Load it through the existing data module (`src/data.ts`, next to `quarterly`), with a TypeScript type.
- Add it to the data-contract test in `tests/data-contract.test.mjs`.
- In `tests/verify-build.mjs`, change the hard-coded "all 10 unchanged JSON exports" message to use the actual file count.

---

## Fix 1: make the "same places" claim non-circular (`QuarterlyChart` in `src/Charts.tsx`; the Insights page)

**Problem**
- The chart "Big projects keep returning to the same places" shows the share of each
  quarter's $1M+ projects that went to high-investment ZIPs.
- But those tiers were *defined* from the same $1M+ projects over the whole study, so a
  high share is partly built in. That's circular reasoning, and a careful reviewer will spot it.

**Fix: add the non-circular test to the chart and lead with it**
- Draw a second line from `quarterly_holdout.json`: **"ZIPs high-investment in 2018"**
  (`baseline_high_share`, Q1 2019 onward).
  - Make it the emphasized series.
  - Show the existing study-period line in a muted neutral as context.
  - Add a legend with both series (≥ 2 series, so a legend is required).
  - Keep a single y-axis (0–100%) and the 50% reference line.
- Rewrite the subtitle and caption so the point is the out-of-sample result. For example:
  - Subtitle: *"Share of each quarter's $1M+ projects going to the 9 ZIPs that were already
    high-investment in 2018."*
  - Caption: *"Those 9 ZIPs are about a fifth of the map, yet they drew 48–70% of $1M+
    projects in every quarter of 2019–2020. Tiers set from 2018 only, so later quarters
    are an independent check."*
- Build every number in that text from the new fields: `holdout_high_zip_count`,
  `holdout_high_share_min` / `_max`, `holdout_quarter_count`. Compute "about a fifth" as
  `holdout_high_zip_count / holdout_zip_count` formatted as a fraction or % (9/43 = 21%).
  That's formatting, not a new metric.
- The tooltip covers both lines. The table view shows both series side by side by quarter.
- Keep the title **"Big projects keep returning to the same places."** With this evidence it's now earned.

## Fix 2: put the 25× pair in context (story chapter 2 "The contrast" in `src/App.tsx` ~lines 437–465; the pair chart on Insights)

**Problem**
- 25× is the **most extreme** of 17 matched pairs, and it's presented as if it were typical.
- The typical matched pair differs by about 6×. Leaving that out looks cherry-picked.

**Fix**
- Keep 25× as the hero number. It's a true and vivid example.
- Directly under it, add one line in the same style as `story-body` / `small-note`:
  *"The widest of {pair_count} matched pairs. Across all of them, the gap runs from
  {min}× to {max}×; the typical pair differs about {median}×."*
  - With the current data that reads: "…from 2.3× to 25×; the typical pair differs about 6×."
  - Round the min to 1 decimal, and the median and max to whole numbers.
- On the Insights pair chart (the "Compare similar activity" dropdown), add the same range
  as a one-line note under the dropdown, so any pair a user picks is seen against the range.
- All values come from `kpi_summary.json`.

## Fix 3: don't frame "beats its income" as automatically good news (story chapters 3–4, ZIP card, "Needs a closer look")

**Problem**
- "Rise above their income rank", "Meet the exception" and "beats expectations" read as a
  success story.
- But more permitted housing investment than income predicts can mean new homes for current
  residents, **or** new development that changes who can afford to live there. Permit data
  can't tell which.
- The Insights page already says rank gaps don't "measure displacement". The story itself
  doesn't, and that's where a planner will ask.

**Fix (wording only)**
- **Chapter 3 "The housing story"** (~line 486): replace *"But places like {story_zip} rise
  above their income rank."* with neutral language, e.g. *"But some neighborhoods see far
  more housing investment than their income rank would predict, and others far less."*
- **Chapter 3 button:** *"Meet the exception"* → *"Look at one neighborhood"* (or similar
  neutral wording).
- **Chapter 4 "What's behind it"**: add one short, visible sentence near the 75216 story
  (not hidden in methodology):
  *"More investment than income predicts can mean new homes for current residents, or new
  development that changes a neighborhood. Permits alone can't tell which. That's a question
  for planners on the ground."*
  - Keep the existing "Beats expectations, not the city" guardrail.
- **ZIP card headline template:** keep the neutral phrasing ("ranks N places higher than its
  income rank"). Check that no template anywhere uses evaluative words like "success",
  "winning" or "better off".
- **"Needs a closer look" list:** its intro already says "A prompt for investigation, not a
  verdict". Keep it, and make the same point apply both ways: add *"Large gaps in either
  direction are worth a closer look."*
- **Methodology → "What to keep in mind":** add a bullet with the same point.
- Don't name specific neighborhoods as gentrifying or displacing. The data doesn't show
  that, and the copy must not claim it.

---

## Checks before you finish

- [ ] `npm test` and `npm run build` pass. The build check covers all 11 JSON files, unchanged.
- [ ] The quarterly chart shows both lines with a legend, a single y-axis, tooltips and a table view.
- [ ] Every number in the new copy comes from the JSON:
  - 9 ZIPs, 48–70%, 7 quarters
  - 17 pairs; 2.3× / 6× / 25×
- [ ] Nothing on the site still implies that "beating income" is good or bad in itself.
- [ ] Light and dark mode, and 375px mobile, checked on the changed screens.
- [ ] Send screenshots: story chapters 2, 3 and 4, and the Insights quarterly chart.
