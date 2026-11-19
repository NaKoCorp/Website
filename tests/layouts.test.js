import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { withSite } from "./helpers/site.js";
import { labels } from "../lib/i18n.js";

const SITE = "https://www.nakocorp.com";

// A published EN/FR pair about something other than Barking.
const plain = (title) =>
  `---\ntitle: ${title}\ndescription: d\ndate: 2026-01-01\ntranslationKey: plain\ntags: []\nbarking: false\n---\nBody ${title}\n`;

// One draft build of src/ (with the style guide) plus the plain pair, shared
// by every test.
let built;
function pages() {
  if (!built) {
    built = new Promise((resolve, reject) => {
      const files = { "en/blog/plain.md": plain("Plain"), "fr/blog/simple.md": plain("Simple") };
      withSite(
        files,
        async (out) => {
          const read = (p) => readFile(join(out, p), "utf8");
          resolve({
            en: await read("en/blog/style-guide/index.html"),
            fr: await read("fr/blog/guide-de-style/index.html"),
            plain: await read("en/blog/plain/index.html"),
            enIndex: await read("en/blog/index.html"),
            frIndex: await read("fr/blog/index.html"),
          });
        },
        { drafts: true },
      ).catch(reject);
    });
  }
  return built;
}

const head = (html) => html.slice(html.indexOf("<head>"), html.indexOf("</head>"));
// From the switch's opening tag to the end of its link.
const langSwitch = (html) => /class="lang-switch"[\s\S]*?<\/a>/.exec(html)?.[0] ?? "";

test("the EN article declares its language, canonical URL and hreflang alternates", async () => {
  const { en } = await pages();
  const h = head(en);
  assert.match(en, /<html lang="en"/);
  assert.match(h, new RegExp(`<link rel="canonical" href="${SITE}/en/blog/style-guide/">`));
  assert.match(h, new RegExp(`<link rel="alternate" hreflang="fr" href="${SITE}/fr/blog/guide-de-style/">`));
  assert.match(h, new RegExp(`<link rel="alternate" hreflang="en" href="${SITE}/en/blog/style-guide/">`));
  assert.match(h, new RegExp(`<link rel="alternate" hreflang="x-default" href="${SITE}/en/blog/style-guide/">`));
});

test("the FR article points x-default at the EN version", async () => {
  const { fr } = await pages();
  const h = head(fr);
  assert.match(fr, /<html lang="fr"/);
  assert.match(h, new RegExp(`<link rel="canonical" href="${SITE}/fr/blog/guide-de-style/">`));
  assert.match(h, new RegExp(`<link rel="alternate" hreflang="x-default" href="${SITE}/en/blog/style-guide/">`));
});

