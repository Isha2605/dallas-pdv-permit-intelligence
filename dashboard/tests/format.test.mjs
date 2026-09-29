import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { money, formatWorkDescription } from "../src/format.ts";
test("compact money uses three significant figures while detailed values retain dollars", () => {
  for (const [n, expected] of [
    [460317984.58, "$460M"],
    [18483485.69, "$18.5M"],
    [916410, "$916K"],
    [2380000, "$2.38M"],
    [11120000000, "$11.1B"],
  ])
    assert.equal(money(n, true), expected);
  assert.equal(money(460317984.58), "$460,317,985");
  assert.equal(money(null, true), "Not available");
});
test("work labels normalize acronyms without inventing missing source text", async () => {
  assert.equal(
    formatWorkDescription("DEMO SFD"),
    "Demolish single-family home",
  );
  assert.equal(
    formatWorkDescription("REPLACE OR MODIFY EXISTING HVAC"),
    "Replace or modify existing HVAC",
  );
  assert.equal(formatWorkDescription("GAS TEST (ATMOS)"), "Gas test (Atmos)");
  assert.equal(
    formatWorkDescription("RE-PAIR  MULTI  FAMILY BLDG."),
    "Repair multifamily building",
  );
  const work = JSON.parse(
    await readFile(
      new URL("../data/top_housing_work.json", import.meta.url),
      "utf8",
    ),
  );
  for (const row of work.filter(
    (r) =>
      r.work_description.trim().endsWith("MULTI-L") ||
      r.work_description.trim().endsWith("CLOSETS TO"),
  ))
    assert.ok(formatWorkDescription(row.work_description).endsWith("…"));
  assert.equal(
    formatWorkDescription("CONSTRUCT NEW SFD"),
    "Construct new single-family home",
  );
});
