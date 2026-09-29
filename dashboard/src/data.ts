import type { FeatureCollection } from "geojson";
import { toCSV } from "./csv";

export type Tier =
  "High investment" | "Moderate investment" | "Mostly maintenance";
export interface Zip {
  zip_code: string;
  permit_count: number;
  total_value: number;
  big_project_count: number;
  big_projects_per_1000: number;
  development_tier: Tier;
  residential_value: number;
  residential_new_construction_value: number;
  new_construction_share_of_housing: number | null;
  new_construction_count: number;
  alteration_count: number;
  other_stage_count: number;
  population: number | null;
  median_household_income: number | null;
  pct_in_dallas: number | null;
  housing_value_per_resident: number | null;
  is_in_dallas: boolean;
  has_enough_permits: boolean;
  is_neighborhood: boolean;
  income_rank: number | null;
  housing_rank: number | null;
  beats_income_by: number | null;
}
export interface KPI {
  total_permits: number;
  total_value: number;
  first_issued_date: string;
  last_issued_date: string;
  big_project_count: number;
  big_project_share_of_permits: number;
  big_project_share_of_value: number;
  mapped_zip_count: number;
  high_investment_zip_count: number;
  moderate_investment_zip_count: number;
  mostly_maintenance_zip_count: number;
  high_investment_share_of_value: number;
  neighborhood_count: number;
  neighborhood_housing_value: number;
  income_housing_rank_correlation: number;
  median_housing_value_per_resident: number;
  new_construction_share_all: number;
  new_construction_share_top5: number;
  new_construction_share_bottom5: number;
  story_zip: string;
  story_zip_wealthier_outranked: number;
  story_compare_zip: string;
  story_zip_new_sfd_permits: number;
}
export interface Pair {
  pair_rank: number;
  high_investment_zip: string;
  mostly_maintenance_zip: string;
  high_investment_permits: number;
  mostly_maintenance_permits: number;
  high_investment_value: number;
  mostly_maintenance_value: number;
  high_investment_big_projects: number;
  mostly_maintenance_big_projects: number;
  value_ratio: number;
}
export interface Work {
  zip_code: string;
  rank_in_zip: number;
  work_description: string;
  permit_count: number;
  total_value: number;
}
export interface Quarter {
  quarter_start: string;
  quarter_label: string;
  big_project_count: number;
  high_investment_big_project_count: number;
  high_investment_share: number;
}
export interface Mix {
  development_tier: Tier;
  work_stage: string;
  permit_count: number;
  share_of_tier_permits: number;
}
export interface Rolling {
  as_of_date: string;
  zip_code: string;
  development_tier: Tier;
  previous_tier: Tier | null;
  tier_changed: boolean;
  permit_count: number;
  total_value: number;
  big_project_count: number;
  housing_value_per_resident: number | null;
  beats_income_by: number | null;
}
export interface Meta {
  data_start: string;
  data_end: string;
  exported_at: string;
  source: string;
}
export interface Data {
  kpi: KPI;
  zips: Zip[];
  pairs: Pair[];
  meta: Meta;
}

const urls = import.meta.glob("../data/*.json", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>;
const cache = new Map<string, Promise<unknown>>();
// All fetching is isolated here so a future API can preserve the same contracts.
function read<T>(name: string): Promise<T> {
  if (!cache.has(name)) {
    const promise = fetch(urls[`../data/${name}.json`])
      .then((response) => {
        if (!response.ok)
          throw new Error(`Could not load ${name}. Please try again.`);
        return response.json();
      })
      .catch((error) => {
        cache.delete(name);
        throw error;
      });
    cache.set(name, promise);
  }
  return cache.get(name) as Promise<T>;
}
export async function loadCore(): Promise<Data> {
  const [kpi, zips, pairs, meta] = await Promise.all([
    read<KPI>("kpi_summary"),
    read<Zip[]>("zips"),
    read<Pair[]>("pairs"),
    read<Meta>("meta"),
  ]);
  return { kpi, zips, pairs, meta };
}
export const loadBoundaries = () => read<FeatureCollection>("zip_boundaries");
export const loadRolling = () => read<Rolling[]>("zip_rolling");
export const loadWork = () => read<Work[]>("top_housing_work");
export const loadInsights = async () => {
  const [quarters, mix] = await Promise.all([
    read<Quarter[]>("quarterly"),
    read<Mix[]>("work_mix"),
  ]);
  return { quarters, mix };
};
export const tiers: Tier[] = [
  "High investment",
  "Moderate investment",
  "Mostly maintenance",
];
export const tierKey = (tier: Tier) =>
  tier === "High investment"
    ? "high"
    : tier === "Moderate investment"
      ? "moderate"
      : "maintenance";
export const number = (n: number | null | undefined) =>
  n == null
    ? "Not available"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
export { money, formatWorkDescription } from "./format";
export const percent = (n: number | null | undefined, digits = 0) =>
  n == null
    ? "Not available"
    : new Intl.NumberFormat("en-US", {
        style: "percent",
        maximumFractionDigits: digits,
      }).format(n);
export const signed = (n: number | null) =>
  n == null ? "Not compared" : `${n > 0 ? "+" : ""}${n}`;
export const month = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
export function exclusions(z: Zip, housing = true): string[] {
  const reasons: string[] = [];
  // pct_in_dallas is exported on a 0–100 scale, unlike share fields.
  if (!z.is_in_dallas)
    reasons.push(
      `Mostly outside Dallas city limits (${z.pct_in_dallas == null ? "unknown share" : `${z.pct_in_dallas}% inside`})`,
    );
  if (!z.has_enough_permits)
    reasons.push("Fewer than 100 permits, too few to judge");
  if (housing && !z.is_neighborhood)
    reasons.push("Fewer than 10,000 residents, not compared as a neighborhood");
  return reasons;
}
export function headline(z: Zip): string {
  if (z.beats_income_by == null)
    return "This ZIP is outside the housing comparison.";
  if (z.beats_income_by === 0)
    return "Housing investment matches its income rank.";
  return `Housing investment ranks ${Math.abs(z.beats_income_by)} places ${z.beats_income_by > 0 ? "higher" : "lower"} than its income rank.`;
}
export function downloadCSV(zips: Zip[]) {
  const csv = toCSV(zips);
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "dallas-zips-study-period-2018-2020.csv";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
