import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { toCSV } from "../src/csv.ts";

test("CSV preserves source precision, nulls, booleans, and all 71 ZIP records", async () => {
  const zips = JSON.parse(
    await readFile(new URL("../data/zips.json", import.meta.url), "utf8"),
  );
  const csv = toCSV(zips);
  assert.equal(csv.split("\r\n").length, 72);
  assert.ok(csv.includes('"housing_value_per_resident"'));
  assert.ok(
    csv.includes(
      `"${zips.find((z) => z.zip_code === "75216").housing_value_per_resident}"`,
    ),
  );
  assert.ok(csv.includes('"false"'));
  assert.ok(csv.includes('""'));
});

test("CSV safely quotes commas, quotes, line breaks, and empty inputs", () => {
  assert.equal(
    toCSV([{ text: 'a,"b"\nc', count: 0, missing: null }]),
    '"text","count","missing"\r\n"a,""b""\nc","0",""',
  );
  assert.equal(toCSV([]), "");
});