test("the head carries Open Graph, Twitter and the language's feed", async () => {
  const { en, fr } = await pages();
  const h = head(en);
  assert.match(h, /<meta property="og:locale" content="en_US">/);
  assert.match(h, new RegExp(`<meta property="og:url" content="${SITE}/en/blog/style-guide/">`));
  assert.match(h, new RegExp(`<meta property="og:image" content="${SITE}/assets/blog/og-en.png">`));
  assert.match(h, /<meta property="og:title" content="[^"]+">/);
  assert.match(h, /<meta name="description" content="[^"]+">/);
  assert.match(h, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(h, /<link rel="alternate" type="application\/atom\+xml"[^>]*href="\/en\/feed\.xml"/);
  assert.match(head(fr), /<meta property="og:locale" content="fr_FR">/);
  assert.match(head(fr), new RegExp(`og-fr\\.png`));
});

test("<head> opens with charset and viewport, then the theme script, before the stylesheets", async () => {
  const h = head((await pages()).en);
  const first = h.replace(/^<head>\s*/, "");
  assert.ok(
    /^<meta charset="utf-8">\s*<meta name="viewport"[^>]*>\s*<script>/.test(first),
    "charset, viewport, then the theme script must open <head>",
  );
  assert.ok(h.indexOf("<script>") < h.indexOf('rel="stylesheet"'), "theme script before every stylesheet");
  assert.ok(h.indexOf("tokens.css") < h.indexOf("blog.css"), "tokens.css before blog.css");
});

test("a Barking article shows the prototype warning; another does not", async () => {
  const { en, fr, plain: other } = await pages();
  assert.ok(en.includes(labels.en.prototypeTitle));
  assert.ok(fr.includes(labels.fr.prototypeTitle));
  assert.ok(!other.includes(labels.en.prototypeTitle));
});

test("the style guide renders its diagram as an inline SVG with a title", async () => {
  const { en, fr } = await pages();
  assert.match(en, /<svg[^>]*>[\s\S]*?<title[^>]*>[^<]+<\/title>/);
  assert.match(fr, /<svg[^>]*>[\s\S]*?<title[^>]*>[^<]+<\/title>/);
});

test("article h2 and h3 carry ids to link a section", async () => {
  const { en, fr } = await pages();
  assert.match(en, /<h2 id="headings-and-paragraphs">Headings and paragraphs<\/h2>/);
  assert.match(en, /<h3 id="a-third-level-heading">/);
  assert.match(fr, /<h2 id="schema">Schéma<\/h2>/);
  // Under the sticky nav, a linked heading must not land hidden behind it.
  const css = await readFile("src/assets/blog/blog.css", "utf8");
  assert.match(css, /\.prose :is\(h2, h3\)\[id\] \{[^}]*scroll-margin-top:/);
});

test("code blocks are highlighted", async () => {
  const { en } = await pages();
  assert.match(en, /<pre class="language-rust"/);
  assert.match(en, /<span class="token keyword">/);
  assert.match(en, /<span class="token comment">/);
});

test("each list shows its own language only", async () => {
  const { enIndex, frIndex } = await pages();
  assert.match(frIndex, /<html lang="fr"/);
  assert.match(frIndex, /href="\/fr\/blog\/guide-de-style\/"/);
  assert.doesNotMatch(frIndex, /\/en\/blog\/style-guide\//);
  assert.match(enIndex, /href="\/en\/blog\/style-guide\/"/);
  assert.doesNotMatch(enIndex, /\/fr\/blog\/guide-de-style\//);
});

test("the language switch links to the translation, else to the other list", async () => {
  const { en, fr, enIndex } = await pages();
  const sw = langSwitch(en);
  assert.match(sw, /<a [^>]*href="\/fr\/blog\/guide-de-style\/"/);
  assert.match(sw, /hreflang="fr"/);
  assert.match(sw, /lang="fr"/);
  assert.match(langSwitch(fr), /href="\/en\/blog\/style-guide\/"/);
  assert.match(langSwitch(enIndex), /href="\/fr\/blog\/"/);
});

test("the language switch link is named in the page's language, its code in the other", async () => {
  const { en, fr } = await pages();
  const link = (html) => /<a [^>]*hreflang[^>]*>[\s\S]*?<\/a>/.exec(langSwitch(html))?.[0] ?? "";
  for (const [html, lang, other] of [[en, "en", "fr"], [fr, "fr", "en"]]) {
    const a = link(html);
    assert.ok(a.includes(`aria-label="${labels[lang].readIn}"`), a);
    // The label is in the page's language, so the <a> itself carries no lang;
    // only the visible code is marked as the other language.
    assert.doesNotMatch(/<a [^>]*>/.exec(a)[0], /\slang=/);
    assert.ok(a.includes(`<span lang="${other}">${other.toUpperCase()}</span>`), a);
  }
});

test("article pages link previous and next within the same language", async () => {
  const { en } = await pages();
  // The style guide (2026-11-18) is newer than the plain article (2026-01-01).
  assert.match(en, /<nav class="post-nav"[\s\S]*href="\/en\/blog\/plain\/"[\s\S]*<\/nav>/);
  const postNav = /<nav class="post-nav"[\s\S]*?<\/nav>/.exec(en)[0];
  assert.doesNotMatch(postNav, /\/fr\//);
});

test("the footer is on Ink and carries the FrenchMark with the Ink coq, like the homepage", async () => {
  const { en, fr } = await pages();
  const footer = (html) => /<footer[\s\S]*<\/footer>/.exec(html)[0];
  assert.ok(footer(en).includes(labels.en.frenchMark));
  assert.ok(footer(fr).includes(labels.fr.frenchMark));
  assert.match(footer(en), /coq-dark\.svg/);
  assert.doesNotMatch(footer(en), /coq-light\.svg/);
});

test("blog header matches the homepage header: lockup, sections, EN / FR, GitHub", async () => {
  const { en, fr, frIndex } = await pages();
  const home = await readFile("src/index.html", "utf8");
  const nav = (html) => /<header class="site-nav">[\s\S]*?<\/header>/.exec(html)[0];
  for (const html of [en, fr]) {
    const n = nav(html);
    assert.match(n, /<span class="brand-name">Barking<\/span>/);
    assert.match(n, /<span class="brand-by">by NakoCorp<\/span>/);
    // Every homepage section anchor is linked from the blog header.
    for (const [, id] of home.matchAll(/<a href="#(\w+)" data-i18n="nav_/g))
      assert.match(n, new RegExp(`href="/#${id}"`), id);
    assert.match(n, /class="nav-gh" href="https:\/\/github.com\/nakocorp\/barking"/);
  }
  assert.match(nav(fr), new RegExp(labels.fr.navNode));
  // EN always comes first, as on the homepage; the current language is not a link.
  assert.match(nav(frIndex), /<a href="\/en\/blog\/"[^>]*><span lang="en">EN<\/span><\/a><span aria-hidden="true">\/<\/span><span aria-current="true" lang="fr">FR<\/span>/);
  assert.match(nav(frIndex), /href="\/fr\/blog\/" aria-current="page"/);
});

test("articles carry the reading aids and a cover; the list features the latest article", async () => {
  const { en, enIndex } = await pages();
  assert.match(en, /<div class="reading-progress" aria-hidden="true"><span data-progress><\/span><\/div>/);
  assert.match(en, /<nav class="toc" aria-label="On this page" data-toc hidden>/);
  assert.match(en, /<script src="\/assets\/blog\/blog.js" defer><\/script>/);
  assert.match(en, /<div class="article-cover"><svg class="cover-art"/);
  assert.match(enIndex, /<a class="feature-card" href="\/en\/blog\/[^"]+\/">/);
});
