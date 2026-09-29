import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  loadCore,
  loadWork,
  loadRolling,
  loadInsights,
  number,
  money,
  formatWorkDescription,
  percent,
  month,
  signed,
  tierKey,
  exclusions,
  headline,
  downloadCSV,
  type Data,
  type Zip,
  type Work,
  type Rolling,
  type Quarter,
  type Mix,
} from "./data";
import {
  RankChart,
  PairChart,
  ShareBars,
  QuarterlyChart,
  MixChart,
  TrendChart,
  Table,
} from "./Charts";

const CityMap = lazy(() => import("./CityMap"));
type Page = "story" | "explore" | "compare" | "insights" | "methodology";
const pages: Page[] = [
  "story",
  "explore",
  "compare",
  "insights",
  "methodology",
];
const pageLabel = (p: Page) =>
  ({
    story: "The story",
    explore: "Explore",
    compare: "Compare",
    insights: "Insights",
    methodology: "Methodology",
  })[p];
const initialPage = (): Page =>
  pages.includes(location.hash.slice(1).split("?")[0] as Page)
    ? (location.hash.slice(1).split("?")[0] as Page)
    : "story";

function Icon({
  name,
  size = 20,
}: {
  name: "city" | "arrow" | "download" | "sun" | "moon" | "search";
  size?: number;
}) {
  const paths = {
    city: (
      <>
        <path d="M3 21V9h6V3h6v10h6v8M1 21h22M6 12v2m0 3v1M12 6v2m0 3v2m6 3v2" />
      </>
    ),
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    download: <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />,
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" />
      </>
    ),
    moon: <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z" />,
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 6 6" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
function Button({
  children,
  onClick,
  secondary = false,
}: {
  children: ReactNode;
  onClick: () => void;
  secondary?: boolean;
}) {
  return (
    <button
      className={secondary ? "button secondary" : "button"}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function MapLoading() {
  return (
    <div className="map-placeholder" role="status">
      Loading the map…
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState<Page>(initialPage);
  const [selected, setSelected] = useState(
    new URLSearchParams(location.hash.split("?")[1]).get("zip") || "75216",
  );
  const [compare, setCompare] = useState<[string, string]>(["75216", "75249"]);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("dallas-theme") || "system";
    } catch {
      return "system";
    }
  });
  const [osDark, setOsDark] = useState(
    matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const dark = theme === "system" ? osDark : theme === "dark";
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    let alive = true;
    loadCore()
      .then((d) => {
        if (alive) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [attempt]);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setOsDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem("dallas-theme", theme);
    } catch {
      /* Private browsing can disable storage. */
    }
  }, [dark, theme]);
  useEffect(() => {
    const update = () => {
      setPage(initialPage());
      const zip = new URLSearchParams(location.hash.split("?")[1]).get("zip");
      if (zip) setSelected(zip);
      main.current?.focus({ preventScroll: true });
    };
    addEventListener("hashchange", update);
    return () => removeEventListener("hashchange", update);
  }, []);
  function navigate(next: Page, zip?: string) {
    if (zip) setSelected(zip);
    location.hash = `${next}${next === "explore" ? `?zip=${zip || selected}` : ""}`;
    setPage(next);
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => main.current?.focus({ preventScroll: true }));
  }
  function openZip(zip: string) {
    if (page === "explore") {
      setSelected(zip);
      history.pushState(null, "", `#explore?zip=${zip}`);
    } else navigate("explore", zip);
    if (matchMedia("(max-width: 800px)").matches)
      requestAnimationFrame(() =>
        document.querySelector(".zip-card")?.scrollIntoView({ block: "start" }),
      );
  }
  function compareZip(zip: string) {
    setCompare([zip, zip === "75249" ? "75216" : "75249"]);
    navigate("compare");
  }
  if (!data)
    return (
      <main className="load-page">
        <div className="brand-mark">
          <Icon name="city" size={28} />
        </div>
        <h1>Dallas Permit Intelligence</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <Button
              onClick={() => {
                setError("");
                setAttempt(attempt + 1);
              }}
            >
              Try again
            </Button>
          </>
        ) : (
          <p role="status">Loading the verified study data…</p>
        )}
      </main>
    );
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          main.current?.focus({ preventScroll: true });
        }}
      >
        Skip to main content
      </a>
      <header className="site-header">
        <div className="header-main">
          <a
            className="brand"
            href="#story"
            onClick={(e) => {
              e.preventDefault();
              navigate("story");
            }}
          >
            <span className="brand-mark">
              <Icon name="city" size={24} />
            </span>
            <span>
              Dallas<span className="brand-sub">PERMIT INTELLIGENCE</span>
            </span>
          </a>
          <nav aria-label="Main navigation">
            {pages.map((p) => (
              <a
                key={p}
                href={`#${p}`}
                aria-label={pageLabel(p)}
                aria-current={page === p ? "page" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(p);
                }}
              >
                {p === "methodology" ? (
                  <>
                    <span className="nav-full">Methodology</span>
                    <span className="nav-short">Methods</span>
                  </>
                ) : (
                  pageLabel(p)
                )}
              </a>
            ))}
          </nav>
          <button
            className="theme-button"
            aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
            onClick={() => setTheme(dark ? "light" : "dark")}
          >
            <Icon name={dark ? "sun" : "moon"} />
          </button>
        </div>
        <div className="source-strip">
          <span>
            <i />
            Data: {month(data.meta.data_start)} – {month(data.meta.data_end)}
            <span className="historical">Historical study</span>
          </span>
          <span title={data.meta.source}>
            City of Dallas + US Census{" "}
            <a
              href="#methodology"
              onClick={(e) => {
                e.preventDefault();
                navigate("methodology");
              }}
              aria-label="Read data sources and methodology"
            >
              ↗
            </a>
          </span>
        </div>
      </header>
      <main id="main-content" ref={main} tabIndex={-1}>
        {page === "story" && (
          <Story data={data} dark={dark} explore={() => navigate("explore")} />
        )}
        {page === "explore" && (
          <Explore
            data={data}
            dark={dark}
            selected={selected}
            onSelect={openZip}
            onCompare={compareZip}
          />
        )}
        {page === "compare" && (
          <Compare
            data={data}
            selected={compare}
            onChange={setCompare}
            onSelect={openZip}
          />
        )}
        {page === "insights" && <Insights data={data} onSelect={openZip} />}
        {page === "methodology" && <Methodology data={data} />}
      </main>
      <footer>
        <span>Public data. A closer look at Dallas.</span>
        <span>
          An independent portfolio study by Isha · Not an official City of
          Dallas service
        </span>
      </footer>
    </>
  );
}

