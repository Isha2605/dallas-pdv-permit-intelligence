# Dallas Permit Intelligence

A static, accessible story and ZIP explorer built with React, TypeScript, Vite, Leaflet, and D3 scales. The app reads the verified JSON exports in `data/`. It never connects to Snowflake or recomputes analytical metrics.

## Run locally

Use Node.js 22 or newer. From this directory:

```sh
npm ci
npm run dev
```

Open the printed URL with `/dallas-pdv-permit-intelligence/` appended. Routes use URL hashes so GitHub Pages can serve every screen, including links such as `#explore?zip=75216`.

## Validate and build

```sh
npm test
npm run build
npm run preview
```

The production site is in `dist/`. Vite's base is `/dallas-pdv-permit-intelligence/`. Data files are emitted as separate hashed assets, with map boundaries and rolling detail loaded on demand. The intro and explore map share a lazy-loaded Leaflet chunk. The only external runtime requests are the optional web font and attributed OpenStreetMap basemap tiles. ZIP boundaries and analytical data remain usable if tiles fail. Tiles follow the [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/): visible attribution, standard browser caching and referrer, and no offline/prefetch feature. This community service has no uptime guarantee; use another provider if usage grows substantially.

The build also verifies that every exported JSON file is unchanged, asset references use the Pages subpath, and first-party initial assets stay below 2 MB before compression. External map tiles and fonts are additional; the two-second network target needs measurement on the deployed site.

Browser checks covered desktop and 375px layouts, both themes, all four story chapters, map/ZIP search and exclusion reasons, comparisons, and all five insight table views. CSV serialization is tested against all 71 original ZIP records. The embedded preview browser did not expose a completed download event, so confirm the actual file save in a regular browser when publishing.

## Deploy

The repository's `.github/workflows/deploy-dashboard.yml` builds and deploys to GitHub Pages on pushes to `main` (and manual dispatch). One-time setting: **Settings → Pages → Build and deployment → Source: GitHub Actions**. The published URL is `https://isha2605.github.io/dallas-pdv-permit-intelligence/`.

## Refresh data

From the repository root, with the existing Python environment and Snowflake credentials configured:

```sh
python src/export_dashboard_data.py
```

Then rebuild and deploy. Do not put credentials in this frontend. `src/data.ts` is the single loading boundary and can later be replaced with a same-shape API. The current source ends in August 2020; a new export does not make the source current.

## Data and UX rules

- Story, map, comparison, and CSV use the full study. Trends are explicitly trailing 12 months.
- Eligibility comes from exported flags; ranks and gaps are never recalculated.
- `pct_in_dallas` is already 0–100. Other share fields are 0–1.
- Sorting/filtering chooses existing records; chart scales only position exported values.
- Null values display as unavailable or not compared, never zero.
- Light/dark palettes follow the brief. OS theme is used initially; an explicit choice is stored locally.
- Maps have search and list alternatives. Charts have keyboard-focusable marks, tooltips, and table views. No scroll-triggered animation is required.
- Supporting pages use hash navigation; study metadata remains visible on every screen.

## Structure

- `src/App.tsx`: app navigation, story, explore/profile, comparison, insights, methodology.
- `src/CityMap.tsx`: lazy map, local GeoJSON, attribution, selection, fallback.
- `src/Charts.tsx`: SVG charts and equivalent data tables.
- `src/data.ts`: contracts, loading, display formatting, export.
- `src/styles.css`: responsive layout and semantic light/dark tokens.
- `tests/`: data contract and production-path checks.

This is an independent portfolio study, not an official City of Dallas service.

### Optional muted basemap

CARTO now requires a browser API key. Copy `.env.example` to `.env.local`, set `VITE_CARTO_API_KEY`, and rebuild. The key is included in browser requests; use a key intended for this public site. Without a key, the map displays local Census ZIP boundaries. CARTO light/dark label-free tiles use OpenStreetMap and CARTO attribution. See https://carto.com/basemaps/apikey/ for current terms.
