import { test } from "node:test";
import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { withSite } from "./helpers/site.js";

// Internal link check (design spec §5.9): every internal href/src of the built
// HTML must resolve to a file of the output. The build is the real src/ with
// drafts shown, plus a published EN/FR pair.
const article = (title) =>
  `---\ntitle: ${title}\ndescription: d\ndate: 2026-01-01\ntranslationKey: links\ntags: []\nbarking: true\n---\nBody ${title}, see [the list](/en/blog/).\n`;
const files = { "en/blog/links.md": article("Links"), "fr/blog/liens.md": article("Liens") };

// withSite leaves these out of its input (helpers/site.js); Eleventy copies
// them from src/ as-is, so a link to them is checked against src/.
const PASSTHROUGH = ["/index.html", "/CNAME", "/assets/"];

const exists = (p) => access(p).then(() => true, () => false);

// Absolute URLs (any scheme, or protocol-relative) and fragment-only links are
// not internal.
const isInternal = (url) => url !== "" && !/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url);

// The page's URL path for a file of the output: en/blog/index.html -> /en/blog/.
const pagePath = (file) => "/" + file.replace(/index\.html$/, "");

async function resolves(out, url) {
  const path = decodeURI(url);
  const candidates = path.endsWith("/") ? [path + "index.html"] : [path, path + "/index.html"];
  for (const candidate of candidates) {
    const root = PASSTHROUGH.some((p) => candidate === p || candidate.startsWith(p)) ? "src" : out;
    if (await exists(join(root, candidate))) return true;
  }
  return false;
}

test("every internal link and resource of the built pages resolves", async () => {
  const broken = [];
  let checked = 0;
  await withSite(
    files,
    async (out) => {
      const pages = (await readdir(out, { recursive: true })).filter((f) => f.endsWith(".html"));
      assert.ok(pages.includes(join("en", "blog", "style-guide", "index.html")), "drafts are built");
      // The homepage is copied, not built: check it from src/.
      const sources = [
        ...pages.map((f) => ({ file: f, path: join(out, f) })),
        { file: "index.html", path: join("src", "index.html") },
      ];
      for (const { file, path } of sources) {
        const html = await readFile(path, "utf8");
        for (const [, raw] of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
          if (!isInternal(raw)) continue;
          // Relative links resolve against the page; the query and fragment go.
          const url = new URL(raw, `https://site${pagePath(file.split("\\").join("/"))}`).pathname;
          checked++;
          if (!(await resolves(out, url))) broken.push(`${file}: ${raw}`);
        }
      }
    },
    { drafts: true },
  );
  assert.ok(checked > 20, `only ${checked} links checked`);
  assert.deepEqual(broken, []);
});