function Story({
  data,
  dark,
  explore,
}: {
  data: Data;
  dark: boolean;
  explore: () => void;
}) {
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const k = data.kpi;
  const pair = data.pairs.find((p) => p.pair_rank === 1)!;
  const z = data.zips.find((z) => z.zip_code === k.story_zip)!;
  const other = data.zips.find((z) => z.zip_code === k.story_compare_zip)!;
  const stepLabels = [
    "The concentration",
    "The contrast",
    "The housing story",
    "What’s behind it",
  ];
  const next = (i: number) => {
    setStep(i);
    requestAnimationFrame(() => heading.current?.focus());
  };
  return (
    <div className="story-page">
      <div className="story-top">
        <span className="eyebrow">DALLAS / A STUDY OF DEVELOPMENT</span>
        <button className="text-button" onClick={explore}>
          Skip to explore <Icon name="arrow" size={16} />
        </button>
      </div>
      <section
        className={`story-grid step-${step}`}
        aria-label={`Story step ${step + 1} of 4`}
      >
        <div className="story-copy">
          <div className="chapter">
            <span>0{step + 1}</span> / 04 <i />
            {stepLabels[step]}
          </div>
          {step === 0 && (
            <>
              <h1 ref={heading} tabIndex={-1}>
                A few permits.
                <br />
                <em>Most of the value.</em>
              </h1>
              <p className="story-deck">
                Where Dallas builds—and where the money goes.
              </p>
              <div
                className="concentration-stat"
                aria-label={`${percent(k.big_project_share_of_permits)} of permits account for ${percent(k.big_project_share_of_value)} of declared value`}
              >
                <div>
                  <strong>{percent(k.big_project_share_of_permits)}</strong>
                  <span>of all permits</span>
                </div>
                <span className="stat-connector" aria-hidden="true">
                  <Icon name="arrow" size={32} />
                </span>
                <div>
                  <strong>{percent(k.big_project_share_of_value)}</strong>
                  <span>of declared value</span>
                </div>
              </div>
              <p className="story-body">
                Permits valued at $1 million or more account for most of the
                city’s declared construction value. Explore where that activity
                concentrates, and how the picture changes for housing.
              </p>
              <Button onClick={() => next(1)}>
                Follow the money <Icon name="arrow" />
              </Button>
              <p className="reading-time">
                4 short chapters · Then explore every ZIP
              </p>
            </>
          )}
          {step === 1 && (
            <>
              <h1 ref={heading} tabIndex={-1}>
                Same activity.
                <br />
                <em>Different money.</em>
              </h1>
              <p className="story-deck">
                A permit count doesn’t tell the whole story.
              </p>
              <div className="hero-stat">
                <strong>{number(pair.value_ratio)}×</strong>
                <span>
                  the declared value,
                  <br />
                  with similar permit counts.
                </span>
              </div>
              <p className="story-body">
                ZIP {pair.high_investment_zip} has{" "}
                {number(pair.high_investment_big_projects)} projects valued at
                $1 million or more. ZIP {pair.mostly_maintenance_zip} has just{" "}
                {number(pair.mostly_maintenance_big_projects)}. The scale of the
                work matters.
              </p>
              <Button onClick={() => next(2)}>
                Look beyond total dollars <Icon name="arrow" />
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <h1 ref={heading} tabIndex={-1}>
                Housing tells
                <br />
                <em>another story.</em>
              </h1>
              <p className="story-deck">
                Is investment in homes going only where the income is?
              </p>
              <div className="hero-stat">
                <strong>+{k.income_housing_rank_correlation.toFixed(2)}</strong>
                <span>
                  income-to-housing
                  <br />
                  rank correlation.
                </span>
              </div>
              <p className="story-body">
                Across {k.neighborhood_count} neighborhoods, income and housing
                investment are moderately related. But places like {k.story_zip}{" "}
                rise above their income rank.
              </p>
              <p className="small-note">
                Housing dollars per resident measures residential work.
                Hospitals and warehouses are excluded.
              </p>
              <Button onClick={() => next(3)}>
                Meet the exception <Icon name="arrow" />
              </Button>
            </>
          )}
          {step === 3 && (
            <>
              <h1 ref={heading} tabIndex={-1}>
                New homes.
                <br />
                <em>A different path.</em>
              </h1>
              <p className="story-deck">
                ZIP {k.story_zip}, the lowest-income neighborhood, out-invests{" "}
                {k.story_zip_wealthier_outranked} wealthier neighborhoods.
              </p>
              <div className="hero-stat">
                <strong>{number(k.story_zip_new_sfd_permits)}</strong>
                <span>
                  permits to build new
                  <br />
                  single-family homes.
                </span>
              </div>
              <p className="story-body">
                With median household income of{" "}
                {money(z.median_household_income, true)}, {k.story_zip} records{" "}
                {money(z.housing_value_per_resident, true)} in housing value per
                resident. In {k.story_compare_zip}, it’s{" "}
                {money(other.housing_value_per_resident, true)}.
              </p>
              <div className="guardrail">
                <strong>Beats expectations, not the city.</strong>
                <p>
                  {money(z.housing_value_per_resident, true)} per resident is still
                  below the city median of{" "}
                  {money(k.median_housing_value_per_resident, true)}.
                </p>
              </div>
              <Button onClick={explore}>
                Explore the city <Icon name="arrow" />
              </Button>
            </>
          )}
        </div>
        <div className="story-visual">
          {step === 0 ? (
            <div className="opening-map-card">
              <div className="opening-map-heading">
                <span className="eyebrow">THE GEOGRAPHY OF INVESTMENT</span>
                <h2>A concentrated pattern.</h2>
                <p>High-investment ZIPs stand out in dark blue.</p>
              </div>
              <Suspense fallback={<MapLoading />}>
                <CityMap zips={data.zips} dark={dark} hero />
              </Suspense>
              <div className="map-insight">
                <div>
                  <strong>{k.high_investment_zip_count}</strong>
                  <span>high-investment ZIPs</span>
                </div>
                <div>
                  <strong>{percent(k.high_investment_share_of_value)}</strong>
                  <span>of declared value</span>
                </div>
              </div>
            </div>
          ) : step === 1 ? (
            <>
              <PairChart pair={pair} />
              <div className="editorial-note">
                <span className="eyebrow">A BETTER LENS</span>
                <p>
                  Big projects per 1,000 permits distinguish development
                  intensity from activity alone.
                </p>
              </div>
            </>
          ) : step === 2 ? (
            <>
              <RankChart zips={data.zips} />
              <div className="editorial-note">
                <span className="eyebrow">READ THE GAP</span>
                <p>
                  Above the diagonal, housing investment ranks higher than
                  neighborhood income. Below it, housing ranks lower.
                </p>
              </div>
            </>
          ) : (
            <>
              <ShareBars
                top={k.new_construction_share_top5}
                bottom={k.new_construction_share_bottom5}
              />
              <div className="story-comparison">
                {[z, other].map((zip) => (
                  <div key={zip.zip_code}>
                    <span>ZIP {zip.zip_code}</span>
                    <strong>{money(zip.housing_value_per_resident, true)}</strong>
                    <p>housing value / resident</p>
                    <span>
                      {percent(zip.new_construction_share_of_housing)} from new
                      construction
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
      <div className="story-bottom">
        <div className="step-navigation" aria-label="Story chapters">
          {stepLabels.map((label, i) => (
            <button
              key={label}
              aria-label={`Chapter ${i + 1}: ${label}`}
              aria-current={i === step ? "step" : undefined}
              onClick={() => next(i)}
            >
              <span>0{i + 1}</span>
              <i />
              <span className="step-label">{label}</span>
            </button>
          ))}
        </div>

      </div>
      {step === 0 && <div className="study-totals">
        <div>
          <strong>{number(k.total_permits)}</strong>
          <span>building permits</span>
        </div>
        <div>
          <strong>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(k.total_value)}</strong>
          <span>declared permit value</span>
        </div>
        <div>
          <strong>{k.mapped_zip_count}</strong>
          <span>ZIPs in the development study</span>
        </div>
        <div>
          <strong>{k.neighborhood_count}</strong>
          <span>neighborhoods compared</span>
        </div>
      </div>}
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}

function Explore({
  data,
  dark,
  selected,
  onSelect,
  onCompare,
}: {
  data: Data;
  dark: boolean;
  selected: string;
  onSelect: (zip: string) => void;
  onCompare: (zip: string) => void;
}) {
  const [mode, setMode] = useState<"tier" | "housing">("tier");
  const [query, setQuery] = useState("");
  const [searchError, setSearchError] = useState("");
  const [list, setList] = useState(false);
  const z = data.zips.find((z) => z.zip_code === selected);
  const shortfalls = data.zips
    .filter((z) => z.beats_income_by != null)
    .sort((a, b) => a.beats_income_by! - b.beats_income_by!)
    .slice(0, 5);
  return (
    <div className="content-page">
      <PageHeading
        eyebrow="THE CITY, ZIP BY ZIP"
        title="Follow your questions."
        description="Explore development intensity, then look at investment in the places people call home."
      >
        <button
          className="button secondary"
          onClick={() => downloadCSV(data.zips)}
        >
          <Icon name="download" size={18} />
          Download ZIP CSV
        </button>
      </PageHeading>
      <div className="explore-toolbar">
        <div className="segmented" aria-label="Map measure">
          <button
            aria-pressed={mode === "tier"}
            onClick={() => setMode("tier")}
          >
            Development tier
          </button>
          <button
            aria-pressed={mode === "housing"}
            onClick={() => setMode("housing")}
          >
            Housing vs income
          </button>
        </div>
        <form
          className="zip-search"
          onSubmit={(e) => {
            e.preventDefault();
            const match = data.zips.find((z) => z.zip_code === query.trim());
            if (match) {
              onSelect(match.zip_code);
              setSearchError("");
            } else
              setSearchError("Enter a ZIP in this dataset, such as 75216.");
          }}
        >
          <label htmlFor="zip-search" className="sr-only">
            Search ZIP code
          </label>
          <Icon name="search" size={18} />
          <input
            id="zip-search"
            inputMode="numeric"
            pattern="[0-9]{5}"
            required
            maxLength={5}
            placeholder="Search a ZIP code"
            list="zip-options"
            value={query}
            aria-describedby={searchError ? "search-error" : undefined}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchError("");
            }}
          />
          <datalist id="zip-options">
            {data.zips.map((z) => (
              <option key={z.zip_code} value={z.zip_code} />
            ))}
          </datalist>
          <button type="submit">
            Go <span aria-hidden="true">→</span>
          </button>
        </form>
      </div>
      {searchError && (
        <p className="error" id="search-error" role="alert">
          {searchError}
        </p>
      )}
      <div className="explore-layout">
        <section className="explore-map">
          <div className="map-topline">
            <span>
              {mode === "tier"
                ? `${data.kpi.mapped_zip_count} ZIPs · $1M+ projects per 1,000 permits`
                : `${data.kpi.neighborhood_count} neighborhoods · income rank − housing rank`}
            </span>
            <button
              className="text-button"
              aria-pressed={list}
              onClick={() => setList(!list)}
            >
              {list ? "Map view" : "ZIP list"}
            </button>
          </div>
          {list ? (
            <div className="zip-list">
              <Table
                caption="All ZIPs — study period"
                headers={["ZIP", "Development tier", "Housing rank gap"]}
                rows={data.zips.map((z) => [
                  <button
                    className="text-button"
                    onClick={() => onSelect(z.zip_code)}
                  >
                    {z.zip_code} →
                  </button>,
                  z.is_in_dallas && z.has_enough_permits
                    ? z.development_tier
                    : "Not compared",
                  signed(z.beats_income_by),
                ])}
              />
            </div>
          ) : (
            <Suspense fallback={<MapLoading />}>
              <CityMap
                zips={data.zips}
                selected={selected}
                onSelect={onSelect}
                mode={mode}
                dark={dark}
              />
            </Suspense>
          )}
          <p className="map-help">
            Select a ZIP on the map, search above, or use the ZIP list. Gray
            areas fall outside this comparison.
          </p>
        </section>
        <aside aria-label="Selected ZIP details">
          {z ? (
            <ZipCard z={z} data={data} onCompare={onCompare} />
          ) : (
            <div className="zip-card">
              <h2>ZIP not found</h2>
              <p>Choose a ZIP from the search or list.</p>
            </div>
          )}
        </aside>
      </div>
      <section className="closer-look">
        <div>
          <span className="eyebrow">A STARTING POINT FOR PLANNERS</span>
          <h2>Needs a closer look</h2>
          <p>
            The five neighborhoods where housing investment falls furthest below
            income rank. A prompt for investigation, not a verdict.
          </p>
        </div>
        <div className="shortfall-list">
          {shortfalls.map((zip) => (
            <button
              key={zip.zip_code}
              onClick={() => onSelect(zip.zip_code)}
              className={selected === zip.zip_code ? "selected" : ""}
            >
              <span>
                ZIP <strong>{zip.zip_code}</strong>
              </span>
              <span>
                {Math.abs(zip.beats_income_by!)} places lower{" "}
                <span aria-hidden="true">↗</span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function ZipCard({
  z,
  data,
  onCompare,
}: {
  z: Zip;
  data: Data;
  onCompare: (zip: string) => void;
}) {
  const [work, setWork] = useState<Work[] | null>(null);
  const [rolling, setRolling] = useState<Rolling[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setError("");
    Promise.all([loadWork(), loadRolling()])
      .then(([w, r]) => {
        if (alive) {
          setWork(w);
          setRolling(r);
        }
      })
      .catch(() => {
        if (alive) setError("Work details and trends could not load.");
      });
    return () => {
      alive = false;
    };
  }, [attempt]);
  const reasons = exclusions(z);
  const rows =
    rolling
      ?.filter((r) => r.zip_code === z.zip_code)
      .sort((a, b) => a.as_of_date.localeCompare(b.as_of_date)) || [];
  const recentChange = rows
    .slice(-3)
    .filter((r) => r.tier_changed)
    .at(-1);
  const items =
    work
      ?.filter((w) => w.zip_code === z.zip_code)
      .sort((a, b) => a.rank_in_zip - b.rank_in_zip) || [];
  return (
    <article className="zip-card">
      <div className="zip-card-title">
        <div>
          <span className="eyebrow">NEIGHBORHOOD PROFILE</span>
          <h2>ZIP {z.zip_code}</h2>
        </div>
        <span className={`tier-badge ${tierKey(z.development_tier)}`}>
          <i />
          {z.is_in_dallas && z.has_enough_permits
            ? z.development_tier
            : "Not tiered"}
        </span>
      </div>
      <p className="zip-headline" aria-live="polite">
        {headline(z)}
      </p>
      {reasons.length > 0 && (
        <div className="exclusion">
          <strong>Why this ZIP is not compared</strong>
          <ul>
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="profile-metrics">
        <Metric
          label="Housing value / resident"
          value={money(z.housing_value_per_resident, true)}
        />
        <Metric
          label="Median household income"
          value={money(z.median_household_income, true)}
        />
        <Metric
          label="Income rank"
          value={
            z.income_rank == null
              ? "Not compared"
              : `${z.income_rank} of ${data.kpi.neighborhood_count}`
          }
        />
        <Metric
          label="Housing investment rank"
          value={
            z.housing_rank == null
              ? "Not compared"
              : `${z.housing_rank} of ${data.kpi.neighborhood_count}`
          }
        />
      </div>
      {z.zip_code === data.kpi.story_zip && (
        <div className="guardrail compact">
          <strong>Beats expectations, not the city.</strong>
          <p>
            Below the city median of{" "}
            {money(data.kpi.median_housing_value_per_resident, true)} per resident.
          </p>
        </div>
      )}
      <dl className="metric-rows">
        <div>
          <dt>Building permits</dt>
          <dd>{number(z.permit_count)}</dd>
        </div>
        <div>
          <dt>Total declared value</dt>
          <dd title={money(z.total_value)}>{money(z.total_value, true)}</dd>
        </div>
        <div>
          <dt>Projects of $1M+</dt>
          <dd>{number(z.big_project_count)}</dd>
        </div>
        <div>
          <dt>$1M+ projects / 1,000 permits</dt>
          <dd>{z.big_projects_per_1000}</dd>
        </div>
        <div>
          <dt>New construction / housing dollars</dt>
          <dd>{percent(z.new_construction_share_of_housing)}</dd>
        </div>
      </dl>
      <p className="small-note">
        Full study: {month(data.meta.data_start)} – {month(data.meta.data_end)}.
        Ranks: 1 = highest.
      </p>
      <Button secondary onClick={() => onCompare(z.zip_code)}>
        Compare this ZIP <Icon name="arrow" size={16} />
      </Button>
      <details className="profile-details" open>
        <summary>Top kinds of housing work</summary>
        {!work && !error && <p role="status">Loading housing work…</p>}
        {work && !items.length && (
          <p>No residential work is recorded for this ZIP.</p>
        )}
        <ol className="work-list">
          {items.map((w) => (
            <li key={w.rank_in_zip}>
              <span title={w.work_description}>
                {formatWorkDescription(w.work_description)}
                <small>
                  {number(w.permit_count)}{" "}
                  {w.permit_count === 1 ? "permit" : "permits"}
                </small>
              </span>
              <strong className={w.total_value === 0 ? "no-value" : undefined} title={w.total_value === 0 ? "No value declared" : money(w.total_value)}>
                {w.total_value === 0 ? "No value declared" : money(w.total_value, true)}
              </strong>
            </li>
          ))}
        </ol>
      </details>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            className="text-button"
            onClick={() => setAttempt(attempt + 1)}
          >
            Retry details
          </button>
        </div>
      )}
      {rolling && (
        <details className="profile-details" open>
          <summary>Last-12-months trend</summary>
          {rows.length ? (
            <>
              <TrendChart rows={rows} />
              <p className="small-note">
                {recentChange
                  ? `Tier changed in ${month(recentChange.as_of_date)}: ${recentChange.previous_tier} → ${recentChange.development_tier}.`
                  : "No tier change in the latest three available windows."}
              </p>
            </>
          ) : (
            <p>No rolling windows available for this ZIP.</p>
          )}
        </details>
      )}
    </article>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Compare({
  data,
  selected,
  onChange,
  onSelect,
}: {
  data: Data;
  selected: [string, string];
  onChange: (value: [string, string]) => void;
  onSelect: (zip: string) => void;
}) {
  const a = data.zips.find((z) => z.zip_code === selected[0])!;
  const b = data.zips.find((z) => z.zip_code === selected[1])!;
  const metrics: [string, (z: Zip) => string][] = [
    [
      "Development tier",
      (z) =>
        z.is_in_dallas && z.has_enough_permits
          ? z.development_tier
          : "Not tiered",
    ],
    ["Building permits", (z) => number(z.permit_count)],
    ["Total declared value", (z) => money(z.total_value)],
    ["$1M+ projects", (z) => number(z.big_project_count)],
    ["$1M+ projects / 1,000 permits", (z) => String(z.big_projects_per_1000)],
    ["Housing value / resident", (z) => money(z.housing_value_per_resident)],
    ["Median household income", (z) => money(z.median_household_income)],
    [
      "Income rank (1 = highest)",
      (z) =>
        z.income_rank == null
          ? "Not compared"
          : `${z.income_rank} of ${data.kpi.neighborhood_count}`,
    ],
    [
      "Housing rank (1 = highest)",
      (z) =>
        z.housing_rank == null
          ? "Not compared"
          : `${z.housing_rank} of ${data.kpi.neighborhood_count}`,
    ],
    ["Housing vs income rank gap", (z) => signed(z.beats_income_by)],
    [
      "New construction / housing dollars",
      (z) => percent(z.new_construction_share_of_housing),
    ],
    ["Residents (ACS estimate)", (z) => number(z.population)],
  ];
  return (
    <div className="content-page compare-page">
      <PageHeading
        eyebrow="TWO PLACES. ONE LENS."
        title="Put neighborhoods in perspective."
        description="Compare the same measures across two ZIPs. All values below cover the full study period."
      />
      <div className="compare-selectors">
        {[a, b].map((z, i) => (
          <div key={i}>
            <label htmlFor={`compare-${i}`}>
              Neighborhood {i === 0 ? "A" : "B"}
            </label>
            <select
              id={`compare-${i}`}
              value={z.zip_code}
              onChange={(e) =>
                onChange(
                  i === 0
                    ? [e.target.value, selected[1]]
                    : [selected[0], e.target.value],
                )
              }
            >
              {data.zips.map((zip) => (
                <option key={zip.zip_code} value={zip.zip_code}>
                  ZIP {zip.zip_code}
                </option>
              ))}
            </select>
            <p>{headline(z)}</p>
            {exclusions(z).map((reason) => (
              <p className="small-note" key={reason}>
                {reason}
              </p>
            ))}
            <button
              className="text-button"
              onClick={() => onSelect(z.zip_code)}
            >
              Open full profile <Icon name="arrow" size={16} />
            </button>
          </div>
        ))}
      </div>
      {a.zip_code === b.zip_code && (
        <p className="notice">
          You’re comparing the same ZIP. Choose another to see a difference.
        </p>
      )}
      <Table
        caption={`ZIP ${a.zip_code} and ZIP ${b.zip_code} · full study period`}
        headers={["Measure", a.zip_code, b.zip_code]}
        rows={metrics.map(([label, get]) => [label, get(a), get(b)])}
      />
      <div className="editorial-note">
        <span className="eyebrow">KEEP THE CONTEXT</span>
        <p>
          Rank gaps describe relative positions among{" "}
          {data.kpi.neighborhood_count} neighborhoods. They do not establish
          fairness, explain causes, or measure displacement.
        </p>
      </div>
    </div>
  );
}

function Insights({
  data,
  onSelect,
}: {
  data: Data;
  onSelect: (zip: string) => void;
}) {
  const [extra, setExtra] = useState<{
    quarters: Quarter[];
    mix: Mix[];
  } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [pairRank, setPairRank] = useState(1);
  useEffect(() => {
    let alive = true;
    loadInsights()
      .then((d) => {
        if (alive) {
          setExtra(d);
          setError("");
        }
      })
      .catch(() => {
        if (alive) setError("Supporting charts could not load.");
      });
    return () => {
      alive = false;
    };
  }, [attempt]);
  return (
    <div className="content-page">
      <PageHeading
        eyebrow="THE PATTERNS BEHIND THE MAP"
        title="A few signals worth following."
        description="Look across neighborhoods, across types of work, and across the study’s quarters."
      />
      <div className="insights-grid">
        <div className="wide">
          <RankChart zips={data.zips} onSelect={onSelect} />
        </div>
        {extra ? (
          <>
            <QuarterlyChart rows={extra.quarters} />
            <MixChart rows={extra.mix} />
          </>
        ) : error ? (
          <div role="alert">
            <p>{error}</p>
            <button onClick={() => setAttempt(attempt + 1)}>Retry</button>
          </div>
        ) : (
          <p role="status">Loading supporting charts…</p>
        )}
        <section>
          <label className="pair-label" htmlFor="pair-select">
            Compare similar activity
          </label>
          <select
            id="pair-select"
            value={pairRank}
            onChange={(e) => setPairRank(Number(e.target.value))}
          >
            {data.pairs.map((p) => (
              <option key={p.pair_rank} value={p.pair_rank}>
                {p.high_investment_zip} vs {p.mostly_maintenance_zip} ·{" "}
                {number(p.value_ratio)}× value
              </option>
            ))}
          </select>
          <PairChart pair={data.pairs.find((p) => p.pair_rank === pairRank)!} />
        </section>
        <ShareBars
          top={data.kpi.new_construction_share_top5}
          bottom={data.kpi.new_construction_share_bottom5}
        />
      </div>
    </div>
  );
}

function Methodology({ data }: { data: Data }) {
  return (
    <div className="content-page methodology-page">
      <PageHeading
        eyebrow="NUMBERS YOU CAN EXPLAIN"
        title="What this study can tell us."
        description="Clear definitions, deliberate boundaries, and a few important limits."
      />
      <div className="method-layout">
        <aside
          onClick={(e) => {
            const link = (e.target as HTMLElement).closest("a");
            if (link) {
              e.preventDefault();
              const target = document.getElementById(link.hash.slice(1));
              target?.scrollIntoView();
              target?.setAttribute("tabindex", "-1");
              target?.focus({ preventScroll: true });
            }
          }}
        >
          <span className="eyebrow">IN THIS NOTE</span>
          <a href="#definitions">The measures</a>
          <a href="#coverage">Which ZIPs count</a>
          <a href="#limitations">What to keep in mind</a>
          <a href="#sources">Sources & download</a>
        </aside>
        <div className="method-prose">
          <section id="definitions">
            <h2>The measures</h2>
            <h3>Development intensity, not just volume</h3>
            <p>
              A ZIP’s tier is its count of projects valued at $1 million or more
              per 1,000 permits. The categories are{" "}
              <strong>High investment</strong> (30 or more),{" "}
              <strong>Moderate investment</strong> (10 to less than 30), and{" "}
              <strong>Mostly maintenance</strong> (less than 10).
            </p>
            <h3>Investment in where people live</h3>
            <p>
              Housing value includes residential land uses only. Dividing by the
              population puts neighborhoods of different sizes on a comparable
              basis. Permit values are declared valuations, not final costs.
            </p>
            <h3>Reading the ranks</h3>
            <p>
              Rank 1 is highest. “Housing vs income” is income rank minus
              housing-investment-per-resident rank. A positive gap means housing
              ranks higher than income; a negative gap means it ranks lower.
              This is a descriptive comparison, not a prediction model or a
              causal claim.
            </p>
            <h3>Two time frames, kept separate</h3>
            <p>
              The story, maps, and comparisons cover{" "}
              {month(data.meta.data_start)} through {month(data.meta.data_end)}.
              Trend points each cover the last 12 months ending on that date.
              Their smaller values should not be compared directly with
              full-study totals.
            </p>
          </section>
          <section id="coverage">
            <h2>Which ZIPs count</h2>
            <p>
              The development map compares {data.kpi.mapped_zip_count} ZIPs
              where at least 90% of the population is inside Dallas and there
              are at least 100 permits. The housing comparison further requires
              at least 10,000 residents, leaving {data.kpi.neighborhood_count}{" "}
              neighborhoods.
            </p>
            <p>
              The cutoffs sit at natural gaps: no ZIP falls between 72% and 94%
              inside Dallas, and no Dallas ZIP falls between 8,673 and 14,308
              residents. ZIPs outside a comparison remain visible in gray, with
              the reason in their profile.
            </p>
          </section>
          <section id="limitations">
            <h2>What to keep in mind</h2>
            <ul>
              <li>
                This is a historical study. The source stopped updating in
                August 2020; it does not describe current Dallas conditions.
              </li>
              <li>
                Census ZIP Code Tabulation Areas (ZCTAs) approximate USPS ZIP
                codes.
              </li>
              <li>
                Income and population are ACS 2019 five-year estimates. The
                share inside Dallas comes from 2010.
              </li>
              <li>
                About 4% of permits have no valid ZIP and are excluded from
                ZIP-level views.
              </li>
              <li>
                A permit is an authorization, not proof that work was completed.
                Dollars do not measure housing affordability, access, or
                displacement.
              </li>
              <li>The last quarter is partial: July and August 2020.</li>
            </ul>
            <div className="guardrail">
              <strong>75216 beats expectations, not the city.</strong>
              <p>
                Its housing value per resident remains below the city median. A
                strong relative rank does not mean investment needs are met.
              </p>
            </div>
          </section>
          <section id="sources">
            <h2>Sources & download</h2>
            <p>{data.meta.source}</p>
            <ul>
              <li>
                <a
                  href="https://www.dallasopendata.com/resource/e7gq-4sah.json"
                  target="_blank"
                  rel="noreferrer"
                >
                  City of Dallas Building Permits — Socrata e7gq-4sah ↗
                </a>
              </li>
              <li>
                <a
                  href="https://www.census.gov/programs-surveys/acs"
                  target="_blank"
                  rel="noreferrer"
                >
                  US Census American Community Survey ↗
                </a>
              </li>
              <li>
                <a
                  href="https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  US Census geographic boundaries ↗
                </a>
              </li>
            </ul>
            <p>
              Data exported{" "}
              {new Date(data.meta.exported_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
              })}
              . An export date is not a new permit-data date.
            </p>
            <button
              className="button secondary"
              onClick={() => downloadCSV(data.zips)}
            >
              <Icon name="download" size={18} />
              Download all {data.zips.length} ZIP records
            </button>
            <p className="small-note">
              CSV contains the verified fields, including eligibility flags and
              unrounded values. Dashboard figures are formatted for readability.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
