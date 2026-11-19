# NakoCorp Website

Website of [NakoCorp](https://www.nakocorp.com): the landing page for [Barking](https://github.com/nakocorp/barking), the open-source, end-to-end encrypted messenger, and its bilingual (EN/FR) blog. Hosted on GitHub Pages.

## Stack

[Eleventy](https://www.11ty.dev/) 3 on Node 22 (see [.nvmrc](.nvmrc)). The build outputs a static site to `_site/`.

- The homepage ([src/index.html](src/index.html)) is still plain HTML/CSS/JS, copied as-is, with a bilingual EN/FR switcher: English lives in the HTML, French strings are in [src/assets/js/site.js](src/assets/js/site.js). The browser language picks the default, and the choice is persisted in `localStorage`. Illustrations and diagrams are inline SVG and HTML/CSS mockups.
- The blog lives under `/en/blog/` and `/fr/blog/`, with two feeds per language, Atom (`/en/feed.xml`, `/fr/feed.xml`) and RSS 2.0 (`/en/rss.xml`, `/fr/rss.xml`), a `/sitemap.xml`, and a `/blog/` page that routes visitors to their language.
- The blog has no third-party scripts. Its only JavaScript is the Paper/Ink theme script and the `/blog/` router.

## Structure

```
src/index.html         the homepage
src/assets/            CSS, JS, logo, blog assets (fonts, OG images), copied as-is
src/en/blog/           English articles
src/fr/blog/           French articles
src/_includes/         layouts, partials, article diagrams (diagrams/<translationKey>/<name>.njk)
src/_data/             site data
src/CNAME              custom domain (www.nakocorp.com), copied to _site/
lib/                   pure logic (blog data, i18n, translations)
tests/                 node:test suites, with helpers in tests/helpers/
scripts/og-image.html  Open Graph image generator (command in its header comment)
eleventy.config.js     Eleventy configuration
```

## Local preview

```bash
npm ci
npm run serve
```

Then open the URL Eleventy prints (usually `http://localhost:8080`). `npm run build` writes the site to `_site/`.

## Tests

```bash
npm test
```

The tests build the site from temporary copies of `src/` named `.tmp-src-*` at the repo root. A crashed run can leave some behind. They are safe to delete.

## Writing an article

An article is two files, one per language, in `src/en/blog/` and `src/fr/blog/`. Both share the same `translationKey` in their frontmatter, and the language comes from the folder.

```yaml
---
title: Why Barking
description: One sentence, 160 characters at most.
date: 2026-11-18
updated: 2026-12-01        # optional: set it when you edit a published article; shown as "Updated <date>" / « Mis à jour le <date> », must not be before date
translationKey: why-barking
tags: [barking]
barking: true
draft: false
cta: Try the prototype and tell us what breaks.   # optional, a line above the common call to action
---
```

- A published article without a published translation (same `translationKey` in the other language) fails the build.
- Drafts (`draft: true`) are neither written nor listed. To preview them: `BLOG_DRAFTS=1 npm run serve`.
- Articles go through Nunjucks before Markdown (`markdownTemplateEngine: "njk"`). Any literal `{{`, `{%` or `{#` in prose or in a code block must be wrapped in `{% raw %}…{% endraw %}`, or the build fails or eats the text.
- Diagrams go in `src/_includes/diagrams/<translationKey>/<name>.njk` and are used in the article with `{% diagram "<name>" %}`. Inside a `<figure>`, keep the shortcode on the line right after `<figure>` with no blank line around it, otherwise Markdown wraps the SVG in a `<p>`:

  ```html
  <figure>
  {% diagram "flow" %}
  <figcaption>A message through one relay.</figcaption>
  </figure>
  ```

- SVG ids in a diagram (markers, gradients, `aria-labelledby` targets) are fixed strings, and the build fails on a duplicate id. Use at most one diagram with ids per page, or prefix each diagram's ids with its name.
- `h2` and `h3` get an id from their text at build time, so `#section-name` links to a section.
- Open Graph images are generated with [scripts/og-image.html](scripts/og-image.html), see its header comment for the command.
- The style guides ([EN](src/en/blog/style-guide.md), [FR](src/fr/blog/guide-de-style.md)) cover the voice and format.

## Deployment

[.github/workflows/pages.yml](.github/workflows/pages.yml) runs on every pull request, every push to `main` and on manual dispatch. It installs dependencies with `npm ci`, runs `npm test`, and builds the site. On `main` only, it then publishes `_site/` to GitHub Pages (**Settings → Pages → Source: GitHub Actions**, custom domain `www.nakocorp.com`).

## Contributing

`main` is production: every merge deploys www.nakocorp.com. Nobody pushes to it directly.

1. Create a branch from an up-to-date `main`: `feature/<name>`, `fix/<name>`, or `blog/<slug>` for an article.
2. Push it and open a pull request against `main`.
3. Merge once the `build` check passes. The branch is deleted after the merge.

A ruleset protects `main`: changes only through a pull request, the `build` check must pass, the branch must be up to date, no force push and no deletion.

## License

MIT, see [LICENSE](LICENSE).
