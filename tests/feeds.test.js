import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { withSite } from "./helpers/site.js";

const SITE = "https://www.nakocorp.com";

const article = (title, extra = "") =>
  `---\ntitle: ${title}\ndescription: Summary of ${title}\ndate: 2026-01-01\ntranslationKey: pair\ntags: []\nbarking: false\n${extra}---\nBody ${title}\n`;

const files = {
  "en/blog/hello.md": article("Hello", "updated: 2026-03-05\n"),
  "fr/blog/bonjour.md": article("Bonjour"),
};

async function build(extraFiles = {}, options) {
  let result;
  await withSite(
    { ...files, ...extraFiles },
    async (out) => {
      const read = (p) => readFile(join(out, p), "utf8");
      result = {
        enFeed: await read("en/feed.xml"),
        frFeed: await read("fr/feed.xml"),
        enRss: await read("en/rss.xml"),
        frRss: await read("fr/rss.xml"),
        sitemap: await read("sitemap.xml"),
        router: await read("blog/index.html"),
      };
    },
    options,
  );
  return result;
}

test("Atom feeds list their own language only, with absolute URLs", async () => {
  const { enFeed, frFeed } = await build();
  assert.match(enFeed, /<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom"/);
  assert.ok(enFeed.includes(`${SITE}/en/blog/hello/`));
  assert.ok(enFeed.includes("Summary of Hello"));
  assert.ok(enFeed.includes("<updated>2026-03-05T"), "uses the updated date");
  assert.ok(!enFeed.includes("bonjour"));
  assert.ok(frFeed.includes(`${SITE}/fr/blog/bonjour/`));
  assert.ok(!frFeed.includes("/en/blog/hello/"));
});

test("each feed has its own id and links its own blog list", async () => {
  const { enFeed, frFeed } = await build();
  const id = (feed) => /<id>([^<]+)<\/id>/.exec(feed)?.[1];
  assert.equal(id(enFeed), `${SITE}/en/blog/`);
  assert.equal(id(frFeed), `${SITE}/fr/blog/`);
  assert.match(enFeed, new RegExp(`<link href="${SITE}/en/blog/" />`));
  assert.match(frFeed, new RegExp(`<link href="${SITE}/fr/blog/" />`));
  assert.match(enFeed, new RegExp(`<link href="${SITE}/en/feed\\.xml" rel="self" />`));
  // Entry URLs stay absolute and are not nested under the feed's base.
  assert.match(enFeed, new RegExp(`<id>${SITE}/en/blog/hello/</id>`));
  assert.doesNotMatch(enFeed, /\/en\/blog\/en\//);
});

test("sitemap links each article to its translation and omits /blog/", async () => {
  const { sitemap } = await build();
  assert.match(sitemap, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/);
  assert.ok(sitemap.includes(`<loc>${SITE}/</loc>`));
  assert.ok(sitemap.includes(`<loc>${SITE}/en/blog/</loc>`));
  const block = sitemap.split("<url>").find((b) => b.includes(`<loc>${SITE}/en/blog/hello/</loc>`));
  assert.ok(block.includes(`hreflang="fr" href="${SITE}/fr/blog/bonjour/"`));
  assert.ok(block.includes(`hreflang="en" href="${SITE}/en/blog/hello/"`));
  assert.ok(block.includes(`hreflang="x-default" href="${SITE}/en/blog/hello/"`));
  const frBlock = sitemap.split("<url>").find((b) => b.includes(`<loc>${SITE}/fr/blog/bonjour/</loc>`));
  assert.ok(frBlock.includes(`hreflang="x-default" href="${SITE}/en/blog/hello/"`));
  assert.ok(!sitemap.includes(`<loc>${SITE}/blog/</loc>`));
});

test("drafts never reach the feeds or the sitemap, even with BLOG_DRAFTS=1", async () => {
  const drafts = {
    // A marker no real article uses: the build copies the real articles too.
    "en/blog/draft-canary.md": article("Draft canary", "draft: true\n").replace("pair", "hidden"),
    "fr/blog/draft-canary-fr.md": article("Draft canary FR", "draft: true\n").replace("pair", "hidden"),
  };
  for (const out of [await build(drafts), await build(drafts, { drafts: true })]) {
    for (const text of [out.enFeed, out.frFeed, out.sitemap]) {
      assert.ok(!/draft.canary/i.test(text), "draft leaked");
    }
    assert.ok(out.sitemap.includes("/en/blog/hello/"));
  }
});

test("/blog/ shows both language links outside scripts and is noindex, without canonical", async () => {
  const { router } = await build();
  const visible = router.replace(/<script[\s\S]*?<\/script>/g, "");
  assert.ok(visible.includes('href="/en/blog/"'));
  assert.ok(visible.includes('href="/fr/blog/"'));
  assert.ok(router.includes('<meta name="robots" content="noindex">'));
  // A noindex page names no canonical: the two signals contradict each other.
  assert.ok(!router.includes('rel="canonical"'));
  assert.ok(router.includes("location.replace"));
  assert.ok(router.includes("nakocorp-lang"));
});

test("RSS 2.0 feeds sit next to the Atom ones, one per language, with absolute links", async () => {
  const { enRss, frRss } = await build();
  assert.match(enRss, /<rss version="2.0"/);
  // <content:encoded> needs its namespace, or strict readers reject the feed.
  assert.match(enRss, /xmlns:content="http:\/\/purl\.org\/rss\/1\.0\/modules\/content\/"/);
  assert.ok(enRss.includes(`<link>${SITE}/en/blog/hello/</link>`));
  assert.ok(enRss.includes("Summary of Hello"));
  assert.ok(!enRss.includes("/fr/blog/"), "EN feed lists no FR article");
  assert.match(frRss, /<title>Blog NakoCorp<\/title>/);
  assert.ok(frRss.includes(`${SITE}/fr/blog/bonjour/`));
});

test("drafts never reach the RSS feeds either", async () => {
  const draft = { "en/blog/secret.md": article("Secret", "draft: true\n").replace("translationKey: pair", "translationKey: secret") };
  const { enRss } = await build(draft, { drafts: true });
  assert.ok(!enRss.includes("Secret") && !enRss.includes("/secret/"));
});
