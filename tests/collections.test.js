import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { withSite } from "./helpers/site.js";

const article = (title, extra = "", date = "2026-01-01") =>
  `---\ntitle: ${title}\ndescription: d\ndate: ${date}\ntranslationKey: a\ntags: []\nbarking: false\n${extra}---\nBody ${title}\n`;

const exists = (p) => access(p).then(() => true, () => false);

test("a published EN/FR pair produces both article pages", async () => {
  await withSite(
    { "en/blog/a.md": article("A"), "fr/blog/a.md": article("A fr") },
    async (out) => {
      assert.match(await readFile(join(out, "en/blog/a/index.html"), "utf8"), /Body A/);
      assert.match(await readFile(join(out, "fr/blog/a/index.html"), "utf8"), /Body A fr/);
    },
  );
});

test("a draft is not written, except with drafts: true (consecutive builds)", async () => {
  const files = {
    "en/blog/a.md": article("A"),
    "fr/blog/a.md": article("A fr"),
    "en/blog/d.md": article("D", "draft: true\n").replace("translationKey: a", "translationKey: d"),
    "fr/blog/d.md": article("D fr", "draft: true\n").replace("translationKey: a", "translationKey: d"),
  };
  await withSite(files, async (out) => {
    assert.equal(await exists(join(out, "en/blog/d/index.html")), false);
  });
  await withSite(
    files,
    async (out) => {
      assert.equal(await exists(join(out, "en/blog/d/index.html")), true);
    },
    { drafts: true },
  );
  await withSite(files, async (out) => {
    assert.equal(await exists(join(out, "en/blog/d/index.html")), false);
  });
});

test("an EN article without FR translation rejects the build, naming the file", async () => {
  await assert.rejects(
    withSite({ "en/blog/solo.md": article("Solo") }, async () => {}),
    /en\/blog\/solo\.md/,
  );
});

test("diagram shortcode renders the include with page data; missing file fails", async () => {
  const md = (name) => `{% diagram "${name}" %}`;
  const files = {
    "_includes/diagrams/a/flow.njk": "<svg>{{ lang }}</svg>",
    "en/blog/a.md": article("A").replace("Body A", md("flow")),
    "fr/blog/a.md": article("A fr").replace("Body A fr", md("flow")),
  };
  await withSite(files, async (out) => {
    assert.match(await readFile(join(out, "fr/blog/a/index.html"), "utf8"), /<svg>fr<\/svg>/);
  });
  await assert.rejects(
    withSite({ ...files, "en/blog/a.md": article("A").replace("Body A", md("nope")) }, async () => {}),
    (error) => {
      // Eleventy wraps template errors; the shortcode's message is in the chain.
      const messages = [];
      for (let e = error; e; e = e.originalError ?? e.cause) messages.push(e.message);
      assert.match(messages.join("\n"), /diagrams\/a\/nope\.njk/);
      return true;
    },
  );
});

test("posts_en is newest first and lists drafts only with BLOG_DRAFTS=1", async () => {
  const key = (md, k) => md.replace("translationKey: a", `translationKey: ${k}`);
  const files = {
    "en/blog/old.md": key(article("Old", "", "2025-01-01"), "old"),
    "fr/blog/old.md": key(article("Old fr", "", "2025-01-01"), "old"),
    "en/blog/new.md": key(article("New", "", "2026-06-01"), "new"),
    "fr/blog/new.md": key(article("New fr", "", "2026-06-01"), "new"),
    "en/blog/wip.md": key(article("Wip", "draft: true\n", "2026-03-01"), "wip"),
    "fr/blog/wip.md": key(article("Wip fr", "draft: true\n", "2026-03-01"), "wip"),
    "list.njk":
      "---\npermalink: /list.txt\n---\n{% for p in collections.posts_en %}{{ p.data.title }}|{% endfor %}",
  };
  // src/ has drafts of its own (the style guide): only this test's titles count.
  const ours = new Set(["New", "Wip", "Old"]);
  const listed = async (out) =>
    (await readFile(join(out, "list.txt"), "utf8")).split("|").filter((t) => ours.has(t)).join("|");
  await withSite(files, async (out) => {
    assert.equal(await listed(out), "New|Old");
  });
  await withSite(
    files,
    async (out) => {
      assert.equal(await listed(out), "New|Wip|Old");
    },
    { drafts: true },
  );
});

test("a draft translation does not satisfy the translation check", async () => {
  await assert.rejects(
    withSite(
      { "en/blog/a.md": article("A"), "fr/blog/a.md": article("A fr", "draft: true\n") },
      async () => {},
      { drafts: true },
    ),
    /en\/blog\/a\.md/,
  );
});
