import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";

const dist = new URL("../dist/", import.meta.url);
const assets = new URL("assets/", dist);
const base = "/dallas-pdv-permit-intelligence/";
const html = await readFile(new URL("index.html", dist), "utf8");
for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (url.startsWith("data:")) continue;
  assert.ok(
    url.startsWith(base),
    `Asset breaks the GitHub Pages subpath: ${url}`,
  );
  await stat(new URL(url.slice(base.length), dist));
}

const names = await readdir(assets);
const sources = await readdir(new URL("../data/", import.meta.url));
for (const name of sources.filter((name) => name.endsWith(".json"))) {
  const emitted = names.find(
    (asset) =>
      asset.startsWith(`${name.slice(0, -5)}-`) && asset.endsWith(".json"),
  );
  assert.ok(emitted, `${name} is missing from the build`);
  const original = JSON.parse(
    await readFile(new URL(`../data/${name}`, import.meta.url), "utf8"),
  );
  const built = JSON.parse(await readFile(new URL(emitted, assets), "utf8"));
  assert.deepEqual(built, original, `${name} changed during the build`);
}

const firstLoad = names.filter(
  (name) =>
    !/^(zip_rolling|kpi_rolling|top_housing_work|quarterly|quarterly_holdout|work_mix)-/.test(
      name,
    ),
);
let bytes = Buffer.byteLength(html);
for (const name of firstLoad) bytes += (await stat(new URL(name, assets))).size;
assert.ok(
  bytes < 2_000_000,
  `First-party initial payload exceeds 2 MB: ${bytes} bytes`,
);
console.log(
  `Production verified: GitHub Pages paths, all ${sources.filter((name) => name.endsWith(".json")).length} unchanged JSON exports, ${(bytes / 1_000_000).toFixed(2)} MB initial first-party assets before compression.`,
);
console.log(
  "External font and map tiles are additional; network timing is connection-dependent.",
);
