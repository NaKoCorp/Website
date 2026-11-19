import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, access } from "node:fs/promises";
import { join } from "node:path";
import vm from "node:vm";
import { withSite } from "./helpers/site.js";

// A throwaway page includes both partials in a minimal <head>, with a
// stylesheet after the script, so the script runs on its own.
const TEST_PAGE = `---
lang: en
permalink: /_test/index.html
---
<!doctype html>
<html lang="en">
<head>
{% include "partials/theme-script.njk" %}
<link rel="stylesheet" href="/assets/blog/blog.css">
</head>
<body>
{% include "partials/theme-toggle.njk" %}
</body>
</html>
`;

const exists = (p) => access(p).then(() => true, () => false);

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries.filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name));
}

let built;
async function testPage() {
  if (!built) {
    built = new Promise((resolve, reject) => {
      withSite({ "_test.njk": TEST_PAGE }, async (out) => {
        const html = await readFile(join(out, "_test/index.html"), "utf8");
        const files = await listFiles(out);
        const contents = await Promise.all(
          files
            .filter((f) => /\.(html|css)$/.test(f))
            .map(async (f) => ({ file: f, text: await readFile(f, "utf8") })),
        );
        const font = await exists(join(out, "assets/blog/fonts/fira-code-latin-600-normal.woff2"));
        resolve({ html, contents, font, fonts: files.filter((f) => f.includes("/assets/blog/fonts/")) });
      }).catch(reject);
    });
  }
  return built;
}

const head = (html) => html.slice(html.indexOf("<head>"), html.indexOf("</head>"));
const scriptOf = (html) => /<script>([\s\S]*?)<\/script>/.exec(html)[1];

test("the theme script comes before any stylesheet and reads localStorage and prefers-color-scheme", async () => {
  const h = head((await testPage()).html);
  const script = h.indexOf("<script");
  const sheet = h.indexOf('<link rel="stylesheet"');
  assert.ok(script !== -1, "no <script> in <head>");
  assert.ok(sheet !== -1, "no stylesheet in <head>");
  assert.ok(script < sheet, "the first <script> must precede the first stylesheet");
  const body = scriptOf(h);
  assert.match(body, /localStorage/);
  assert.match(body, /prefers-color-scheme/);
});

test("the theme toggle is a hidden button named after the dark theme, pressed while it is on", async () => {
  const { html } = await testPage();
  const button = /<button[^>]*class="theme-toggle"[^>]*>[\s\S]*?<\/button>/.exec(html)?.[0];
  assert.ok(button, "no .theme-toggle button");
  assert.match(button, /type="button"/);
  assert.match(button, /\saria-pressed(=|\s|>)/);
  assert.match(button, /\shidden(=|\s|>)/);
  // The name says which theme "pressed" turns on, so the state reads
  // "Dark theme, toggle button, pressed / not pressed".
  const name = /<span class="visually-hidden">([^<]*)<\/span>/.exec(button)?.[1];
  assert.equal(name, "Dark theme");
  assert.doesNotMatch(button, /aria-label=/);
});

test("no blog HTML or CSS loads Google Fonts", async () => {
  const { contents } = await testPage();
  for (const { file, text } of contents) {
    assert.doesNotMatch(text, /fonts\.googleapis\.com/, file);
  }
  for (const name of ["tokens.css", "blog.css"]) {
    const css = await readFile(join("src/assets/blog", name), "utf8");
    assert.doesNotMatch(css, /fonts\.googleapis\.com/, name);
  }
});

test("Fira Code 400, 500 and 600 are self-hosted under /assets/blog/fonts/", async () => {
  const { font, fonts } = await testPage();
  assert.equal(font, true);
  for (const w of [400, 500, 600]) {
    assert.ok(fonts.some((f) => f.endsWith(`fira-code-latin-${w}-normal.woff2`)), `weight ${w}`);
  }
  const css = await readFile("src/assets/blog/blog.css", "utf8");
  for (const w of [400, 500, 600]) {
    assert.match(css, new RegExp(`/assets/blog/fonts/fira-code-latin-${w}-normal\\.woff2`));
  }
  assert.match(css, /font-display:\s*swap/);
});

