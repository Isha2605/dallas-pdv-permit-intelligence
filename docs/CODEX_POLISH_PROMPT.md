# Brief for Codex: polish pass on the dashboard

The dashboard you built in `dashboard/` is in good shape. Keep its overall design, tone,
typography and structure. This pass fixes specific readability and polish issues found
in review. The same rules from `docs/CODEX_PROMPT.md` still apply:

- The front end displays numbers from `dashboard/data/*.json`. It never recomputes metrics.
- Don't change anything outside `dashboard/`, and don't change the JSON files.
- Commit in logical steps (roughly one per item). Don't push, and don't change git config.
- Before you start, reply with a short plan of how you'll handle each item, and wait for a go-ahead.

Work in this order. Items 1–3 matter most.

---

## 1. Make the map readable (`src/CityMap.tsx`, `src/styles.css`)

**Problem**
- The basemap is full-color OpenStreetMap tiles with place labels, and the ZIP fills sit on
  top at `fillOpacity: 0.82`. Street labels ("Irving", "Richardson") show through the fills.
- The two lighter tier blues blur together over the busy background.
- `tile.openstreetmap.org` is also not meant for production sites.

**Fix**
- Switch to a **muted, label-free basemap** from a free, no-API-key provider meant for this
  use. For example: Carto `light_nolabels` / `dark_nolabels`, matching light and dark mode,
  with the attribution Carto requires.
  - Optionally add a labels-only layer (e.g. Carto `light_only_labels`) *above* the fills,
    so city names stay readable without being covered by the fills.
- Raise the fill opacity so tier colors read true. Aim for about 0.9 or higher; tune it by eye
  in both light and dark mode.
- Keep the 1px ZIP borders in the surface color so neighboring ZIPs separate.
- Keep the selected-ZIP orange outline.

**Done when:** in both modes, the three tiers and the gray "Not compared" ZIPs are easy to
tell apart at a glance, and no basemap text shows through a fill.

## 2. Clean up the permit work descriptions (ZIP card, "Top kinds of housing work", `src/App.tsx` ~line 1008)

**Problem**
- Raw uppercase text is title-cased, which produces "Demo Sfd", "Replace Or Modify
  Existing Hvac" and "Gas Test (atmos)".
- Some source strings are cut off mid-word in the original data, e.g. "…IN EXISTING CLOSETS TO"
  or "…WRAPPING A MULTI-L".
- 22 rows have `total_value = 0`, which currently shows as "$0".

**Fix** (add a small display helper, e.g. `formatWorkDescription()` in `src/data.ts`)
- Sentence case, not Title Case: "Replace or modify existing HVAC".
- Expand or fix the known abbreviations:
  - SFD → "single-family home" ("Construct new single-family home", "Demolish single-family home" for DEMO SFD, "Addition to single-family home")
  - MFD → "multifamily"
  - HVAC, PV, ATMOS → keep in capitals (Atmos is a gas utility: show "Atmos")
  - DEMO → "Demolish"
  - BLDG. → "building"
  - "RE-PAIR" → "Repair"
  - "MULTI  FAMILY" and "MULTI-FAMILY" → "multifamily"
- Collapse repeated spaces.
- The source cuts some descriptions off. Lengths cluster at about 64–65 and at 100
  characters, so it looks like more than one cutoff. If a string is at least 64 characters
  and ends mid-word, end it with "…" rather than showing a broken fragment. Keep the full
  original in a `title` or tooltip.
- **For `total_value === 0`, show "No value declared"** in muted text, not "$0". Keep the
  permit count.

**Don't** filter out rows that look like non-housing work (signs, parking garages). That
comes from a data rule and will be fixed in dbt, not in the UI.

## 3. Balance the Explore layout (`Explore` / `ZipCard` in `src/App.tsx`, `src/styles.css`)

**Problem:** on desktop, the map card ends early and leaves a large empty area on the left,
while the ZIP profile keeps scrolling on the right.

**Fix**
- On desktop widths, make the map column **sticky** (`position: sticky; top: <header height + gap>`)
  so the map stays in view while the profile scrolls.
- Keep the stacked layout on mobile (map above the profile, no sticky).
- Make sure the sticky map never overlaps the header and still fits short laptop screens
  (use a max height based on `vh`).

