import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { withSite } from "./helpers/site.js";

const post = (title, extra = "") =>
  `---\ntitle: ${title}\ndescription: d\ndate: 2026-11-19\n${extra}translationKey: upd\ntags: []\nbarking: false\n---\nBody\n`;

test("an edited article shows its last update date on the page, in the list and in the meta", async () => {
  const files = {
    "en/blog/upd.md": post("Edited", "updated: 2026-12-03\n"),
    "fr/blog/maj.md": post("Modifié", "updated: 2026-12-03\n"),
  };
  await withSite(files, async (out) => {
    const read = (p) => readFile(join(out, p), "utf8");
    const en = await read("en/blog/upd/index.html");
    const fr = await read("fr/blog/maj/index.html");
    assert.match(en, /Updated <time datetime="2026-12-03">December 3, 2026<\/time>/);
    assert.match(fr, /Mis à jour le <time datetime="2026-12-03">3 décembre 2026<\/time>/);
    assert.match(en, /<meta property="article:published_time" content="2026-11-19">/);
    assert.match(en, /<meta property="article:modified_time" content="2026-12-03">/);
    assert.match(await read("en/blog/index.html"), /Updated <time datetime="2026-12-03">/);
  });
});

test("an article never edited shows no update line", async () => {
  const files = { "en/blog/upd.md": post("Once"), "fr/blog/maj.md": post("Une fois") };
  await withSite(files, async (out) => {
    const en = await readFile(join(out, "en/blog/upd/index.html"), "utf8");
    assert.doesNotMatch(en, /Updated/);
    assert.doesNotMatch(en, /article:modified_time/);
  });
});

test("an update date before the publication date fails the build", async () => {
  const files = {
    "en/blog/upd.md": post("Wrong", "updated: 2026-11-01\n"),
    "fr/blog/maj.md": post("Faux"),
  };
  await assert.rejects(withSite(files, async () => {}), (err) => {
    let e = err;
    while (e) {
      if (/updated .* before .*date/i.test(e.message) && e.message.includes("upd.md")) return true;
      e = e.originalError || e.cause;
    }
    return false;
  });
});
