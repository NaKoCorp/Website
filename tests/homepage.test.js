import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildSite } from "./helpers/build.js";

test("homepage is copied byte for byte", async () => {
  const out = await buildSite();
  assert.deepEqual(await readFile(join(out, "index.html")), await readFile("src/index.html"));
  assert.equal((await readFile(join(out, "CNAME"), "utf8")).trim(), "www.nakocorp.com");
  for (const f of ["assets/css/site.css", "assets/js/site.js", "assets/nakocorp-logo.svg"])
    assert.ok(existsSync(join(out, f)), f);
});

test("homepage links the blog from the nav and the footer, following the language", async () => {
  const html = await readFile("src/index.html", "utf8");
  assert.equal((html.match(/data-blog-link/g) || []).length, 2);
  const js = await readFile("src/assets/js/site.js", "utf8");
  assert.ok(js.includes("nav_blog"));
  assert.ok(js.includes("data-blog-link"));
});

test("homepage and blog share the theme script and the theme toggle", async () => {
  const home = await readFile("src/index.html", "utf8");
  const partial = await readFile("src/_includes/partials/theme-script.njk", "utf8");
  const script = (text) => /<script>[\s\S]*?<\/script>/.exec(text)[0];
  assert.equal(script(home), script(partial), "keep the homepage copy identical to the blog partial");
  const head = home.slice(0, home.indexOf("</head>"));
  assert.ok(head.indexOf("<script>") < head.indexOf('rel="stylesheet"'), "theme script before the stylesheets");
  assert.match(home, /<button type="button" class="theme-toggle" aria-pressed="false"[^>]* hidden>/);
});

test("homepage colours come from the theme tokens", async () => {
  const css = await readFile("src/assets/css/site.css", "utf8");
  const block = (selector) => {
    const start = css.indexOf(`${selector} {`);
    assert.ok(start >= 0, `site.css has a ${selector} block`);
    return css.slice(start, css.indexOf("}", start));
  };
  const light = block(':root,\n:root[data-theme="dark"] .phone-screen');
  const dark = block(':root[data-theme="dark"]');
  const tokens = ["surface", "surface-alt", "surface-card", "fg", "fg-muted", "fg-soft", "border",
    "border-strong", "accent", "accent-hover", "wash", "field", "status-ok", "ok-bg", "danger",
    "warn-bg", "warn-border", "warn-fg", "banner-bg", "banner-fg", "ble", "wifi", "lora", "net"];
  for (const t of tokens) {
    assert.match(light, new RegExp(`--${t}: #[0-9A-F]{6};`), `Paper defines --${t}`);
    assert.match(dark, new RegExp(`--${t}: #[0-9A-F]{6};`), `Ink defines --${t}`);
  }

  // Inline SVG colours read the tokens. The only hex left is white text
  // (fill: #fff in a style attribute) on the brand-purple fill, which is
  // brand-fixed in both themes like the primary buttons.
  const html = await readFile("src/index.html", "utf8");
  const svgs = html.match(/<svg[\s\S]*?<\/svg>/g) || [];
  assert.ok(svgs.length > 5);
  for (const svg of svgs) {
    assert.deepEqual(svg.match(/(?:fill|stroke|stop-color)="#[0-9A-Fa-f]{3,8}"/g) || [], []);
    for (const m of svg.match(/(?:fill|stroke)\s*:\s*#[0-9A-Fa-f]{3,8}/g) || [])
      assert.match(m, /^fill: #fff$/i, `only white text on the brand fill: ${m}`);
  }
});