## 4. Round the display numbers (`money()` in `src/data.ts` and where it's called)

**Problem:** headline and card values read like spreadsheet output: "$460.32M", "$916.41K", "$2.38M".

**Fix**
- In prose, big numbers, bars and cards, use **3 significant figures, trailing zeros trimmed**:
  $460M, $18.5M, $916K, $2.38M, $11.1B.
  - **Exception:** keep the header total at **$11.12B**. That exact figure is quoted throughout the story.
- Keep full precision in **tooltips and table views** (e.g. $460,317,985), so nothing is lost.
- Don't change counts, ranks or percentages.

## 5. Fix the color meaning in the work-mix chart (`MixChart` in `src/Charts.tsx`)

**Problem**
- Blue means **tier** on the map and **new construction** in this chart, so the reader's
  "blue = high investment" reading carries over wrongly.
- Orange (alterations) is the loudest segment, but the story point is **new construction:
  8% vs 18%**.

**Fix**
- Give the work stages colors that don't collide with the tier blues. For example: new
  construction = orange `#eb6834` (dark `#d95926`) as the emphasized series; alterations and
  other = two neutral grays with a clear step between them. Keep a 2px surface gap between
  segments.
- **Direct-label the new-construction share** on each tier's bar (e.g. "8%", "14%", "18%"),
  placed outside the segment if it won't fit inside.
- Order segments so new construction starts at the baseline (left), where it's easiest to compare.
- The chart title/subtitle should say what to look at: *"New construction: 8% of permits in
  mostly-maintenance ZIPs vs 18% in high-investment ZIPs."*
- Keep the legend and table view.
- **If the selected-ZIP orange then clashes on the same screen,** use a different highlight
  treatment for the selected ZIP (e.g. a thick dark outline) rather than two meanings of orange.

## 6. Add a legend to the income vs housing chart (`RankChart` in `src/Charts.tsx`)

**Problem:** dots are blue above the diagonal and red below, but nothing on the chart says so.

**Fix**
- Add a two-item legend with a dot swatch per item:
  - **More housing investment than income predicts** (blue)
  - **Less than income predicts** (red)
- Plus the dashed diagonal: **"Expected if housing matched income."**
- Keep the existing direct labels for the highlighted ZIPs, and check that none collide
  (e.g. 75203 / 75237 / 75212 are close together).
- Keep 75216 as the single emphasized point.

## 7. Trim the story navigation (`Story` in `src/App.tsx`)

**Problem:** each chapter shows "Skip to explore", a primary button, a 4-step chapter bar,
"← Back", **and** the same 4-stat strip (126,840 / $11.12B / 43 / 36). It's too much chrome.

**Fix**
- Show the 4-stat strip **once**: on chapter 1, or in the final hand-off to Explore. Not on every chapter.
- Keep the chapter bar and one primary "next" button.
- Fold "← Back" into the chapter bar (clicking an earlier step), or keep it small and secondary.
- Keep "Skip to explore" visible.

## 8. Give the 12-month trend a scale (`TrendChart` in `src/Charts.tsx`)

**Problem:** the housing $/resident trend in the ZIP card has no y-axis values, so you can't
tell how big the movement is.

**Fix**
- Label the **first and last values** at the line ends (e.g. "$1,020" … "$540").
- Add 2–3 light y-axis ticks, or at least a min/max.
- Mark any month where the tier changed (a small marker with a tooltip: "Moved to Moderate investment").
- Keep the note "Each point covers the preceding 12 months."

---

## Checks before you finish

- [ ] `npm test` and `npm run build` pass. The build check still reports all 10 JSON exports unchanged.
- [ ] Light **and** dark mode checked for every changed screen.
- [ ] Mobile width (375px): no horizontal scroll; the map isn't sticky; the ZIP card is readable.
- [ ] Keyboard focus still visible; table views still work.
- [ ] Spot-check: the story still shows 2% / 66%, 25×, +0.48, 88% vs 25%, and 75216 out-invests 13 wealthier neighborhoods.
- [ ] Send screenshots of: story chapter 1, the Explore page with a ZIP selected (light and dark), and the Insights charts.
