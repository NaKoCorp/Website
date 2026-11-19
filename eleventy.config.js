import { join, relative } from "node:path";
import { existsSync } from "node:fs";
import { IdAttributePlugin } from "@11ty/eleventy";
import syntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";
import { feedPlugin } from "@11ty/eleventy-plugin-rss";
import { checkTranslations } from "./lib/translations.js";
import { formatDate, readingTime, labels } from "./lib/i18n.js";

const DEFAULT_INPUT = "src";

export default function (eleventyConfig) {
  // For programmatic builds (the test helper) the `dir` returned below would
  // override the constructor's input and output, so both are derived from what
  // Eleventy already knows. For a plain `eleventy` run it reports "./" as the
  // input at this point (nothing given), so fall back to the default; the
  // output then resolves to the default `_site`.
  const given = eleventyConfig.directories.input;
  const input = given === "./" ? DEFAULT_INPUT : given;
  const output = eleventyConfig.directories.output;

  // Passthrough sources are resolved from the working directory.
  const from = relative(process.cwd(), input);
  eleventyConfig.addPassthroughCopy({
    [join(from, "index.html")]: "index.html",
    [join(from, "assets")]: "assets",
    [join(from, "CNAME")]: "CNAME",
  });
  // Self-hosted Fira Code for the blog (the homepage keeps Google Fonts). The
  // package lives at the repo root, whatever the input directory.
  eleventyConfig.addPassthroughCopy({
    "node_modules/@fontsource/fira-code/files/fira-code-latin-{400,500,600}-normal.woff2":
      "assets/blog/fonts",
  });

  // Prism classes at build time (no client JS); blog.css colours the tokens.
  eleventyConfig.addPlugin(syntaxHighlight);

  // Ids on h2/h3 so a section can be linked (design spec §5.6). Existing ids
  // are matched too, so a heading never takes an id already on the page, and
  // two equal ids fail the build.
  eleventyConfig.addPlugin(IdAttributePlugin, { selector: "[id],h2,h3" });

  const byDateDesc = (a, b) => b.date - a.date;
  const isArticle = (item) => item.data.layout === "layouts/article.njk";
  const articles = (api) => api.getAll().filter(isArticle);

  eleventyConfig.addCollection("posts", (api) => {
    const all = articles(api).sort(byDateDesc);
    // An update can't predate the article: that is a typo in the frontmatter.
    const backdated = all.filter((item) => item.data.updated && new Date(item.data.updated) < item.date);
    if (backdated.length)
      throw new Error(
        backdated.map((item) => `${item.inputPath}: updated is before date`).join("\n"),
      );
    // Drafts never count as a translation: only published pages are checked.
    checkTranslations(
      all
        .filter((item) => !item.data.draft)
        .map((item) => ({
        lang: item.data.lang,
        translationKey: item.data.translationKey,
        draft: false,
        inputPath: item.inputPath,
      })),
    );
    return all;
  });
  // Standalone pages (privacy policy, support), for the sitemap.
  eleventyConfig.addCollection("pages", (api) =>
    api
      .getAll()
      .filter((item) => item.data.layout === "layouts/page.njk")
      .sort((a, b) => a.url.localeCompare(b.url)),
  );
  for (const lang of ["en", "fr"]) {
    eleventyConfig.addCollection(`posts_${lang}`, (api) =>
      // Unpublished drafts are already excluded from collections (blog-data.js);
      // with BLOG_DRAFTS=1 they are listed.
      articles(api)
        .filter((item) => item.data.lang === lang)
        .sort(byDateDesc),
    );
  }

  // Feeds and the sitemap list published articles only, even with BLOG_DRAFTS=1.
  // A feed entry is dated by its last update when it has one.
  const published = (item) => !item.data.draft;
  const feedEntry = (item) =>
    item.data.updated ? Object.create(item, { date: { value: new Date(item.data.updated) } }) : item;
  eleventyConfig.addCollection("published_posts", (api) =>
    articles(api).filter(published).sort(byDateDesc),
  );
  for (const lang of ["en", "fr"]) {
    eleventyConfig.addCollection(`feed_posts_${lang}`, (api) =>
      articles(api)
        .filter((item) => item.data.lang === lang && published(item))
        .sort(byDateDesc)
        .map(feedEntry),
    );
  }
  const feeds = { en: "NakoCorp blog", fr: "Blog NakoCorp" };
  // Each language gets an Atom feed (feed.xml) and the same entries as RSS 2.0
  // (rss.xml) for the readers that only take RSS.
  const formats = { atom: "feed.xml", rss: "rss.xml" };
  for (const [lang, title] of Object.entries(feeds)) {
    for (const [type, file] of Object.entries(formats)) {
      eleventyConfig.addPlugin(feedPlugin, {
        type,
        outputPath: `/${lang}/${file}`,
        collection: { name: `feed_posts_${lang}`, limit: 20, sort: "descending" },
        metadata: {
          language: lang,
          title,
          subtitle: labels[lang].blogDescription,
          // The feed's id and alternate link: this language's blog list. Entry
          // URLs are root-relative, so they still resolve to the site root.
          base: `https://www.nakocorp.com/${lang}/blog/`,
          author: { name: "NakoCorp" },
        },
      });
    }
  }

  // The RSS template of @11ty/eleventy-plugin-rss 3.1.0 writes <content:encoded>
  // without declaring its namespace: declare it, so the XML stays well formed.
  eleventyConfig.addTransform("rss-content-namespace", (content, outputPath) =>
    typeof outputPath === "string" && outputPath.endsWith("/rss.xml") && !content.includes("xmlns:content=")
      ? content.replace('<rss version="2.0"', '<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"')
      : content,
  );

  eleventyConfig.addFilter("formatDate", (date, lang) => formatDate(new Date(date), lang));
  // YYYY-MM-DD, for <time datetime> and the article meta tags.
  eleventyConfig.addFilter("isoDate", (date) => new Date(date).toISOString().slice(0, 10));
  eleventyConfig.addFilter("readingTime", readingTime);
  eleventyConfig.addFilter("translationOf", (page, posts) =>
    (posts || []).find(
      (item) =>
        item.data.translationKey === page.data?.translationKey &&
        item.data.lang !== page.data?.lang,
    ),
  );

  // {% diagram "name" %} renders _includes/diagrams/<translationKey>/<name>.njk
  // with the current page's data.
  eleventyConfig.addAsyncShortcode("diagram", async function (name) {
    const key = this.ctx?.translationKey ?? this.page?.data?.translationKey;
    const rel = `diagrams/${key}/${name}.njk`;
    const file = join(input, "_includes", rel);
    if (!existsSync(file)) {
      throw new Error(`diagram "${name}" not found: expected ${file}`);
    }
    return this.env.renderString(`{% include "${rel}" %}`, this.ctx?.getAll?.() ?? this.ctx);
  });

  // Cover illustration of an article: _includes/covers/<translationKey>.njk,
  // else the generic cover. Used by the list and the article header.
  eleventyConfig.addFilter("coverInclude", (key) =>
    key && existsSync(join(input, "_includes", "covers", `${key}.njk`))
      ? `covers/${key}.njk`
      : "covers/default.njk",
  );

  return {
    dir: { input, output, includes: "_includes", data: "_data" },
    // HTML is never interpreted: the homepage is copied untouched.
    templateFormats: ["md", "njk"],
    markdownTemplateEngine: "njk",
  };
}
