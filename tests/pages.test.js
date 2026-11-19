import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildSite } from "./helpers/build.js";

const SITE = "https://www.nakocorp.com";
// The privacy policy and the support page, each with its translation.
const PAGES = [
  { lang: "en", url: "/en/privacy/", alt: "/fr/confidentialite/" },
  { lang: "fr", url: "/fr/confidentialite/", alt: "/en/privacy/" },
  { lang: "en", url: "/en/support/", alt: "/fr/support/" },
  { lang: "fr", url: "/fr/support/", alt: "/en/support/" },
];

let out;
const site = async () => (out ??= await buildSite());
const page = async (url) => readFile(join(await site(), url, "index.html"), "utf8");

for (const p of PAGES) {
  test(`${p.url} declares its language and links its translation`, async () => {
    const html = await page(p.url);
    const head = html.slice(html.indexOf("<head>"), html.indexOf("</head>"));
    assert.match(html, new RegExp(`<html lang="${p.lang}"`));
    assert.match(head, new RegExp(`<link rel="canonical" href="${SITE}${p.url}">`));
    assert.match(head, new RegExp(`hreflang="${p.lang === "en" ? "fr" : "en"}" href="${SITE}${p.alt}"`));
    const en = p.lang === "en" ? p.url : p.alt;
    assert.match(head, new RegExp(`hreflang="x-default" href="${SITE}${en}"`));
    // The language switch goes to the translation, not to the blog.
    const sw = /class="lang-switch"[\s\S]*?<\/a>/.exec(html)[0];
    assert.ok(sw.includes(`href="${p.alt}"`), sw);
    assert.ok(html.includes("mailto:support@nakocorp.com"));
    assert.match(head, /<title>[^<]* · NakoCorp<\/title>/);
  });
}

test("the blog footer links both pages in its language", async () => {
  const en = await readFile(join(await site(), "en/blog/index.html"), "utf8");
  const fr = await readFile(join(await site(), "fr/blog/index.html"), "utf8");
  for (const url of ["/en/privacy/", "/en/support/"]) assert.ok(en.includes(`href="${url}"`), url);
  for (const url of ["/fr/confidentialite/", "/fr/support/"]) assert.ok(fr.includes(`href="${url}"`), url);
});

test("the homepage footer links both pages and switches them to French", async () => {
  const html = await readFile("src/index.html", "utf8");
  assert.ok(html.includes('href="/en/privacy/" data-i18n="footer_privacy" data-href-fr="/fr/confidentialite/"'));
  assert.ok(html.includes('href="/en/support/" data-i18n="footer_support" data-href-fr="/fr/support/"'));
  const js = await readFile("src/assets/js/site.js", "utf8");
  assert.ok(js.includes("footer_privacy") && js.includes("footer_support") && js.includes("data-href-fr"));
});

test("the sitemap lists both pages with their alternates", async () => {
  const xml = await readFile(join(await site(), "sitemap.xml"), "utf8");
  for (const p of PAGES) assert.ok(xml.includes(`<loc>${SITE}${p.url}</loc>`), p.url);
  assert.ok(xml.includes(`hreflang="fr" href="${SITE}/fr/confidentialite/"`));
});
