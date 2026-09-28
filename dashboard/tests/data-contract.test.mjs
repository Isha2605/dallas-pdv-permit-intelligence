import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = async (name) =>
  JSON.parse(
    await readFile(new URL(`../data/${name}.json`, import.meta.url), "utf8"),
  );

test("verified study records support the complete story", async () => {
  const [k, zips, pairs, meta] = await Promise.all(
    ["kpi_summary", "zips", "pairs", "meta"].map(read),
  );
  assert.equal(k.total_permits, 126840);
  assert.equal(k.big_project_count, 2399);
  assert.equal(k.story_zip_new_sfd_permits, 404);
  assert.equal(
    zips.filter((z) => z.is_in_dallas && z.has_enough_permits).length,
    k.mapped_zip_count,
  );
  assert.equal(
    zips.filter((z) => z.income_rank != null).length,
    k.neighborhood_count,
  );
  const story = zips.find((z) => z.zip_code === k.story_zip);
  assert.equal(story.beats_income_by, 13);
  assert.ok(
    story.housing_value_per_resident < k.median_housing_value_per_resident,
  );
  assert.equal(
    pairs.find((p) => p.pair_rank === 1).high_investment_zip,
    "75226",
  );
  assert.equal(meta.data_end, k.last_issued_date);
  assert.ok(
    zips.some((z) => z.pct_in_dallas > 1),
    "city shares are percentages, not fractions",
  );
});

test("all map and profile records join to ZIPs; ranked values are complete", async () => {
  const [zips, boundaries, rolling, work] = await Promise.all(
    ["zips", "zip_boundaries", "zip_rolling", "top_housing_work"].map(read),
  );
  const keys = new Set(zips.map((z) => z.zip_code));
  assert.equal(keys.size, 71);
  assert.equal(boundaries.features.length, 71);
  for (const f of boundaries.features)
    assert.ok(keys.has(f.properties.zip_code));
  for (const row of [...rolling, ...work]) assert.ok(keys.has(row.zip_code));
  for (const z of zips.filter((z) => z.income_rank != null)) {
    assert.ok(z.housing_rank != null && z.beats_income_by != null);
    assert.equal(z.income_rank - z.housing_rank, z.beats_income_by);
  }
  assert.ok(rolling.every((r) => r.as_of_date <= "2020-08-31"));
});

test("share fields stay fractional and supporting charts have expected groups", async () => {
  const [quarters, mix, work] = await Promise.all(
    ["quarterly", "work_mix", "top_housing_work"].map(read),
  );
  assert.equal(quarters.length, 11);
  assert.equal(mix.length, 9);
  for (const q of quarters)
    assert.ok(q.high_investment_share >= 0 && q.high_investment_share <= 1);
  for (const m of mix)
    assert.ok(m.share_of_tier_permits >= 0 && m.share_of_tier_permits <= 1);
  for (const w of work) assert.ok(w.rank_in_zip >= 1 && w.rank_in_zip <= 5);
});
