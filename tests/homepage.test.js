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
