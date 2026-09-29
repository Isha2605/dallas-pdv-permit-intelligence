import { useEffect, useState, type ReactNode } from "react";
import { scaleLinear } from "d3-scale";
import {
  money,
  number,
  percent,
  signed,
  month,
  tiers,
  type Zip,
  type Pair,
  type Quarter,
  type Mix,
  type Rolling,
} from "./data";

// Match the SVG coordinate system to its rendered width so phone labels and
// keyboard targets do not shrink to half their intended size.
function usePlotWidth(max = 600) {
  const [node, ref] = useState<SVGSVGElement | null>(null);
  const [width, setWidth] = useState(max);
  useEffect(() => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(260, Math.min(max, entry.contentRect.width))),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [max, node]);
  return { ref, width };
}

export function Table({
  headers,
  rows,
  caption,
}: {
  headers: string[];
  rows: ReactNode[][];
  caption: string;
}) {
  return (
    <div
      className="table-scroll"
      tabIndex={0}
      role="region"
      aria-label={caption}
    >
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function ChartPanel({
  title,
  subtitle,
  children,
  headers,
  rows,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  headers: string[];
  rows: ReactNode[][];
}) {
  const [table, setTable] = useState(false);
  return (
    <section className="chart-panel">
      <div className="chart-heading">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          className="text-button"
          aria-pressed={table}
          onClick={() => setTable(!table)}
        >
          {table ? "Chart view" : "Table view"}
        </button>
      </div>
      {table ? (
        <Table caption={title} headers={headers} rows={rows} />
      ) : (
        children
      )}
    </section>
  );
}

export function RankChart({
  zips,
  onSelect,
}: {
  zips: Zip[];
  onSelect?: (zip: string) => void;
}) {
  const ranked = zips.filter((z) => z.income_rank != null);
  const sorted = [...ranked].sort(
    (a, b) => b.beats_income_by! - a.beats_income_by!,
  );
  const highlighted = new Set(
    [...sorted.slice(0, 5), ...sorted.slice(-5)].map((z) => z.zip_code),
  );
  // Editorial label offsets keep the highlighted neighbors from colliding.
  // These affect annotation placement only, never ranks or dot positions.
  const labelOffsets: Record<string, [number, number]> = {
    "75212": [-12, -18],
    "75203": [-12, 16],
    "75237": [-14, 4],
    "75215": [-14, 5],
    "75216": [-14, 5],
    "75249": [-12, -8],
    "75254": [12, 5],
    "75233": [12, -10],
    "75248": [10, -12],
    "75238": [10, 7],
  };
  const [active, setActive] = useState<Zip | null>(null);
  const { ref, width } = usePlotWidth();
  const x = scaleLinear()
    .domain([1, 36])
    .range([55, width - 30]);
  const y = scaleLinear().domain([1, 36]).range([42, 342]);
  return (
    <ChartPanel
      title="Income is only part of the story"
      subtitle="Income rank × housing investment per resident rank · 1 = highest"
      headers={["ZIP", "Income rank", "Housing rank", "Rank gap"]}
      rows={ranked.map((z) => [
        z.zip_code,
        z.income_rank,
        z.housing_rank,
        signed(z.beats_income_by),
      ])}
    >
      <div className="rank-chart">
        <svg
          ref={ref}
          viewBox={`0 0 ${width} 398`}
          role="group"
          aria-label="Income versus housing rank for 36 neighborhoods. Points above the diagonal have higher housing ranks than income ranks."
        >
          {[1, 10, 20, 30, 36].map((t) => (
            <g key={t}>
              <line
                className="grid"
                x1={55}
                x2={width - 30}
                y1={y(t)}
                y2={y(t)}
              />
              <text x={42} y={y(t) + 4} textAnchor="end">
                {t}
              </text>
              <text x={x(t)} y={366} textAnchor="middle">
                {t}
              </text>
            </g>
          ))}
          <path className="reference" d={`M55 42 L${width - 30} 342`} />
          <text x={width / 2} y={385} textAnchor="middle">
            Income rank →
          </text>
          <text transform="translate(14 192) rotate(-90)" textAnchor="middle">
            Housing investment rank
          </text>
          <text x={55} y={28} className="plot-note">
            Higher housing investment
          </text>
          {ranked.map((z) => {
            const isStory = z.zip_code === "75216";
            const marked = highlighted.has(z.zip_code);
            const offset = labelOffsets[z.zip_code] ?? [10, -10];
            return (
              <g key={z.zip_code}>
                <circle
                  cx={x(z.income_rank!)}
                  cy={y(z.housing_rank!)}
                  r={isStory ? 8 : 5}
                  className={`rank-dot ${isStory ? "story-dot" : z.beats_income_by! < 0 ? "negative-dot" : "positive-dot"}`}
                  opacity={marked || active?.zip_code === z.zip_code ? 1 : 0.85}
                  tabIndex={0}
                  role={onSelect ? "button" : "img"}
                  aria-label={`${z.zip_code}: income rank ${z.income_rank}, housing rank ${z.housing_rank}, gap ${signed(z.beats_income_by)}${onSelect ? ". Open ZIP details" : ""}`}
                  onMouseEnter={() => setActive(z)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(z)}
                  onBlur={() => setActive(null)}
                  onClick={() => {
                    setActive(z);
                    onSelect?.(z.zip_code);
                  }}
                  onKeyDown={(e) => {
                    if (onSelect && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onSelect(z.zip_code);
                    }
                  }}
                >
                  <title>{`${z.zip_code} · ${money(z.housing_value_per_resident)}/resident · income ${money(z.median_household_income)}`}</title>
                </circle>
                {marked && (width >= 450 || isStory) && (
                  <text
                    className={isStory ? "story-label" : ""}
                    x={x(z.income_rank!) + offset[0]}
                    y={y(z.housing_rank!) + offset[1]}
                    textAnchor={offset[0] < 0 ? "end" : "start"}
                  >
                    {z.zip_code}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <div className="rank-legend" aria-label="Chart legend">
          <span>
            <i className="positive-key" />
            More housing investment than income predicts
          </span>
          <span>
            <i className="negative-key" />
            Less than income predicts
          </span>
          <span>
            <i className="diagonal-key" />
            Expected if housing matched income
          </span>
        </div>
        <div className="chart-tooltip" aria-live="polite">
          {active ? (
            <>
              <strong>{active.zip_code}</strong> · Income #{active.income_rank}{" "}
              · Housing #{active.housing_rank} ·{" "}
              {signed(active.beats_income_by)} places
            </>
          ) : (
            "Above the diagonal: housing ranks higher than income. Hover or focus a dot."
          )}
        </div>
      </div>
    </ChartPanel>
  );
}

export function PairChart({ pair }: { pair: Pair }) {
  const values = [pair.high_investment_value, pair.mostly_maintenance_value];
  const zips = [pair.high_investment_zip, pair.mostly_maintenance_zip];
  return (
    <ChartPanel
      title="Similar permit counts. Different scale."
      subtitle="Declared permit value · full study period"
      headers={["ZIP", "Permits", "Total value", "$1M+ projects"]}
      rows={[
        [
          zips[0],
          number(pair.high_investment_permits),
          money(values[0]),
          number(pair.high_investment_big_projects),
        ],
        [
          zips[1],
          number(pair.mostly_maintenance_permits),
          money(values[1]),
          number(pair.mostly_maintenance_big_projects),
        ],
      ]}
    >
      <div className="paired-bars">
        {values.map((v, i) => (
          <div key={zips[i]} className="paired-row">
            <div>
              <span>ZIP {zips[i]}</span>
              <strong>{money(v, true)}</strong>
            </div>
            <div className="bar-track">
              <div
                className={`bar-fill ${i ? "maintenance-fill" : "high-fill"}`}
                style={{ width: `${(v / Math.max(...values)) * 100}%` }}
                tabIndex={0}
                role="img"
                aria-label={`${zips[i]}, ${money(v)}`}
                title={`${zips[i]}: ${money(v)}`}
              />
            </div>
            <p>
              {number(
                i
                  ? pair.mostly_maintenance_permits
                  : pair.high_investment_permits,
              )}{" "}
              permits ·{" "}
              {number(
                i
                  ? pair.mostly_maintenance_big_projects
                  : pair.high_investment_big_projects,
              )}{" "}
              projects of $1M+
            </p>
          </div>
        ))}
      </div>
    </ChartPanel>
  );
}

export function ShareBars({ top, bottom }: { top: number; bottom: number }) {
  return (
    <ChartPanel
      title="What changes the picture? New homes."
      subtitle="New construction as a share of housing dollars"
      headers={["Neighborhood group", "New-construction share"]}
      rows={[
        ["Top five by rank gap", percent(top)],
        ["Bottom five by rank gap", percent(bottom)],
      ]}
    >
      <div className="paired-bars">
        {[
          ["Top five by rank gap", top],
          ["Bottom five by rank gap", bottom],
        ].map(([label, value]) => (
          <div className="paired-row" key={label}>
            <div>
              <span>{label}</span>
              <strong>{percent(value as number)}</strong>
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: percent(value as number, 5) }}
                tabIndex={0}
                role="img"
                aria-label={`${label}: ${percent(value as number)}`}
                title={`${label}: ${percent(value as number, 2)}`}
              />
            </div>
          </div>
        ))}
      </div>
    </ChartPanel>
  );
}

export function QuarterlyChart({ rows }: { rows: Quarter[] }) {
  const [active, setActive] = useState<Quarter | null>(null);
  const { ref, width } = usePlotWidth();
  const x = scaleLinear()
    .domain([0, rows.length - 1])
    .range([45, width - 35]);
  const y = scaleLinear().domain([0, 1]).range([225, 24]);
  return (
    <ChartPanel
      title="Big projects keep returning to the same places"
      subtitle="High-investment ZIPs’ share of $1M+ projects each quarter"
      headers={["Quarter", "$1M+ projects", "In high-investment ZIPs", "Share"]}
      rows={rows.map((q) => [
        q.quarter_label,
        number(q.big_project_count),
        number(q.high_investment_big_project_count),
        percent(q.high_investment_share, 1),
      ])}
    >
      <svg
        ref={ref}
        viewBox={`0 0 ${width} 270`}
        role="group"
        aria-label="Quarterly share of big projects in high-investment ZIPs"
      >
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              className={t === 0.5 ? "reference" : "grid"}
              x1={45}
              x2={width - 35}
              y1={y(t)}
              y2={y(t)}
            />
            <text x={35} y={y(t) + 4} textAnchor="end">
              {percent(t)}
            </text>
          </g>
        ))}
        <polyline
          className="series-line"
          points={rows
            .map((q, i) => `${x(i)},${y(q.high_investment_share)}`)
            .join(" ")}
        />
        {rows.map((q, i) => (
          <g key={q.quarter_label}>
            <circle
              className="rank-dot positive-dot"
              cx={x(i)}
              cy={y(q.high_investment_share)}
              r={5}
              tabIndex={0}
              role="img"
              aria-label={`${q.quarter_label}: ${percent(q.high_investment_share, 1)}`}
              onMouseEnter={() => setActive(q)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(q)}
              onBlur={() => setActive(null)}
            >
              <title>
                {q.quarter_label}: {percent(q.high_investment_share, 1)}
              </title>
            </circle>
            {(width < 450 ? i === 0 || i === rows.length - 1 : i % 2 === 0) && (
              <text x={x(i)} y={250} textAnchor="middle">
                {q.quarter_label}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="chart-tooltip" aria-live="polite">
        {active
          ? `${active.quarter_label}: ${percent(active.high_investment_share, 1)} · ${number(active.high_investment_big_project_count)} of ${number(active.big_project_count)} big projects`
          : "Dashed line: 50% of projects. Q3 2020 includes July and August only."}
      </div>
    </ChartPanel>
  );
}

export function MixChart({ rows }: { rows: Mix[] }) {
  const stages = ["New construction", "Alterations", "Other"];
  return (
    <ChartPanel
      title="New construction changes the mix"
      subtitle={`New construction: ${percent(rows.find((r) => r.development_tier === "Mostly maintenance" && r.work_stage === "New construction")?.share_of_tier_permits)} of permits in mostly-maintenance ZIPs vs ${percent(rows.find((r) => r.development_tier === "High investment" && r.work_stage === "New construction")?.share_of_tier_permits)} in high-investment ZIPs.`}
      headers={["Tier", "Work stage", "Permits", "Share"]}
      rows={rows.map((r) => [
        r.development_tier,
        r.work_stage,
        number(r.permit_count),
        percent(r.share_of_tier_permits, 1),
      ])}
    >
      <div className="mix-chart">
        {tiers.map((tier) => (
          <div key={tier}>
            <p className="mix-row-label">
              <span>{tier}</span>
              <strong>
                {percent(
                  rows.find(
                    (r) =>
                      r.development_tier === tier &&
                      r.work_stage === "New construction",
                  )?.share_of_tier_permits,
                )}{" "}
                new construction
              </strong>
            </p>
            <div className="stacked-bar">
              {stages.map((stage, i) => {
                const row = rows.find(
                  (r) => r.development_tier === tier && r.work_stage === stage,
                )!;
                return (
                  <div
                    key={stage}
                    className={`stage-${i}`}
                    style={{ width: percent(row.share_of_tier_permits, 6) }}
                    tabIndex={0}
                    role="img"
                    title={`${tier} · ${stage}: ${percent(row.share_of_tier_permits, 1)}`}
                    aria-label={`${tier} · ${stage}: ${percent(row.share_of_tier_permits, 1)}`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="legend">
        {stages.map((stage, i) => (
          <span key={stage}>
            <i className={`stage-${i}`} />
            {stage}
          </span>
        ))}
      </div>
    </ChartPanel>
  );
}

export function TrendChart({ rows }: { rows: Rolling[] }) {
  const [active, setActive] = useState<Rolling | null>(null);
  const { ref, width } = usePlotWidth(460);
  const valid = rows.filter((r) => r.housing_value_per_resident != null);
  if (!valid.length)
    return (
      <p className="muted">
        Housing-per-resident trends are unavailable for this ZIP.
      </p>
    );
  const x = scaleLinear()
    .domain([0, Math.max(rows.length - 1, 1)])
    .range([65, width - 20]);
  const y = scaleLinear()
    .domain([
      0,
      Math.max(...valid.map((r) => r.housing_value_per_resident!), 1),
    ])
    .range([145, 40]);
  // Missing windows break the line rather than implying an observed value.
  const path = rows
    .map((r, i) =>
      r.housing_value_per_resident == null
        ? ""
        : `${i === 0 || rows[i - 1].housing_value_per_resident == null ? "M" : "L"}${x(i)},${y(r.housing_value_per_resident)}`,
    )
    .join(" ");
  return (
    <ChartPanel
      title="Housing investment trend"
      subtitle="Housing $ per resident · last 12 months at each date"
      headers={[
        "Window end",
        "$ / resident",
        "Tier",
        "Tier changed",
        "Rank gap",
      ]}
      rows={rows.map((r) => [
        month(r.as_of_date),
        money(r.housing_value_per_resident),
        r.development_tier,
        r.tier_changed ? "Yes" : "No",
        signed(r.beats_income_by),
      ])}
    >
      <svg
        ref={ref}
        viewBox={`0 0 ${width} 190`}
        role="group"
        aria-label="Housing value per resident over trailing twelve-month windows"
      >
        {y.ticks(2).map((t) => (
          <g key={t}>
            <line
              className="grid"
              x1={65}
              x2={width - 20}
              y1={y(t)}
              y2={y(t)}
            />
            <text x={56} y={y(t) + 4} textAnchor="end">
              {money(t, true)}
            </text>
          </g>
        ))}
        {[valid[0], valid.at(-1)!].map((r, i) => (
          <text
            key={i}
            x={x(rows.indexOf(r))}
            y={y(r.housing_value_per_resident!) - 13}
            textAnchor={i ? "end" : "start"}
            className="trend-end-label"
          >
            {money(r.housing_value_per_resident)}
          </text>
        ))}
        {rows.map(
          (r, i) =>
            r.tier_changed && (
              <path
                key={r.as_of_date}
                className="tier-change-marker"
                d={`M${x(i)} 151 l5 7 l-5 7 l-5 -7 Z`}
                tabIndex={0}
                role="img"
                aria-label={`${month(r.as_of_date)}: Moved to ${r.development_tier}`}
              >
                <title>
                  {month(r.as_of_date)}: Moved to {r.development_tier}
                </title>
              </path>
            ),
        )}
        <path className="series-line" d={path} />
        {rows.map(
          (r, i) =>
            r.housing_value_per_resident != null && (
              <circle
                key={r.as_of_date}
                className="rank-dot positive-dot"
                cx={x(i)}
                cy={y(r.housing_value_per_resident)}
                r={4}
                tabIndex={0}
                role="img"
                aria-label={`${month(r.as_of_date)}, ${money(r.housing_value_per_resident)} per resident, ${r.development_tier}`}
                onMouseEnter={() => setActive(r)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(r)}
                onBlur={() => setActive(null)}
              >
                <title>
                  {month(r.as_of_date)}: {money(r.housing_value_per_resident)}
                  /resident
                </title>
              </circle>
            ),
        )}
        <text x={65} y={183}>
          {month(rows[0].as_of_date)}
        </text>
        <text x={width - 20} y={183} textAnchor="end">
          {month(rows.at(-1)!.as_of_date)}
        </text>
      </svg>
      <div className="chart-tooltip" aria-live="polite">
        {active
          ? `${month(active.as_of_date)}: ${money(active.housing_value_per_resident)}/resident · ${active.development_tier}`
          : "Each point covers the preceding 12 months, not the full study."}
      </div>
    </ChartPanel>
  );
}