test("blog.css has no hex colour outside pre/code rules", async () => {
  const css = (await readFile("src/assets/blog/blog.css", "utf8")).replace(/\/\*[\s\S]*?\*\//g, "");
  // Every rule is `selectors { declarations }`; at-rule wrappers are skipped.
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/#[0-9a-fA-F]{3,8}\b/.test(body)) continue;
    const sel = selectors.trim();
    assert.match(sel, /\b(pre|code)\b/, `hex colour in "${sel}"`);
  }
});

test("tokens.css defines Paper on :root and Ink on [data-theme=dark]", async () => {
  const css = await readFile("src/assets/blog/tokens.css", "utf8");
  assert.match(css, /:root,\s*\[data-theme="light"\]\s*\{[^}]*--surface:/);
  assert.match(css, /\[data-theme="dark"\]\s*\{[^}]*--surface:/);
  for (const name of ["surface", "surface-alt", "surface-card", "fg", "fg-muted", "fg-soft", "border", "accent"]) {
    assert.match(css, new RegExp(`--${name}:`), name);
  }
  // The homepage's live values win.
  assert.match(css, /--purple:\s*#6640AF/i);
  assert.match(css, /--ink:\s*#120E19/i);
});

// Runs the inline script against a stubbed document and window.
function runThemeScript(source, { stored, storageThrows = false, prefersDark = false }) {
  const root = { dataset: {} };
  const store = new Map(stored ? [["theme", stored]] : []);
  const localStorage = {
    getItem(k) {
      if (storageThrows) throw new Error("SecurityError");
      return store.has(k) ? store.get(k) : null;
    },
    setItem(k, v) {
      if (storageThrows) throw new Error("SecurityError");
      store.set(k, v);
    },
  };
  const listeners = {};
  const button = {
    hidden: true,
    attrs: {},
    setAttribute(k, v) { this.attrs[k] = String(v); },
    removeAttribute(k) { delete this.attrs[k]; if (k === "hidden") this.hidden = false; },
    addEventListener(type, fn) { listeners[type] = fn; },
  };
  const document = {
    documentElement: root,
    readyState: "complete",
    querySelectorAll: (sel) => (sel === ".theme-toggle" ? [button] : []),
    addEventListener: () => {},
  };
  const window = {
    matchMedia: (q) => ({ matches: q === "(prefers-color-scheme: dark)" && prefersDark }),
  };
  const sandbox = { document, window, localStorage, matchMedia: window.matchMedia };
  // localStorage is a getter on window in browsers; mirror it so either form works.
  Object.defineProperty(window, "localStorage", {
    get() {
      if (storageThrows) throw new Error("SecurityError");
      return localStorage;
    },
  });
  vm.runInNewContext(source, sandbox);
  return { root, button, store, click: () => listeners.click?.() };
}

test("the theme script applies the stored choice, else prefers-color-scheme", async () => {
  const src = scriptOf((await testPage()).html);
  assert.equal(runThemeScript(src, { stored: "light", prefersDark: true }).root.dataset.theme, "light");
  assert.equal(runThemeScript(src, { stored: "dark" }).root.dataset.theme, "dark");
  assert.equal(runThemeScript(src, { prefersDark: true }).root.dataset.theme, "dark");
  assert.equal(runThemeScript(src, { prefersDark: false }).root.dataset.theme, "light");
  assert.equal(runThemeScript(src, { stored: "bogus", prefersDark: true }).root.dataset.theme, "dark");
});

test("the theme script falls back to prefers-color-scheme when localStorage throws", async () => {
  const src = scriptOf((await testPage()).html);
  const dark = runThemeScript(src, { storageThrows: true, prefersDark: true });
  assert.equal(dark.root.dataset.theme, "dark");
  assert.equal(runThemeScript(src, { storageThrows: true }).root.dataset.theme, "light");
  // Toggling still works for the page, it just is not remembered.
  dark.click();
  assert.equal(dark.root.dataset.theme, "light");
});

test("the toggle is revealed, switches the theme, saves it and updates aria-pressed", async () => {
  const src = scriptOf((await testPage()).html);
  const page = runThemeScript(src, { prefersDark: false });
  assert.equal(page.button.hidden, false);
  assert.equal(page.button.attrs["aria-pressed"], "false");
  page.click();
  assert.equal(page.root.dataset.theme, "dark");
  assert.equal(page.store.get("theme"), "dark");
  assert.equal(page.button.attrs["aria-pressed"], "true");
  page.click();
  assert.equal(page.root.dataset.theme, "light");
  assert.equal(page.store.get("theme"), "light");
  assert.equal(page.button.attrs["aria-pressed"], "false");
});
