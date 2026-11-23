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

test("homepage colours come from the shared design system tokens", async () => {
  const html0 = await readFile("src/index.html", "utf8");
  const tokensAt = html0.indexOf('href="assets/blog/tokens.css"');
  assert.ok(tokensAt >= 0, "the homepage loads the blog's tokens.css");
  assert.ok(tokensAt < html0.indexOf('href="assets/css/site.css"'), "tokens.css before site.css");

  const css = await readFile("src/assets/css/site.css", "utf8");
  const tokensCss = await readFile("src/assets/blog/tokens.css", "utf8");
  const defined = (src, t) => new RegExp(`--${t}:`).test(src);
  // Semantic tokens: defined once, in tokens.css; site.css never copies them
  // as hex (it may only re-point them at palette tokens for the Paper phone).
  for (const t of ["surface", "surface-alt", "surface-card", "fg", "fg-muted", "fg-soft", "border",
    "border-strong", "accent", "accent-hover", "field", "status-ok", "danger",
    "warn-bg", "warn-border", "warn-fg", "ble", "wifi", "lora", "net"]) {
    assert.ok(defined(tokensCss, t), `tokens.css defines --${t}`);
    assert.doesNotMatch(css, new RegExp(`--${t}: #`), `site.css does not copy --${t} as hex`);
  }
  // Homepage-only aliases are built in site.css, for Paper and for Ink.
  for (const t of ["wash", "ok-bg", "banner-bg", "banner-fg"]) {
    assert.match(css, new RegExp(`:root:not\\(\\[data-theme="dark"\\]\\)[\\s\\S]*?--${t}:`), `Paper alias --${t}`);
    assert.match(css, new RegExp(`:root\\[data-theme="dark"\\] \\{[\\s\\S]*?--${t}:`), `Ink alias --${t}`);
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
