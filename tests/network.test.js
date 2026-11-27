import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildSite } from "./helpers/build.js";
import {
  byCountry,
  cleanCensus,
  cleanText,
  formatUptime,
  mapLayers,
  operatorCount,
  spreadMarkers,
} from "../lib/network.js";

const FIXTURE = "tests/fixtures/census.json";
const IPV4 = /\b\d{1,3}(?:\.\d{1,3}){3}\b/;

const fixture = async () => JSON.parse(await readFile(FIXTURE, "utf8"));

test("a census keeps well-formed nodes once and drops the rest", async () => {
  const c = cleanCensus(await fixture());
  assert.deepEqual(c.nodes.map((n) => n.id), ["CCCCDDDD", "EEEEFFFF", "AAAABBBB"]);
  assert.equal(c.unreachable, 1);
  assert.equal(c.ipdb, "2026-11");
});

test("no field of a census can carry an address", async () => {
  const c = cleanCensus(await fixture());
  const de = c.nodes.find((n) => n.id === "EEEEFFFF");
  assert.equal(de.as_name, null);
  assert.equal(de.software, null);
  assert.doesNotMatch(JSON.stringify(c), IPV4);
  assert.equal(cleanText("fe80::1"), null);
  assert.equal(cleanText("OVH - OVH SAS, FR"), "OVH - OVH SAS, FR");
});

test("a census of another schema, or not a census, is refused", () => {
  assert.equal(cleanCensus({ schema: 2, generated_at: 1, nodes: [] }), null);
  assert.equal(cleanCensus({ schema: 1, nodes: [] }), null);
  assert.equal(cleanCensus(null), null);
});

test("countries, operators and uptimes", async () => {
  const c = cleanCensus(await fixture());
  assert.deepEqual(byCountry(c.nodes), [
    { code: "CA", count: 1 },
    { code: "DE", count: 1 },
    { code: "FR", count: 1 },
  ]);
  assert.equal(operatorCount(c.nodes), 3);
  assert.equal(formatUptime(90000, "en"), "1 d 1 h");
  assert.equal(formatUptime(90000, "fr"), "1 j 1 h");
  assert.equal(formatUptime(7200, "en"), "2 h");
  assert.equal(formatUptime(30, "en"), "1 min");
});

test("the map lights only the countries holding relays", () => {
  const m = mapLayers([{ code: "FR", count: 3 }, { code: "SG", count: 1 }]);
  assert.deepEqual(m.lit.map((l) => l.code), ["FR", "SG"]);
  assert.ok(m.lit[0].path.length > 0, "France has dots");
  assert.equal(m.lit[1].path, "", "Singapore is too small for a dot but keeps its marker");
  assert.ok(m.lit[0].delay > m.lit.find((l) => l.code === "FR").delay - 1);
});

test("close markers are pushed apart, far ones stay", () => {
  const [a, b, c] = spreadMarkers([[500, 100], [510, 100], [100, 100]]);
  assert.ok(Math.hypot(b[0] - a[0], b[1] - a[1]) >= 55.9);
  assert.deepEqual(c, [100, 100]);
});

let out;
const site = async () => {
  if (out) return out;
  const previous = process.env.NETWORK_CENSUS;
  process.env.NETWORK_CENSUS = FIXTURE;
  try {
    out = await buildSite();
  } finally {
    if (previous === undefined) delete process.env.NETWORK_CENSUS;
    else process.env.NETWORK_CENSUS = previous;
  }
  return out;
};
const page = async (url) => readFile(join(await site(), url, "index.html"), "utf8");

for (const p of [
  { lang: "en", url: "/en/network/", alt: "/fr/reseau/", mismatch: "IP base: United States" },
  { lang: "fr", url: "/fr/reseau/", alt: "/en/network/", mismatch: "Base IP\u00a0: États-Unis" },
]) {
  test(`${p.url} lists the relays, links its translation and shows no address`, async () => {
    const html = await page(p.url);
    assert.match(html, new RegExp(`<html lang="${p.lang}"`));
    assert.ok(html.includes(`hreflang="${p.lang === "en" ? "fr" : "en"}" href="https://www.nakocorp.com${p.alt}"`));
    for (const id of ["AAAABBBB", "CCCCDDDD", "EEEEFFFF"]) assert.ok(html.includes(id), id);
    assert.ok(html.includes(p.mismatch), p.mismatch);
    assert.ok(html.includes('href="#country-FR"') && html.includes('id="country-FR"'));
    assert.ok(html.includes('data-generated="1795818646"'));
    assert.doesNotMatch(html, IPV4);
    assert.ok(!html.includes("2001:db8"));
  });
}

test("/network/nodes.json republishes the validated census", async () => {
  const json = JSON.parse(await readFile(join(await site(), "network/nodes.json"), "utf8"));
  assert.equal(json.schema, 1);
  assert.equal(json.nodes.length, 3);
  assert.doesNotMatch(JSON.stringify(json), IPV4);
});

test("the network pages are in the sitemap and the nav", async () => {
  const xml = await readFile(join(await site(), "sitemap.xml"), "utf8");
  assert.ok(xml.includes("<loc>https://www.nakocorp.com/en/network/</loc>"));
  assert.ok(xml.includes("<loc>https://www.nakocorp.com/fr/reseau/</loc>"));
  const blog = await readFile(join(await site(), "fr/blog/index.html"), "utf8");
  assert.ok(blog.includes('href="/fr/reseau/"'));
});

test("without a census the page says so and publishes no JSON", async () => {
  const previous = process.env.NETWORK_CENSUS;
  process.env.NETWORK_CENSUS = "tests/fixtures/missing.json";
  let dir;
  try {
    dir = await buildSite();
  } finally {
    if (previous === undefined) delete process.env.NETWORK_CENSUS;
    else process.env.NETWORK_CENSUS = previous;
  }
  const html = await readFile(join(dir, "en/network/index.html"), "utf8");
  assert.ok(html.includes("No census yet"));
  assert.ok(html.includes("The list appears here after the first census."));
  await assert.rejects(readFile(join(dir, "network/nodes.json"), "utf8"));
});
